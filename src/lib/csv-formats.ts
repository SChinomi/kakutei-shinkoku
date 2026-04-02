// CSVフォーマット定義
// 配布時にはユーザーが追加可能にする想定

export interface CSVColumn {
  index: number;
  name: string;
}

export interface CSVFormat {
  id: string;
  name: string;
  type: "bank" | "card";
  encoding: "utf-8" | "shift_jis";
  hasHeader: boolean;
  // 列マッピング
  dateColumn: number; // 日付列（YYYY/MM/DD形式の場合）
  dateMonthColumn?: number; // 月列（年月日が分割されている場合）
  dateDayColumn?: number; // 日列（年月日が分割されている場合）
  descriptionColumn: number;
  amountColumn?: number; // カード明細: 単一金額列
  withdrawalColumn?: number; // 銀行: 出金列
  depositColumn?: number; // 銀行: 入金列
  balanceColumn?: number;
  foreignAmountColumn?: number;
  exchangeRateColumn?: number;
  memoColumn?: number;
  // 金額の解釈
  amountIsNegativeForCredit?: boolean; // 返金等が負数か
}

export const CSV_FORMATS: CSVFormat[] = [
  {
    id: "paypay-bank",
    name: "PayPay銀行",
    type: "bank",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0, // 年
    dateMonthColumn: 1, // 月
    dateDayColumn: 2, // 日
    descriptionColumn: 7, // 摘要
    withdrawalColumn: 8, // お支払金額
    depositColumn: 9, // お預り金額
    balanceColumn: 10, // 残高
    memoColumn: 11, // メモ
  },
  {
    id: "amex",
    name: "アメリカン・エキスプレス",
    type: "card",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0, // ご利用日
    descriptionColumn: 2, // ご利用内容
    amountColumn: 3, // 金額
    foreignAmountColumn: 4,
    exchangeRateColumn: 5,
  },
  {
    id: "recruit-card",
    name: "リクルートカード",
    type: "card",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0,
    descriptionColumn: 1,
    amountColumn: 2,
  },
  {
    id: "nakaei-shinkin",
    name: "中栄信用金庫",
    type: "bank",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0,
    descriptionColumn: 1,
    withdrawalColumn: 2,
    depositColumn: 3,
    balanceColumn: 4,
  },
  {
    id: "sbi-net",
    name: "住信SBIネット銀行",
    type: "bank",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0,
    descriptionColumn: 1,
    withdrawalColumn: 2,
    depositColumn: 3,
    balanceColumn: 4,
  },
  {
    id: "gmo-aozora",
    name: "GMOあおぞらネット銀行",
    type: "bank",
    encoding: "shift_jis",
    hasHeader: true,
    dateColumn: 0,
    descriptionColumn: 1,
    withdrawalColumn: 2,
    depositColumn: 3,
    balanceColumn: 4,
  },
  {
    id: "upsider",
    name: "UPSIDER",
    type: "card",
    encoding: "utf-8",
    hasHeader: true,
    dateColumn: 0,
    descriptionColumn: 1,
    amountColumn: 2,
  },
];

export function getFormat(id: string): CSVFormat | undefined {
  return CSV_FORMATS.find((f) => f.id === id);
}
