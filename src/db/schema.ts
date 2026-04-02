import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  numeric,
  boolean,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

// 事業体（個人事業、法人など）
export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "CTO for Everyone"
  type: text("type").notNull(), // "personal" | "corporate"
  fiscalYearEndMonth: integer("fiscal_year_end_month").notNull(), // 12 for Dec, 2 for Feb
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 口座・カード
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id")
    .references(() => entities.id)
    .notNull(),
  name: text("name").notNull(), // e.g. "PayPay銀行", "アメックスグリーン"
  type: text("type").notNull(), // "bank" | "card"
  csvFormatId: text("csv_format_id").notNull(), // references a parser definition
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 取引データ（銀行・カード共通）
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .references(() => accounts.id)
      .notNull(),
    date: date("date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // 正=支出/入金, 負=返金/引落
    balance: numeric("balance", { precision: 12, scale: 2 }), // 銀行のみ
    foreignAmount: numeric("foreign_amount", { precision: 12, scale: 2 }),
    exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }),
    // 注記
    memo: text("memo"), // 店主貸、事業経費、等
    category: text("category"), // 勘定科目（将来用）
    isPersonal: boolean("is_personal").default(false).notNull(), // 店主貸フラグ
    // メタデータ
    rawData: text("raw_data"), // 元CSV行（原本保持）
    uploadBatchId: text("upload_batch_id"), // どのアップロードで入ったか
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // 同一口座・同一日付・同一内容・同一金額の重複防止
    uniqueIndex("txn_dedup_idx").on(
      table.accountId,
      table.date,
      table.description,
      table.amount
    ),
  ]
);

// レシート（Google Drive保存のスキャン画像）
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id")
    .references(() => entities.id)
    .notNull(),
  driveFileId: text("drive_file_id").notNull(),
  driveUrl: text("drive_url").notNull(),
  fileName: text("file_name").notNull(),
  scanDate: date("scan_date").notNull(), // スキャン対象月 e.g. 2026-01
  ocrResults: jsonb("ocr_results"), // [{date, store, amount, matched_transaction_id}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// アップロード履歴
export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  batchId: text("batch_id").notNull().unique(),
  accountId: integer("account_id")
    .references(() => accounts.id)
    .notNull(),
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").notNull(),
  periodFrom: date("period_from"),
  periodTo: date("period_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
