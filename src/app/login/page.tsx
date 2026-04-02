import { LoginForm } from "@/components/login-form";
import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if (await verifyAuth()) {
    redirect("/");
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-6">ログイン</h1>
        <LoginForm />
      </div>
    </div>
  );
}
