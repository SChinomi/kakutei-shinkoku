import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts, transactions, accounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface OcrItem {
  date: string;
  store: string;
  amount: number;
  matched_transaction_id?: number | null;
}

// POST /api/receipts/[id]/match — Match OCR results with card transactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const receiptId = parseInt(id, 10);

  // Get the receipt
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, receiptId));

  if (!receipt) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  const ocrResults = (receipt.ocrResults as OcrItem[] | null) || [];
  if (ocrResults.length === 0) {
    return NextResponse.json(
      { error: "No OCR results to match" },
      { status: 400 }
    );
  }

  let matchCount = 0;
  const updatedOcr = [...ocrResults];

  for (let i = 0; i < updatedOcr.length; i++) {
    const item = updatedOcr[i];
    if (item.matched_transaction_id) continue; // Already matched

    // Search transactions by date + amount for this entity
    const matched = await db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(accounts.entityId, receipt.entityId),
          eq(transactions.date, item.date),
          eq(
            transactions.amount,
            sql`${String(item.amount)}::numeric`
          )
        )
      )
      .limit(1);

    if (matched.length > 0) {
      updatedOcr[i] = {
        ...item,
        matched_transaction_id: matched[0].id,
      };
      matchCount++;
    }
  }

  // Save updated OCR results
  const [updated] = await db
    .update(receipts)
    .set({ ocrResults: updatedOcr })
    .where(eq(receipts.id, receiptId))
    .returning();

  return NextResponse.json({
    receipt: updated,
    matchCount,
    totalItems: updatedOcr.length,
  });
}
