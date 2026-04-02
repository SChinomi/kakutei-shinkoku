import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entityId, name, type, csvFormatId, active } = body;

  const [account] = await db
    .insert(accounts)
    .values({
      entityId,
      name,
      type,
      csvFormatId,
      active: active ?? true,
    })
    .returning();

  return NextResponse.json(account);
}
