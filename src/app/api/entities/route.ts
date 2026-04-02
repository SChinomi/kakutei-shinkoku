import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entities, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      fiscalYearEndMonth: entities.fiscalYearEndMonth,
      accountId: accounts.id,
      accountName: accounts.name,
      accountType: accounts.type,
      csvFormatId: accounts.csvFormatId,
      accountActive: accounts.active,
    })
    .from(entities)
    .leftJoin(accounts, eq(entities.id, accounts.entityId))
    .orderBy(entities.id, accounts.id);

  // Group by entity
  const grouped = new Map<
    number,
    {
      id: number;
      name: string;
      type: string;
      fiscalYearEndMonth: number;
      accounts: Array<{
        id: number;
        name: string;
        type: string;
        csvFormatId: string;
        active: boolean;
      }>;
    }
  >();

  for (const row of result) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        type: row.type,
        fiscalYearEndMonth: row.fiscalYearEndMonth,
        accounts: [],
      });
    }
    if (row.accountId) {
      grouped.get(row.id)!.accounts.push({
        id: row.accountId,
        name: row.accountName!,
        type: row.accountType!,
        csvFormatId: row.csvFormatId!,
        active: row.accountActive!,
      });
    }
  }

  return NextResponse.json(Array.from(grouped.values()));
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, type, fiscalYearEndMonth } = body;

  const [entity] = await db
    .insert(entities)
    .values({ name, type, fiscalYearEndMonth })
    .returning();

  return NextResponse.json(entity);
}
