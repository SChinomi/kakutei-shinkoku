import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entities, accounts, uploads, receipts, transactions } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

// GET /api/completeness?year=2025 — Check document completeness by month
export async function GET(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || "2025", 10);

  // Get all entities with their accounts
  const entityList = await db.select().from(entities);
  const accountList = await db.select().from(accounts).where(eq(accounts.active, true));

  // Get upload coverage: which accounts have data for which months
  const uploadRows = await db
    .select({
      accountId: uploads.accountId,
      periodFrom: uploads.periodFrom,
      periodTo: uploads.periodTo,
      fileName: uploads.fileName,
      createdAt: uploads.createdAt,
    })
    .from(uploads)
    .where(
      and(
        gte(uploads.periodFrom, `${year}-01-01`),
        lte(uploads.periodTo, `${year + 1}-03-31`)
      )
    );

  // Get transaction coverage: actual transaction dates per account
  const txnCoverage = await db
    .select({
      accountId: transactions.accountId,
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, `${year}-01-01`),
        lte(transactions.date, `${year + 1}-03-31`)
      )
    )
    .groupBy(transactions.accountId, sql`to_char(${transactions.date}::date, 'YYYY-MM')`);

  // Get receipt coverage: which months have scanned receipts
  const receiptRows = await db
    .select({
      entityId: receipts.entityId,
      scanDate: receipts.scanDate,
      fileName: receipts.fileName,
      ocrResults: receipts.ocrResults,
      id: receipts.id,
    })
    .from(receipts);

  // Build month range based on entity fiscal year
  const result = entityList.map((entity) => {
    const entityAccounts = accountList.filter((a) => a.entityId === entity.id);

    // Determine month range for this entity's fiscal year
    let months: string[];
    if (entity.type === "personal") {
      // Personal: Jan-Dec of the year
      months = Array.from({ length: 12 }, (_, i) => {
        const m = (i + 1).toString().padStart(2, "0");
        return `${year}-${m}`;
      });
    } else {
      // Corporate: fiscal year based on fiscalYearEndMonth
      // e.g., 2月決算 = 2025-03 ~ 2026-02
      const endMonth = entity.fiscalYearEndMonth;
      months = Array.from({ length: 12 }, (_, i) => {
        const m = ((endMonth + i) % 12) + 1;
        const y = m > endMonth ? year : year + 1;
        return `${y}-${m.toString().padStart(2, "0")}`;
      });
    }

    // Per account, check which months have transactions
    const accountStatus = entityAccounts.map((acct) => {
      const monthData = months.map((month) => {
        const coverage = txnCoverage.find(
          (t) => t.accountId === acct.id && t.month === month
        );
        const hasUpload = uploadRows.some((u) => {
          if (u.accountId !== acct.id || !u.periodFrom || !u.periodTo) return false;
          const from = u.periodFrom.slice(0, 7);
          const to = u.periodTo.slice(0, 7);
          return month >= from && month <= to;
        });
        return {
          month,
          transactionCount: coverage ? Number(coverage.count) : 0,
          hasUpload,
        };
      });
      return {
        accountId: acct.id,
        accountName: acct.name,
        accountType: acct.type,
        months: monthData,
      };
    });

    // Receipt status per month
    const receiptStatus = months.map((month) => {
      const monthReceipts = receiptRows.filter((r) => {
        if (r.entityId !== entity.id) return false;
        const scanMonth = r.scanDate.slice(0, 7);
        return scanMonth === month;
      });
      const ocrItemCount = monthReceipts.reduce((sum, r) => {
        const results = r.ocrResults as Array<Record<string, unknown>> | null;
        return sum + (results ? results.length : 0);
      }, 0);
      const matchedCount = monthReceipts.reduce((sum, r) => {
        const results = r.ocrResults as Array<Record<string, unknown>> | null;
        if (!results) return sum;
        return sum + results.filter((item) => item.matched_transaction_id).length;
      }, 0);
      return {
        month,
        receiptCount: monthReceipts.length,
        receiptFiles: monthReceipts.map((r) => ({
          id: r.id,
          fileName: r.fileName,
        })),
        ocrItemCount,
        matchedCount,
      };
    });

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.type,
      fiscalYearEndMonth: entity.fiscalYearEndMonth,
      months,
      accounts: accountStatus,
      receipts: receiptStatus,
    };
  });

  return NextResponse.json({ year, completeness: result });
}
