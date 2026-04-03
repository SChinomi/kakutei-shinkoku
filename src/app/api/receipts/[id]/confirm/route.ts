import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts, transactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

interface OcrItem {
  date: string;
  store: string;
  amount: number;
  matched_transaction_id?: number | null;
  status?: "pending" | "confirmed" | "rejected";
  candidates?: unknown[];
}

// PATCH /api/receipts/[id]/confirm — Confirm or reject OCR match items
// Supports single: { itemIndex, status, transactionId?, category? }
// Supports batch:  { items: [{ itemIndex, status, transactionId?, category? }] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const receiptId = parseInt(id, 10);

  const body = await request.json();

  // Normalize to array
  const items: Array<{
    itemIndex: number;
    status: "confirmed" | "rejected";
    transactionId?: number;
    category?: string;
  }> = body.items || [body];

  // Validate
  if (items.length === 0 || items.some((i) => i.itemIndex === undefined || !i.status)) {
    return NextResponse.json(
      { error: "itemIndex and status are required" },
      { status: 400 }
    );
  }

  // Get current receipt
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, receiptId));

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const ocrResults = (receipt.ocrResults as OcrItem[] | null) || [];
  const updatedOcr = [...ocrResults];
  const errors: string[] = [];

  for (const item of items) {
    if (item.itemIndex < 0 || item.itemIndex >= ocrResults.length) {
      errors.push(`Invalid itemIndex: ${item.itemIndex}`);
      continue;
    }

    const ocrItem = updatedOcr[item.itemIndex];

    // If transactionId specified (candidate selection), override matched_transaction_id
    if (item.transactionId) {
      ocrItem.matched_transaction_id = item.transactionId;
    }

    // Update OCR item status
    updatedOcr[item.itemIndex] = { ...ocrItem, status: item.status };

    // If confirmed and has a matched transaction, link receipt to transaction
    if (item.status === "confirmed" && ocrItem.matched_transaction_id) {
      const updateFields: Record<string, unknown> = {
        receiptId,
        receiptType: "scanned",
        updatedAt: sql`NOW()`,
      };
      if (item.category) {
        updateFields.category = item.category;
      }
      await db
        .update(transactions)
        .set(updateFields)
        .where(eq(transactions.id, ocrItem.matched_transaction_id));
    }

    // If rejected and was previously confirmed, unlink
    if (item.status === "rejected" && ocrItem.matched_transaction_id) {
      await db
        .update(transactions)
        .set({ receiptId: null, receiptType: null, updatedAt: sql`NOW()` })
        .where(eq(transactions.id, ocrItem.matched_transaction_id));
    }
  }

  // Save updated OCR results
  await db
    .update(receipts)
    .set({ ocrResults: updatedOcr })
    .where(eq(receipts.id, receiptId));

  // Return updated receipt
  const [updated] = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, receiptId));

  return NextResponse.json({
    receipt: updated,
    processed: items.length - errors.length,
    errors,
  });
}
