"use client";

import { useState, useEffect, useCallback } from "react";

interface MatchCandidate {
  transaction_id: number;
  score: number;
  date_score?: number;
  amount_score?: number;
  store_score?: number;
  date: string;
  description: string;
  amount: string;
  account_name: string;
}

interface OcrItem {
  date: string;
  store: string;
  amount: number;
  matched_transaction_id?: number | null;
  status?: "pending" | "confirmed" | "rejected";
  candidates?: MatchCandidate[];
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

  const [filterEntityId, setFilterEntityId] = useState("");
  const [filterScanDate, setFilterScanDate] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formEntityId, setFormEntityId] = useState("");
  const [formDriveInput, setFormDriveInput] = useState("");
  const [formFileName, setFormFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const DRIVE_FOLDER_URL =
    process.env.NEXT_PUBLIC_DRIVE_RECEIPT_FOLDER_URL || "";

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

  function parseDriveFileId(input: string): string {
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return input.trim();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setUploadError("");
    try {
      const driveFileId = parseDriveFileId(formDriveInput);
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: parseInt(formEntityId, 10),
          driveFileId,
          fileName: formFileName,
          scanDate: new Date().toISOString().slice(0, 10),
        }),
      });
      if (res.ok) {
        setFormDriveInput("");
        setFormFileName("");
        setShowForm(false);
        fetchReceipts();
      } else {
        const data = await res.json();
        setUploadError(data.error || "登録に失敗しました");
      }
    } catch (err) {
      setUploadError(String(err));
    }
    setSubmitting(false);
  }

  async function handleMatch(receiptId: number) {
    const res = await fetch(`/api/receipts/${receiptId}/match`, {
      method: "POST",
    });
    if (res.ok) fetchReceipts();
  }

  async function handleConfirm(
    receiptId: number,
    itemIndex: number,
    status: "confirmed" | "rejected",
    transactionId?: number
  ) {
    const body: Record<string, unknown> = { itemIndex, status };
    if (transactionId) body.transactionId = transactionId;
    const res = await fetch(`/api/receipts/${receiptId}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) fetchReceipts();
  }

  async function handleBatchConfirm(receipt: Receipt) {
    if (!receipt.ocrResults) return;
    const items = receipt.ocrResults
      .map((item, i) => ({ itemIndex: i, item }))
      .filter(
        ({ item }) =>
          item.matched_transaction_id &&
          item.status !== "confirmed" &&
          item.status !== "rejected"
      )
      .map(({ itemIndex, item }) => ({
        itemIndex,
        status: "confirmed" as const,
        transactionId: item.matched_transaction_id!,
      }));
    if (items.length === 0) return;
    const res = await fetch(`/api/receipts/${receipt.id}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) fetchReceipts();
  }

  function ocrSummary(ocrResults: OcrItem[] | null) {
    if (!ocrResults || ocrResults.length === 0)
      return { total: 0, matched: 0, confirmed: 0, rejected: 0, pendingWithMatch: 0 };
    const matched = ocrResults.filter((r) => r.matched_transaction_id).length;
    const confirmed = ocrResults.filter((r) => r.status === "confirmed").length;
    const rejected = ocrResults.filter((r) => r.status === "rejected").length;
    const pendingWithMatch = ocrResults.filter(
      (r) =>
        r.matched_transaction_id &&
        r.status !== "confirmed" &&
        r.status !== "rejected"
    ).length;
    return { total: ocrResults.length, matched, confirmed, rejected, pendingWithMatch };
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">事業体</label>
          <select
            value={filterEntityId}
            onChange={(e) => setFilterEntityId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="">すべて</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">スキャン月</label>
          <input
            type="month"
            value={filterScanDate}
            onChange={(e) =>
              setFilterScanDate(e.target.value ? e.target.value + "-01" : "")
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
          <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              1. Driveにスキャン済PDFをアップロード → 2. URLを貼って登録
            </p>
            {DRIVE_FOLDER_URL && (
              <a
                href={DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                Driveフォルダを開く
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">事業体</label>
              <select
                value={formEntityId}
                onChange={(e) => setFormEntityId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="">選択...</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Drive URL / ファイルID</label>
              <input
                type="text"
                value={formDriveInput}
                onChange={(e) => setFormDriveInput(e.target.value)}
                placeholder="Drive URLを貼り付け"
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ファイル名</label>
              <input
                type="text"
                value={formFileName}
                onChange={(e) => setFormFileName(e.target.value)}
                placeholder="receipts_202602.pdf"
                required
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
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
        <div className="space-y-3">
          {receipts.map((r) => {
            const summary = ocrSummary(r.ocrResults);
            const isExpanded = expandedId === r.id;
            return (
              <ReceiptCard
                key={r.id}
                receipt={r}
                summary={summary}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : r.id)}
                onMatch={() => handleMatch(r.id)}
                onConfirm={(idx, status, txnId) =>
                  handleConfirm(r.id, idx, status, txnId)
                }
                onBatchConfirm={() => handleBatchConfirm(r)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ScoreBreakdown({ c }: { c: MatchCandidate }) {
  if (c.date_score === undefined) return <ScoreBadge score={c.score} />;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <ScoreBadge score={c.score} />
      <span className="text-gray-400" title="日付/金額/店名">
        ({c.date_score}/{c.amount_score}/{c.store_score})
      </span>
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const bg =
    score >= 80
      ? "bg-green-100 text-green-700"
      : score >= 50
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bg}`}
    >
      {score}点
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          OK
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          NG
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          未確認
        </span>
      );
  }
}

function ReceiptCard({
  receipt,
  summary,
  isExpanded,
  onToggle,
  onMatch,
  onConfirm,
  onBatchConfirm,
}: {
  receipt: Receipt;
  summary: {
    total: number;
    matched: number;
    confirmed: number;
    rejected: number;
    pendingWithMatch: number;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onMatch: () => void;
  onConfirm: (
    itemIndex: number,
    status: "confirmed" | "rejected",
    transactionId?: number
  ) => void;
  onBatchConfirm: () => void;
}) {
  const [selectedCandidates, setSelectedCandidates] = useState<
    Record<number, number>
  >({});

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <a
          href={receipt.driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {receipt.fileName}
        </a>
        <span className="text-xs text-gray-500">{receipt.entityName}</span>
        <span className="text-xs text-gray-500">
          {receipt.scanDate.slice(0, 7)}
        </span>

        {summary.total > 0 && (
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            {summary.confirmed > 0 && (
              <span className="text-green-600 font-medium">
                OK:{summary.confirmed}
              </span>
            )}
            {summary.rejected > 0 && (
              <span className="text-red-600 font-medium">
                NG:{summary.rejected}
              </span>
            )}
            {summary.total - summary.confirmed - summary.rejected > 0 && (
              <span className="text-gray-400">
                未:{summary.total - summary.confirmed - summary.rejected}
              </span>
            )}
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-gray-500">{summary.total}件</span>
          </div>
        )}

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {summary.total > 0 && (
            <button
              onClick={onMatch}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              突合実行
            </button>
          )}
          <span className="text-xs text-gray-400">
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Expanded: Split view — PDF left, OCR items right */}
      {isExpanded && receipt.ocrResults && (
        <div className="border-t border-gray-200">
          {/* Batch confirm bar */}
          {summary.pendingWithMatch > 0 && (
            <div className="flex items-center gap-3 mx-4 mt-3 bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
              <span className="text-sm text-blue-800">
                マッチ済み未確認: {summary.pendingWithMatch}件
              </span>
              <button
                onClick={onBatchConfirm}
                className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                全てOK
              </button>
            </div>
          )}

          <div className="flex gap-0 min-h-[400px]">
            {/* Left: PDF Preview */}
            <div className="w-2/5 border-r border-gray-200 p-3">
              <iframe
                src={`https://drive.google.com/file/d/${receipt.driveFileId}/preview`}
                className="w-full h-full rounded border border-gray-200"
                style={{ minHeight: "380px" }}
                title={receipt.fileName}
              />
            </div>

            {/* Right: OCR items + candidates */}
            <div className="w-3/5 p-3 overflow-y-auto">
              <div className="space-y-2">
                {receipt.ocrResults.map((item, i) => {
                  const selectedTxnId =
                    selectedCandidates[i] ?? item.matched_transaction_id;
                  const hasCandidates =
                    item.candidates && item.candidates.length > 0;

                  return (
                    <div
                      key={i}
                      className={`border rounded-lg p-3 text-xs ${
                        item.status === "confirmed"
                          ? "border-green-200 bg-green-50/50"
                          : item.status === "rejected"
                            ? "border-red-200 bg-red-50/30"
                            : item.matched_transaction_id
                              ? "border-blue-200 bg-blue-50/30"
                              : "border-gray-200"
                      }`}
                    >
                      {/* OCR result header */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">
                          {item.store}
                        </span>
                        <span className="tabular-nums font-medium">
                          {Number(item.amount).toLocaleString()}円
                        </span>
                        <span className="text-gray-500">{item.date}</span>
                        <StatusBadge status={item.status} />
                        <div className="flex gap-1 ml-auto">
                          {item.status !== "confirmed" && (
                            <button
                              onClick={() =>
                                onConfirm(
                                  i,
                                  "confirmed",
                                  selectedTxnId ?? undefined
                                )
                              }
                              disabled={
                                !item.matched_transaction_id && !selectedTxnId
                              }
                              className="px-2 py-0.5 rounded font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              OK
                            </button>
                          )}
                          {item.status !== "rejected" && (
                            <button
                              onClick={() => onConfirm(i, "rejected")}
                              className="px-2 py-0.5 rounded font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              NG
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Candidates */}
                      {hasCandidates ? (
                        <div className="space-y-1 ml-2">
                          {item.candidates!.map((c) => (
                            <label
                              key={c.transaction_id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                                selectedTxnId === c.transaction_id
                                  ? "bg-blue-100/70 border border-blue-300"
                                  : "hover:bg-gray-100 border border-transparent"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`candidate-${receipt.id}-${i}`}
                                checked={selectedTxnId === c.transaction_id}
                                onChange={() =>
                                  setSelectedCandidates((prev) => ({
                                    ...prev,
                                    [i]: c.transaction_id,
                                  }))
                                }
                                className="accent-blue-600"
                              />
                              <span className="text-gray-500">{c.date}</span>
                              <span className="truncate max-w-52 text-gray-800">
                                {c.description}
                              </span>
                              <span className="tabular-nums whitespace-nowrap font-medium">
                                {Number(c.amount).toLocaleString()}円
                              </span>
                              <span className="text-gray-400 text-[10px]">
                                {c.account_name}
                              </span>
                              <span className="ml-auto">
                                <ScoreBreakdown c={c} />
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : item.matched_transaction_id ? (
                        <p className="text-gray-500 ml-2">
                          ID:{item.matched_transaction_id}
                        </p>
                      ) : (
                        <p className="text-amber-600 ml-2">
                          候補なし — 現金払い？
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
