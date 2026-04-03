import { db } from "@/db";
import { entities, accounts, transactions, uploads, receipts } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { SetupButton } from "@/components/setup-button";

export const dynamic = "force-dynamic";

type MonthStatus = {
  month: string;
  transactionCount: number;
  hasUpload: boolean;
};

type AccountStatus = {
  accountId: number;
  accountName: string;
  accountType: string;
  months: MonthStatus[];
};

type ReceiptMonth = {
  month: string;
  receiptCount: number;
  ocrItemCount: number;
  matchedCount: number;
};

type EntityCompleteness = {
  entityId: number;
  entityName: string;
  entityType: string;
  fiscalYearEndMonth: number;
  months: string[];
  accounts: AccountStatus[];
  receipts: ReceiptMonth[];
};

async function getCompletenessData(): Promise<{
  connected: boolean;
  hasEntities: boolean;
  year: number;
  completeness: EntityCompleteness[];
}> {
  try {
    const entityList = await db.select().from(entities);
    if (entityList.length === 0) {
      return { connected: true, hasEntities: false, year: 2025, completeness: [] };
    }

    const year = 2025; // Current tax filing year
    const accountList = await db.select().from(accounts).where(eq(accounts.active, true));

    const uploadRows = await db
      .select({
        accountId: uploads.accountId,
        periodFrom: uploads.periodFrom,
        periodTo: uploads.periodTo,
      })
      .from(uploads);

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

    const receiptRows = await db
      .select({
        entityId: receipts.entityId,
        scanDate: receipts.scanDate,
        fileName: receipts.fileName,
        ocrResults: receipts.ocrResults,
      })
      .from(receipts);

    const completeness: EntityCompleteness[] = entityList.map((entity) => {
      const entityAccounts = accountList.filter((a) => a.entityId === entity.id);

      let months: string[];
      if (entity.type === "personal") {
        months = Array.from({ length: 12 }, (_, i) => {
          const m = (i + 1).toString().padStart(2, "0");
          return `${year}-${m}`;
        });
      } else {
        const endMonth = entity.fiscalYearEndMonth;
        months = Array.from({ length: 12 }, (_, i) => {
          const m = ((endMonth + i) % 12) + 1;
          const y = m > endMonth ? year : year + 1;
          return `${y}-${m.toString().padStart(2, "0")}`;
        });
      }

      const accountStatus: AccountStatus[] = entityAccounts.map((acct) => ({
        accountId: acct.id,
        accountName: acct.name,
        accountType: acct.type,
        months: months.map((month) => {
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
        }),
      }));

      const receiptStatus: ReceiptMonth[] = months.map((month) => {
        const monthReceipts = receiptRows.filter((r) => {
          if (r.entityId !== entity.id) return false;
          return r.scanDate.slice(0, 7) === month;
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
        return { month, receiptCount: monthReceipts.length, ocrItemCount, matchedCount };
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

    return { connected: true, hasEntities: true, year, completeness };
  } catch {
    return { connected: false, hasEntities: false, year: 2025, completeness: [] };
  }
}

function CellStatus({ count, hasUpload }: { count: number; hasUpload: boolean }) {
  if (count > 0) {
    return (
      <td className="px-1 py-2 text-center">
        <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium bg-green-100 text-green-800">
          {count}
        </span>
      </td>
    );
  }
  if (hasUpload) {
    return (
      <td className="px-1 py-2 text-center">
        <span className="inline-block w-8 h-6 rounded bg-yellow-100 text-yellow-600 text-xs leading-6">
          0
        </span>
      </td>
    );
  }
  return (
    <td className="px-1 py-2 text-center">
      <span className="inline-block w-8 h-6 rounded bg-red-50 text-red-300 text-xs leading-6">
        --
      </span>
    </td>
  );
}

function ReceiptCell({ data }: { data: ReceiptMonth }) {
  if (data.receiptCount === 0) {
    return (
      <td className="px-1 py-2 text-center">
        <span className="inline-block w-8 h-6 rounded bg-red-50 text-red-300 text-xs leading-6">
          --
        </span>
      </td>
    );
  }
  const allMatched = data.ocrItemCount > 0 && data.matchedCount === data.ocrItemCount;
  return (
    <td className="px-1 py-2 text-center">
      <span
        className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-medium ${
          allMatched
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-700"
        }`}
        title={`${data.receiptCount}ファイル / OCR:${data.ocrItemCount}件 / 突合:${data.matchedCount}件`}
      >
        {data.receiptCount}
      </span>
    </td>
  );
}

export default async function Dashboard() {
  const { connected, hasEntities, year, completeness } = await getCompletenessData();

  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">確定申告システム</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="font-semibold text-yellow-800 mb-2">データベース未接続</h2>
          <p className="text-yellow-700 text-sm mb-4">
            DATABASE_URL 環境変数を設定してください。
          </p>
          <SetupButton />
        </div>
      </div>
    );
  }

  if (!hasEntities) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">確定申告システム</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="font-semibold text-blue-800 mb-2">初期セットアップ</h2>
          <p className="text-blue-700 text-sm mb-4">
            データベースは接続済みです。初期データを作成してください。
          </p>
          <SetupButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">書類完備チェック</h1>
        <span className="text-sm text-gray-500">{year}年度</span>
      </div>

      <div className="text-xs text-gray-500 flex gap-4">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> データあり
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> 一部/要確認
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 未提出
        </span>
      </div>

      {completeness.map((entity) => {
        // Summary stats
        const totalCells = entity.accounts.length * entity.months.length;
        const filledCells = entity.accounts.reduce(
          (sum, acct) => sum + acct.months.filter((m) => m.transactionCount > 0).length,
          0
        );
        const receiptMonths = entity.receipts.filter((r) => r.receiptCount > 0).length;
        const missingAccounts = entity.accounts.flatMap((acct) =>
          acct.months
            .filter((m) => m.transactionCount === 0 && !m.hasUpload)
            .map((m) => ({ account: acct.accountName, month: m.month }))
        );
        const missingReceipts = entity.receipts
          .filter((r) => r.receiptCount === 0)
          .map((r) => r.month);

        return (
          <section
            key={entity.entityId}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <h2 className="font-semibold text-lg">{entity.entityName}</h2>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {entity.entityType === "personal" ? "個人事業" : "法人"}
              </span>
              <span className="text-xs text-gray-400">
                {entity.fiscalYearEndMonth}月決算
              </span>
              <span className="ml-auto text-sm text-gray-500">
                明細 {filledCells}/{totalCells} | レシート {receiptMonths}/{entity.months.length}月
              </span>
            </div>

            {/* Completeness matrix */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="px-4 py-2 text-left font-medium w-40">項目</th>
                    {entity.months.map((m) => (
                      <th key={m} className="px-1 py-2 text-center font-medium w-10">
                        {parseInt(m.split("-")[1], 10)}月
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entity.accounts.map((acct) => (
                    <tr key={acct.accountId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-medium text-gray-700 truncate">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                            acct.accountType === "bank" ? "bg-green-500" : "bg-blue-500"
                          }`}
                        />
                        {acct.accountName}
                      </td>
                      {acct.months.map((m) => (
                        <CellStatus
                          key={m.month}
                          count={m.transactionCount}
                          hasUpload={m.hasUpload}
                        />
                      ))}
                    </tr>
                  ))}
                  {/* Receipt row */}
                  <tr className="hover:bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-2 text-xs font-medium text-gray-700">
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-orange-500" />
                      レシート
                    </td>
                    {entity.receipts.map((r) => (
                      <ReceiptCell key={r.month} data={r} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Missing items summary */}
            {(missingAccounts.length > 0 || missingReceipts.length > 0) && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-100 text-xs text-red-700">
                <p className="font-medium mb-1">不足:</p>
                <ul className="space-y-0.5">
                  {missingAccounts.slice(0, 5).map((item, i) => (
                    <li key={i}>
                      {item.account} — {parseInt(item.month.split("-")[1], 10)}月のCSV未アップロード
                    </li>
                  ))}
                  {missingAccounts.length > 5 && (
                    <li>...他 {missingAccounts.length - 5}件</li>
                  )}
                  {missingReceipts.length > 0 && (
                    <li>
                      レシート未スキャン:{" "}
                      {missingReceipts
                        .map((m) => `${parseInt(m.split("-")[1], 10)}月`)
                        .join("、")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
