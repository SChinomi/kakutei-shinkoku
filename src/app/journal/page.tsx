import { db } from "@/db";
import { transactions, accounts, entities, receipts } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type JournalRow = {
  id: number;
  date: string;
  description: string;
  amount: string;
  category: string | null;
  memo: string | null;
  isPersonal: boolean;
  receiptId: number | null;
  receiptType: string | null;
  accountName: string;
  accountType: string;
  entityId: number;
  entityName: string;
  entityType: string;
  receiptFileName: string | null;
  receiptDriveUrl: string | null;
};

export default async function JournalPage() {
  let rows: JournalRow[];
  try {
    rows = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        category: transactions.category,
        memo: transactions.memo,
        isPersonal: transactions.isPersonal,
        receiptId: transactions.receiptId,
        receiptType: transactions.receiptType,
        accountName: accounts.name,
        accountType: accounts.type,
        entityId: entities.id,
        entityName: entities.name,
        entityType: entities.type,
        receiptFileName: receipts.fileName,
        receiptDriveUrl: receipts.driveUrl,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(entities, eq(accounts.entityId, entities.id))
      .leftJoin(receipts, eq(transactions.receiptId, receipts.id))
      .where(
        and(
          gte(transactions.date, "2025-01-01"),
          lte(transactions.date, "2026-03-31")
        )
      )
      .orderBy(desc(transactions.date));
  } catch {
    rows = [];
  }

  // Group by entity
  const byEntity = new Map<number, { name: string; type: string; rows: JournalRow[] }>();
  for (const row of rows) {
    if (!byEntity.has(row.entityId)) {
      byEntity.set(row.entityId, { name: row.entityName, type: row.entityType, rows: [] });
    }
    byEntity.get(row.entityId)!.rows.push(row);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仕訳一覧</h1>
        <span className="text-sm text-gray-500">{rows.length}件</span>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500 flex gap-4">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> スキャン済
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> デジタル証憑
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 未整理
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
          取引データがありません。
          <Link href="/upload" className="text-blue-600 hover:underline ml-1">
            CSVアップロード
          </Link>
          から始めてください。
        </div>
      ) : (
        Array.from(byEntity.entries()).map(([entityId, { name, type, rows: items }]) => {
          const scanned = items.filter((r) => r.receiptType === "scanned").length;
          const digital = items.filter((r) => r.receiptType === "digital").length;
          const none = items.filter((r) => !r.receiptType).length;
          const personal = items.filter((r) => r.isPersonal).length;

          return (
            <section
              key={entityId}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{name}</h2>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {type === "personal" ? "個人事業" : "法人"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{items.length}件</span>
                  {scanned > 0 && <span className="text-green-600">スキャン:{scanned}</span>}
                  {digital > 0 && <span className="text-blue-600">デジタル:{digital}</span>}
                  {none > 0 && <span className="text-red-500 font-medium">未整理:{none}</span>}
                  {personal > 0 && <span className="text-orange-600">店主貸:{personal}</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                      <th className="text-left px-4 py-2 font-medium">日付</th>
                      <th className="text-left px-4 py-2 font-medium">口座</th>
                      <th className="text-left px-4 py-2 font-medium">摘要</th>
                      <th className="text-right px-4 py-2 font-medium">金額</th>
                      <th className="text-left px-4 py-2 font-medium">科目</th>
                      <th className="text-left px-4 py-2 font-medium">証憑</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-gray-50 ${
                          row.isPersonal
                            ? "bg-orange-50/50"
                            : !row.receiptType
                              ? "bg-red-50/30"
                              : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-600 tabular-nums whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-xs">
                          {row.accountName}
                        </td>
                        <td className="px-4 py-2">
                          {row.description}
                          {row.isPersonal && (
                            <span className="ml-1.5 text-xs text-orange-600 font-medium">
                              店主貸
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                          {Number(row.amount).toLocaleString()}円
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {row.category || "-"}
                        </td>
                        <td className="px-4 py-2">
                          <ReceiptBadge row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ReceiptBadge({ row }: { row: JournalRow }) {
  if (row.receiptType === "scanned" && row.receiptDriveUrl) {
    return (
      <a
        href={row.receiptDriveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
      >
        {row.receiptFileName || "スキャン済"}
      </a>
    );
  }
  if (row.receiptType === "scanned") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        スキャン済
      </span>
    );
  }
  if (row.receiptType === "digital") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        デジタル
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-400">
      未整理
    </span>
  );
}
