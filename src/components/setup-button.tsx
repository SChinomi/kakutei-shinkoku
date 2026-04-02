"use client";

import { useState } from "react";

export function SetupButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSetup() {
    setLoading(true);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      setResult(data.message || JSON.stringify(data));
      if (res.ok) {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSetup}
        disabled={loading}
        className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "セットアップ中..." : "データベースを初期化"}
      </button>
      {result && (
        <p className="mt-2 text-sm text-gray-600">{result}</p>
      )}
    </div>
  );
}
