"use client";

import { useState, useEffect, useCallback } from "react";

interface Transaction {
  id: number;
  accountId: number;
  accountName: string;
  accountType: string;
  entityName: string;
  date: string;
  description: string;
  amount: string;
  balance: string | null;
  foreignAmount: string | null;
  exchangeRate: string | null;
  memo: string | null;
  category: string | null;
  isPersonal: boolean;
}

interface Entity {
  id: number;
  name: string;
  type: string;
  accounts: Array<{
    id: number;
    name: string;
    type: string;
    active: boolean;
  }>;
}

export function TransactionViewer() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filters
  const [entityId, setEntityId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [personalOnly, setPersonalOnly] = useState(false);

  const fetchEntities = useCallback(async () => {
    const res = await fetch("/api/entities");
    if (res.ok) setEntities(await res.json());
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityId) params.set("entityId", entityId);
    if (accountId) params.set("accountId", accountId);
    if (search) params.set("search", search);
    if (personalOnly) params.set("personalOnly", "true");
    params.set("page", page.toString());
    params.set("limit", "100");

    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
    setLoading(false);
  }, [entityId, accountId, search, personalOnly, page]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const markPersonal = async (isPersonal: boolean) => {
    if (selectedIds.size === 0) return;
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        isPersonal,
        memo: isPersonal ? "店主貸" : null,
      }),
    });
    setSelectedIds(new Set());
    fetchTransactions();
  };

  const updateMemo = async (id: number, memo: string) => {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], memo: memo || null }),
    });
    fetchTransactions();
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString("ja-JP");
  };

  const totalPages = Math.ceil(total / 100);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={entityId}
          onChange={(e) => {
            setEntityId(e.target.value);
            setAccountId("");
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">全事業体</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">全口座</option>
          {entities
            .filter((e) => !entityId || e.id.toString() === entityId)
            .flatMap((e) => e.accounts)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>

        <input
          type="text"
          placeholder="検索..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-48"
        />

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={personalOnly}
            onChange={(e) => {
              setPersonalOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded"
          />
          店主貸のみ
        </label>

        <span className="text-sm text-gray-400 ml-auto">
          {total}件
        </span>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
          <span className="text-sm text-blue-700">
            {selectedIds.size}件選択中
          </span>
          <button
            onClick={() => markPersonal(true)}
            className="text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
          >
            店主貸にする
          </button>
          <button
            onClick={() => markPersonal(false)}
            className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
          >
            店主貸を解除
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={
                      transactions.length > 0 &&
                      selectedIds.size === transactions.length
                    }
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">
                  日付
                </th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">
                  口座
                </th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">
                  内容
                </th>
                <th className="px-3 py-2 text-right text-gray-600 font-medium">
                  金額
                </th>
                <th className="px-3 py-2 text-left text-gray-600 font-medium">
                  メモ
                </th>
                <th className="px-3 py-2 text-center text-gray-600 font-medium w-16">
                  区分
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    読み込み中...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    データがありません
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className={`hover:bg-gray-50 ${txn.isPersonal ? "bg-orange-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(txn.id)}
                        onChange={() => toggleSelect(txn.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {txn.date}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-500">
                        {txn.accountName}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">
                      {txn.description}
                      {txn.foreignAmount && (
                        <span className="text-xs text-gray-400 ml-2">
                          {parseFloat(txn.foreignAmount).toFixed(2)} @
                          {txn.exchangeRate}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right whitespace-nowrap font-mono ${parseFloat(txn.amount) < 0 ? "text-red-600" : ""}`}
                    >
                      {formatAmount(txn.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={txn.memo || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (txn.memo || "")) {
                            updateMemo(txn.id, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        placeholder="..."
                        className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none text-sm px-1 py-0.5"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {txn.isPersonal && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                          私用
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-30"
          >
            前
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-30"
          >
            次
          </button>
        </div>
      )}
    </div>
  );
}
