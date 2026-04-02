"use client";

import { useState, useEffect } from "react";

interface Entity {
  id: number;
  name: string;
  type: string;
  accounts: Array<{
    id: number;
    name: string;
    type: string;
    csvFormatId: string;
    active: boolean;
  }>;
}

export function UploadForm() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accountId, setAccountId] = useState("");
  const [csvFormatId, setCsvFormatId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    total: number;
    periodFrom: string;
    periodTo: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then((data) => setEntities(data))
      .catch(() => {});
  }, []);

  const allAccounts = entities.flatMap((e) =>
    e.accounts.map((a) => ({ ...a, entityName: e.name }))
  );

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    const acct = allAccounts.find((a) => a.id.toString() === id);
    if (acct) setCsvFormatId(acct.csvFormatId);
  };

  const handleUpload = async () => {
    if (!file || !accountId || !csvFormatId) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    formData.append("csvFormatId", csvFormatId);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        setResult(data);
        setFile(null);
      }
    } catch (e) {
      setError(`Error: ${e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            口座を選択
          </label>
          <select
            value={accountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">選択してください</option>
            {entities.map((entity) => (
              <optgroup key={entity.id} label={entity.name}>
                {entity.accounts.map((acct) => (
                  <option
                    key={acct.id}
                    value={acct.id}
                    disabled={!acct.active}
                  >
                    {acct.name}
                    {acct.type === "bank" ? "（銀行）" : "（カード）"}
                    {!acct.active ? " [無効]" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSVファイル
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-400 mt-1">
            Shift-JIS / UTF-8 どちらのエンコーディングにも対応しています
          </p>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || !accountId || uploading}
          className="w-full bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "アップロード中..." : "アップロード"}
        </button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 text-sm mb-2">
            アップロード完了
          </h3>
          <div className="text-sm text-green-700 space-y-1">
            <p>取込: {result.inserted}件 / 全{result.total}件</p>
            {result.skipped > 0 && (
              <p>スキップ（重複）: {result.skipped}件</p>
            )}
            <p>
              期間: {result.periodFrom} ~ {result.periodTo}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
