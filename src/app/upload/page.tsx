import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CSVアップロード</h1>
      <UploadForm />
    </div>
  );
}
