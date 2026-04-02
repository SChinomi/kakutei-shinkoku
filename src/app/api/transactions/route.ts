import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, accounts, entities } from "@/db/schema";
import { eq, and, gte, lte, desc, asc, sql, ilike } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const entityId = searchParams.get("entityId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");
  const personalOnly = searchParams.get("personalOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = (page - 1) * limit;

  const conditions = [];

  if (accountId) {
    conditions.push(eq(transactions.accountId, parseInt(accountId, 10)));
  }
  if (from) {
    conditions.push(gte(transactions.date, from));
  }
  if (to) {
    conditions.push(lte(transactions.date, to));
  }
  if (search) {
    conditions.push(ilike(transactions.description, `%${search}%`));
  }
  if (personalOnly) {
    conditions.push(eq(transactions.isPersonal, true));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        accountName: accounts.name,
        accountType: accounts.type,
        entityName: entities.name,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        balance: transactions.balance,
        foreignAmount: transactions.foreignAmount,
        exchangeRate: transactions.exchangeRate,
        memo: transactions.memo,
        category: transactions.category,
        isPersonal: transactions.isPersonal,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(entities, eq(accounts.entityId, entities.id))
      .where(
        entityId
          ? and(where, eq(accounts.entityId, parseInt(entityId, 10)))
          : where
      )
      .orderBy(desc(transactions.date), asc(transactions.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        entityId
          ? and(where, eq(accounts.entityId, parseInt(entityId, 10)))
          : where
      ),
  ]);

  return NextResponse.json({
    transactions: rows,
    total: countResult[0].count,
    page,
    limit,
  });
}

// PATCH: Update transaction memo / isPersonal
export async function PATCH(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { ids, memo, isPersonal, category } = body as {
    ids: number[];
    memo?: string;
    isPersonal?: boolean;
    category?: string;
  };

  if (!ids || ids.length === 0) {
    return NextResponse.json(
      { error: "ids are required" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (memo !== undefined) updates.memo = memo;
  if (isPersonal !== undefined) updates.isPersonal = isPersonal;
  if (category !== undefined) updates.category = category;

  const updated = await db
    .update(transactions)
    .set(updates)
    .where(
      sql`${transactions.id} = ANY(ARRAY[${sql.raw(ids.join(","))}]::int[])`
    )
    .returning({ id: transactions.id });

  return NextResponse.json({ updated: updated.length });
}
