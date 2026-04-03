import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts, transactions, accounts } from "@/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";

interface MatchCandidate {
  transaction_id: number;
  score: number;
  date_score: number;
  amount_score: number;
  store_score: number;
  date: string;
  description: string;
  amount: string;
  account_name: string;
}

interface OcrItem {
  date: string;
  store: string;
  amount: number;
  matched_transaction_id?: number | null;
  status?: "confirmed" | "rejected";
  candidates?: MatchCandidate[];
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
    .replace(/[\s\u3000・．.，,/／()（）\-ー]+/g, "")
    .toLowerCase();
}

function scoreDateProximity(ocrDate: string, txnDate: string): number {
  const d1 = new Date(ocrDate).getTime();
  const d2 = new Date(txnDate).getTime();
  const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  if (diffDays === 0) return 40;
  if (diffDays <= 1) return 32;
  if (diffDays <= 2) return 20;
  if (diffDays <= 3) return 10;
  if (diffDays <= 7) return 3;
  return 0;
}

function scoreAmountMatch(ocrAmount: number, txnAmount: string): number {
  const txn = parseFloat(txnAmount);
  if (ocrAmount === txn) return 40;
  const diff = Math.abs(ocrAmount - txn);
  const pct = diff / Math.max(ocrAmount, txn);
  if (diff <= 10) return 35; // rounding error
  if (pct <= 0.02) return 28; // within 2%
  if (pct <= 0.05) return 18; // within 5%
  if (pct <= 0.10) return 8;  // within 10%
  return 0;
}

function scoreStoreMatch(ocrStore: string, txnDescription: string): number {
  const a = normalizeForMatch(ocrStore);
  const b = normalizeForMatch(txnDescription);
  if (!a || !b) return 0;
  if (a === b) return 20;
  if (b.includes(a) || a.includes(b)) return 16;
  // Check shared substrings (3+ chars)
  let bestLen = 0;
  for (let len = Math.min(a.length, 6); len >= 3; len--) {
    for (let i = 0; i <= a.length - len; i++) {
      if (b.includes(a.slice(i, i + len)) && len > bestLen) {
        bestLen = len;
      }
    }
    if (bestLen > 0) break;
  }
  if (bestLen >= 5) return 14;
  if (bestLen >= 4) return 10;
  if (bestLen >= 3) return 6;
  return 0;
}

// POST /api/receipts/[id]/match — Smart match OCR results with transactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const receiptId = parseInt(id, 10);

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

  // Collect all already-matched transaction IDs to avoid double-matching
  const usedTxnIds = new Set<number>();
  for (const item of ocrResults) {
    if (item.status === "confirmed" && item.matched_transaction_id) {
      usedTxnIds.add(item.matched_transaction_id);
    }
  }

  let matchCount = 0;
  const updatedOcr = [...ocrResults];

  for (let i = 0; i < updatedOcr.length; i++) {
    const item = updatedOcr[i];
    if (item.status === "confirmed" || item.status === "rejected") continue;

    // Search within date ±7 days (wider window), filter by score later
    const ocrDate = new Date(item.date);
    const dateFrom = new Date(ocrDate);
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateTo = new Date(ocrDate);
    dateTo.setDate(dateTo.getDate() + 7);

    const candidateRows = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        accountName: accounts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(accounts.entityId, receipt.entityId),
          gte(transactions.date, dateFrom.toISOString().slice(0, 10)),
          lte(transactions.date, dateTo.toISOString().slice(0, 10)),
          // Only positive amounts (expenses), skip refunds/transfers
          sql`${transactions.amount} > 0`
        )
      );

    // Score each candidate
    const scored: MatchCandidate[] = candidateRows
      .filter((row) => !usedTxnIds.has(row.id))
      .map((row) => {
        const dateScore = scoreDateProximity(item.date, row.date);
        const amountScore = scoreAmountMatch(item.amount, row.amount);
        const storeScore = scoreStoreMatch(item.store, row.description);
        return {
          transaction_id: row.id,
          score: dateScore + amountScore + storeScore,
          date_score: dateScore,
          amount_score: amountScore,
          store_score: storeScore,
          date: row.date,
          description: row.description,
          amount: row.amount,
          account_name: row.accountName,
        };
      })
      .filter((c) => c.score >= 20) // minimum threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length === 0) {
      updatedOcr[i] = { ...item, candidates: [], matched_transaction_id: null };
      continue;
    }

    const best = scored[0];
    updatedOcr[i] = {
      ...item,
      matched_transaction_id: best.score >= 50 ? best.transaction_id : null,
      candidates: scored,
    };
    if (best.score >= 50) {
      usedTxnIds.add(best.transaction_id);
      matchCount++;
    }
  }

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
