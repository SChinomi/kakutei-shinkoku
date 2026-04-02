import { db } from "@/db";
import { entities, accounts, transactions } from "@/db/schema";
import { eq, sql, min, max } from "drizzle-orm";
import { SetupButton } from "@/components/setup-button";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const entityList = await db.select().from(entities);

    const stats = await db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        accountType: accounts.type,
        entityId: accounts.entityId,
        entityName: entities.name,
        active: accounts.active,
        txnCount: sql<number>`count(${transactions.id})`,
        minDate: min(transactions.date),
        maxDate: max(transactions.date),
        personalCount: sql<number>`count(case when ${transactions.isPersonal} then 1 end)`,
      })
      .from(accounts)
      .innerJoin(entities, eq(accounts.entityId, entities.id))
      .leftJoin(transactions, eq(accounts.id, transactions.accountId))
      .groupBy(
        accounts.id,
        accounts.name,
        accounts.type,
        accounts.entityId,
        entities.name,
        accounts.active
      )
      .orderBy(accounts.entityId, accounts.id);

    return { entityList, stats, connected: true };
  } catch {
    return { entityList: [], stats: [], connected: false };
  }
}

export default async function Dashboard() {
  const { entityList, stats, connected } = await getDashboardData();

  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">確定申告システム</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="font-semibold text-yellow-800 mb-2">
            データベース未接続
          </h2>
          <p className="text-yellow-700 text-sm mb-4">
            DATABASE_URL 環境変数を設定してください。Neon
            PostgreSQLの接続文字列が必要です。
          </p>
          <SetupButton />
        </div>
      </div>
    );
  }

  if (entityList.length === 0) {
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

  // Group stats by entity
  const byEntity = new Map<number, typeof stats>();
  for (const s of stats) {
    const list = byEntity.get(s.entityId) || [];
    list.push(s);
    byEntity.set(s.entityId, list);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {entityList.map((entity) => (
        <section
          key={entity.id}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <h2 className="font-semibold text-lg">{entity.name}</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {entity.type === "personal" ? "個人事業" : "法人"}
            </span>
            <span className="text-xs text-gray-400">
              {entity.fiscalYearEndMonth}月決算
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {(byEntity.get(entity.id) || []).map((acct) => (
              <div
                key={acct.accountId}
                className={`px-6 py-3 flex items-center justify-between ${!acct.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${acct.accountType === "bank" ? "bg-green-500" : "bg-blue-500"}`}
                  />
                  <span className="font-medium text-sm">
                    {acct.accountName}
                  </span>
                  {!acct.active && (
                    <span className="text-xs text-gray-400">無効</span>
                  )}
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  {Number(acct.txnCount) > 0 ? (
                    <>
                      <span>{acct.txnCount}件</span>
                      <span>
                        {acct.minDate} ~ {acct.maxDate}
                      </span>
                      {Number(acct.personalCount) > 0 && (
                        <span className="text-orange-600">
                          店主貸 {acct.personalCount}件
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">データなし</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
