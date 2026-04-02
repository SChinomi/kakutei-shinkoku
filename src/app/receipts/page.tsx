import { ReceiptManager } from "@/components/receipt-manager";

export const dynamic = "force-dynamic";

export default function ReceiptsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">レシート</h1>
      <ReceiptManager />
    </div>
  );
}
