import { NextResponse } from "next/server";
import { db } from "@/db";
import { entities, accounts } from "@/db/schema";
import { sql } from "drizzle-orm";
import { verifyAuth } from "@/lib/auth";

// POST /api/setup — Initialize database tables and seed default data
export async function POST() {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      fiscal_year_end_month INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      entity_id INTEGER NOT NULL REFERENCES entities(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      csv_format_id TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      balance NUMERIC(12,2),
      foreign_amount NUMERIC(12,2),
      exchange_rate NUMERIC(10,4),
      memo TEXT,
      category TEXT,
      is_personal BOOLEAN DEFAULT FALSE NOT NULL,
      raw_data TEXT,
      upload_batch_id TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS txn_dedup_idx
    ON transactions (account_id, date, description, amount)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      batch_id TEXT NOT NULL UNIQUE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      file_name TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      period_from DATE,
      period_to DATE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Check if already seeded
  const existing = await db.select().from(entities).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({
      message: "Tables created. Data already exists, skipping seed.",
    });
  }

  // Seed default entities and accounts
  const [personal] = await db
    .insert(entities)
    .values({
      name: "CTO for Everyone",
      type: "personal",
      fiscalYearEndMonth: 12,
    })
    .returning();

  const [corporate] = await db
    .insert(entities)
    .values({
      name: "CTO Works株式会社",
      type: "corporate",
      fiscalYearEndMonth: 2,
    })
    .returning();

  // Personal accounts
  await db.insert(accounts).values([
    {
      entityId: personal.id,
      name: "PayPay銀行",
      type: "bank",
      csvFormatId: "paypay-bank",
      active: true,
    },
    {
      entityId: personal.id,
      name: "中栄信用金庫",
      type: "bank",
      csvFormatId: "nakaei-shinkin",
      active: true,
    },
    {
      entityId: personal.id,
      name: "アメックスグリーン",
      type: "card",
      csvFormatId: "amex",
      active: true,
    },
    {
      entityId: personal.id,
      name: "アメックスマリオット",
      type: "card",
      csvFormatId: "amex",
      active: false,
    },
    {
      entityId: personal.id,
      name: "リクルートカード",
      type: "card",
      csvFormatId: "recruit-card",
      active: true,
    },
  ]);

  // Corporate accounts
  await db.insert(accounts).values([
    {
      entityId: corporate.id,
      name: "住信SBIネット銀行",
      type: "bank",
      csvFormatId: "sbi-net",
      active: true,
    },
    {
      entityId: corporate.id,
      name: "GMOあおぞらネット銀行",
      type: "bank",
      csvFormatId: "gmo-aozora",
      active: true,
    },
    {
      entityId: corporate.id,
      name: "UPSIDER",
      type: "card",
      csvFormatId: "upsider",
      active: true,
    },
  ]);

  return NextResponse.json({
    message: "Database initialized and seeded",
    entities: { personal: personal.id, corporate: corporate.id },
  });
}
