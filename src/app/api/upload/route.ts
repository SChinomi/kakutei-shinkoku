import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, uploads } from "@/db/schema";
import { parseCSV } from "@/lib/csv-parser";
import { getFormat } from "@/lib/csv-formats";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const accountId = formData.get("accountId") as string | null;
    const csvFormatId = formData.get("csvFormatId") as string | null;

    if (!file || !accountId || !csvFormatId) {
      return NextResponse.json(
        { error: "file, accountId, csvFormatId are required" },
        { status: 400 }
      );
    }

    const format = getFormat(csvFormatId);
    if (!format) {
      return NextResponse.json(
        { error: `Unknown CSV format: ${csvFormatId}` },
        { status: 400 }
      );
    }

    // Read file content — auto-detect encoding
    let content: string;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Try UTF-8 first (already converted files), fall back to Shift-JIS
    const utf8 = buffer.toString("utf-8");
    if (
      utf8.includes("\ufffd") ||
      (!utf8.includes(",") && buffer.length > 10)
    ) {
      const decoder = new TextDecoder("shift_jis");
      content = decoder.decode(buffer);
    } else {
      content = utf8;
    }

    // Parse CSV
    const parsed = parseCSV(content, format);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in CSV" },
        { status: 400 }
      );
    }

    const batchId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const acctId = parseInt(accountId, 10);

    // Insert transactions (skip duplicates)
    let inserted = 0;
    let skipped = 0;

    for (const txn of parsed) {
      try {
        await db
          .insert(transactions)
          .values({
            accountId: acctId,
            date: txn.date,
            description: txn.description,
            amount: txn.amount.toString(),
            balance: txn.balance?.toString() ?? null,
            foreignAmount: txn.foreignAmount?.toString() ?? null,
            exchangeRate: txn.exchangeRate?.toString() ?? null,
            memo: txn.memo ?? null,
            isPersonal: false,
            rawData: txn.rawLine,
            uploadBatchId: batchId,
          })
          .onConflictDoNothing();
        inserted++;
      } catch (e) {
        console.error("Insert error:", e);
        skipped++;
      }
    }

    // Record upload
    const dates = parsed.map((t) => t.date).sort();
    await db.insert(uploads).values({
      batchId,
      accountId: acctId,
      fileName: file.name,
      rowCount: inserted,
      periodFrom: dates[0],
      periodTo: dates[dates.length - 1],
    });

    return NextResponse.json({
      batchId,
      total: parsed.length,
      inserted,
      skipped,
      periodFrom: dates[0],
      periodTo: dates[dates.length - 1],
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
