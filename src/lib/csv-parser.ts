import { CSVFormat } from "./csv-formats";

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  balance?: number;
  foreignAmount?: number;
  exchangeRate?: number;
  memo?: string;
  rawLine: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseAmount(value: string): number {
  if (!value || value.trim() === "") return 0;
  // カンマ区切りの数値、マイナス記号対応
  const cleaned = value.replace(/,/g, "").replace(/"/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseDate(value: string): string {
  // YYYY/MM/DD → YYYY-MM-DD
  const cleaned = value.trim().replace(/\//g, "-");
  // Validate format
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return cleaned;
}

export function parseCSV(
  content: string,
  format: CSVFormat
): ParsedTransaction[] {
  const lines = content.split("\n").filter((line) => line.trim() !== "");
  const startIndex = format.hasHeader ? 1 : 0;
  const transactions: ParsedTransaction[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const fields = parseCSVLine(line);

    if (fields.length < 3) continue; // skip malformed lines

    const dateStr = parseDate(fields[format.dateColumn] || "");
    const description = (
      fields[format.descriptionColumn] || ""
    ).trim();

    if (!dateStr || !description) continue;

    let amount: number;
    if (format.amountColumn !== undefined) {
      // カード明細: 単一金額列
      amount = parseAmount(fields[format.amountColumn]);
    } else {
      // 銀行明細: 出金/入金 別列
      const withdrawal = parseAmount(
        fields[format.withdrawalColumn ?? -1] || ""
      );
      const deposit = parseAmount(
        fields[format.depositColumn ?? -1] || ""
      );
      amount = deposit > 0 ? deposit : -withdrawal;
    }

    const txn: ParsedTransaction = {
      date: dateStr,
      description,
      amount,
      rawLine: line,
    };

    if (format.balanceColumn !== undefined && fields[format.balanceColumn]) {
      txn.balance = parseAmount(fields[format.balanceColumn]);
    }
    if (
      format.foreignAmountColumn !== undefined &&
      fields[format.foreignAmountColumn]
    ) {
      txn.foreignAmount = parseAmount(fields[format.foreignAmountColumn]);
    }
    if (
      format.exchangeRateColumn !== undefined &&
      fields[format.exchangeRateColumn]
    ) {
      txn.exchangeRate = parseAmount(fields[format.exchangeRateColumn]);
    }
    if (format.memoColumn !== undefined && fields[format.memoColumn]) {
      txn.memo = fields[format.memoColumn].trim() || undefined;
    }

    transactions.push(txn);
  }

  return transactions;
}
