import { db } from "@/db";
import { entities, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getData() {
  try {
    const entityList = await db.select().from(entities);
    const accountList = await db
      .select({
        id: accounts.id,
        entityId: accounts.entityId,
        name: accounts.name,
        type: accounts.type,
        csvFormatId: accounts.csvFormatId,
        active: accounts.active,
      })
      .from(accounts)
      .orderBy(accounts.entityId, accounts.id);

    return { entityList, accountList, connected: true };
  } catch {
    return { entityList: [], accountList: [], connected: false };
  }
}

export default async function SettingsPage() {
  const { entityList, accountList, connected } = await getData();

  if (!connected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-gray-500">データベースに接続できません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">設定</h1>

      {entityList.map((entity) => (
        <section
          key={entity.id}
          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold">{entity.name}</h2>
            <p className="text-sm text-gray-500">
              {entity.type === "personal" ? "個人事業" : "法人"} /{" "}
              {entity.fiscalYearEndMonth}月決算
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {accountList
              .filter((a) => a.entityId === entity.id)
              .map((acct) => (
                <div
                  key={acct.id}
                  className={`px-6 py-3 flex items-center justify-between ${!acct.active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${acct.type === "bank" ? "bg-green-500" : "bg-blue-500"}`}
                    />
                    <span className="text-sm font-medium">{acct.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{acct.csvFormatId}</span>
                    <span>
                      {acct.active ? "有効" : "無効"}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
