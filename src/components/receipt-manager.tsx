"use client";

import { useState, useEffect, useCallback } from "react";

interface OcrItem {
  date: string;
  store: string;
  amount: number;
  matched_transaction_id?: number | null;
}

interface Receipt {
  id: number;
  entityId: number;
  entityName: string;
  driveFileId: string;
  driveUrl: string;
  fileName: string;
  scanDate: string;
  ocrResults: OcrItem[] | null;
  createdAt: string;
}

interface Entity {
  id: number;
  name: string;
  type: string;
}

export function ReceiptManager() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [filterEntityId, setFilterEntityId] = useState("");
  const [filterScanDate, setFilterScanDate] = useState("");

  // Registration form
  const [showForm, setShowForm] = useState(false);
  const [formEntityId, setFormEntityId] = useState("");
  const [formDriveInput, setFormDriveInput] = useState("");
  const [formFileName, setFormFileName] = useState("");
  const [formScanDate, setFormScanDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEntities = useCallback(async () => {
    const res = await fetch("/api/entities");
    if (res.ok) setEntities(await res.json());
  }, []);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterEntityId) params.set("entityId", filterEntityId);
    if (filterScanDate) params.set("scanDate", filterScanDate);

    const res = await fetch(`/api/receipts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setReceipts(data.receipts);
    }
    setLoading(false);
  }, [filterEntityId, filterScanDate]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Extract Drive file ID from URL or raw ID
  function parseDriveFileId(input: string): string {
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // Assume raw file ID
    return input.trim();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const driveFileId = parseDriveFileId(formDriveInput);

    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId: parseInt(formEntityId, 10),
        driveFileId,
        fileName: formFileName,
        scanDate: formScanDate,
      }),
    });

    if (res.ok) {
      setFormDriveInput("");
      setFormFileName("");
      setFormScanDate("");
      setShowForm(false);
      fetchReceipts();
    }
    setSubmitting(false);
  }

  async function handleMatch(receiptId: number) {
    const res = await fetch(`/api/receipts/${receiptId}/match`, {
      method: "POST",
    });
    if (res.ok) {
      fetchReceipts();
    }
  }

  function ocrSummary(ocrResults: OcrItem[] | null) {
    if (!ocrResults || ocrResults.length === 0)
      return { total: 0, matched: 0 };
    const matched = ocrResults.filter(
      (r) => r.matched_transaction_id
    ).length;
    return { total: ocrResults.length, matched };
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            事業体
          </label>
          <select
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="">すべて</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            スキャン月
          </label>
          <input
            type="month"
            value={filterScanDate}
            onChange={(e) =>
              setFilterScanDate(
                e.target.value ? e.target.value + "-01" : ""
              )
            }
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          {showForm ? "キャンセル" : "レシート登録"}
        </button>
      </div>

      {/* Registration Form */}
      {showForm && (
        <form
          onSubmit={handleRegister}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                事業体
              </label>
              <select
                value={formEntityId}
                onChange={(e) => setFormEntityId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="">選択...</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                スキャン対象月
              </label>
              <input
                type="month"
                value={formScanDate.slice(0, 7)}
                onChange={(e) =>
                  setFormScanDate(
                    e.target.value ? e.target.value + "-01" : ""
                  )
                }
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Drive ファイルID / URL
              </label>
              <input
                type="text"
                value={formDriveInput}
                onChange={(e) => setFormDriveInput(e.target.value)}
                placeholder="ファイルID or Google Drive URL"
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                ファイル名
              </label>
              <input
                type="text"
                value={formFileName}
                onChange={(e) => setFormFileName(e.target.value)}
                placeholder="receipt_202601.pdf"
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {submitting ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      )}

      {/* Receipt List */}
      {loading ? (
        <p className="text-gray-500 text-sm">読み込み中...</p>
      ) : receipts.length === 0 ? (
        <p className="text-gray-500 text-sm">
          レシートがありません。「レシート登録」から追加してください。
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  ファイル名
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  事業体
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  スキャン月
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  OCR
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  突合
                </th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => {
                const { total, matched } = ocrSummary(r.ocrResults);
                const isExpanded = expandedId === r.id;
                return (
                  <ReceiptRow
                    key={r.id}
                    receipt={r}
                    total={total}
                    matched={matched}
                    isExpanded={isExpanded}
                    onToggle={() =>
                      setExpandedId(isExpanded ? null : r.id)
                    }
                    onMatch={() => handleMatch(r.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({
  receipt,
  total,
  matched,
  isExpanded,
  onToggle,
  onMatch,
}: {
  receipt: Receipt;
  total: number;
  matched: number;
  isExpanded: boolean;
  onToggle: () => void;
  onMatch: () => void;
}) {
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-2">
          <a
            href={receipt.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {receipt.fileName}
          </a>
        </td>
        <td className="px-4 py-2 text-gray-600">
          {receipt.entityName}
        </td>
        <td className="px-4 py-2 text-gray-600">
          {receipt.scanDate.slice(0, 7)}
        </td>
        <td className="px-4 py-2">
          {total > 0 ? (
            <span className="text-gray-700">{total}件</span>
          ) : (
            <span className="text-gray-400">未登録</span>
          )}
        </td>
        <td className="px-4 py-2">
          {total > 0 ? (
            <span
              className={
                matched === total
                  ? "text-green-600 font-medium"
                  : "text-amber-600"
              }
            >
              {matched}/{total}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-2 space-x-2">
          {total > 0 && (
            <>
              <button
                onClick={onToggle}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                {isExpanded ? "閉じる" : "詳細"}
              </button>
              {matched < total && (
                <button
                  onClick={onMatch}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  突合実行
                </button>
              )}
            </>
          )}
        </td>
      </tr>
      {isExpanded && receipt.ocrResults && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-gray-50">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1 pr-4">日付</th>
                  <th className="text-left py-1 pr-4">店名</th>
                  <th className="text-right py-1 pr-4">金額</th>
                  <th className="text-left py-1">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {receipt.ocrResults.map((item, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-1 pr-4">{item.date}</td>
                    <td className="py-1 pr-4">{item.store}</td>
                    <td className="py-1 pr-4 text-right">
                      {Number(item.amount).toLocaleString()}円
                    </td>
                    <td className="py-1">
                      {item.matched_transaction_id ? (
                        <a
                          href={`/transactions?search=${encodeURIComponent(item.store)}`}
                          className="text-green-600 hover:underline"
                        >
                          突合済 (ID:{item.matched_transaction_id})
                        </a>
                      ) : (
                        <span className="text-amber-600">
                          未突合
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
