import { TransactionViewer } from "@/components/transaction-viewer";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">明細</h1>
      <TransactionViewer />
    </div>
  );
}
