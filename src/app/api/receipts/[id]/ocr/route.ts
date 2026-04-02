import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/receipts/[id]/ocr — Save OCR results
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const receiptId = parseInt(id, 10);

  const body = await request.json();
  const { ocrResults } = body as {
    ocrResults: Array<{ date: string; store: string; amount: number }>;
  };

  if (!ocrResults || !Array.isArray(ocrResults)) {
    return NextResponse.json(
      { error: "ocrResults array is required" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(receipts)
    .set({ ocrResults })
    .where(eq(receipts.id, receiptId))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Receipt not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ receipt: updated });
}
