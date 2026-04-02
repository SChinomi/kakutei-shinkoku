import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts, entities } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// POST /api/receipts — Register a receipt
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entityId, driveFileId, fileName, scanDate } = body as {
    entityId: number;
    driveFileId: string;
    fileName: string;
    scanDate: string;
  };

  if (!entityId || !driveFileId || !fileName || !scanDate) {
    return NextResponse.json(
      { error: "entityId, driveFileId, fileName, scanDate are required" },
      { status: 400 }
    );
  }

  const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

  const [receipt] = await db
    .insert(receipts)
    .values({
      entityId,
      driveFileId,
      driveUrl,
      fileName,
      scanDate,
    })
    .returning();

  return NextResponse.json({ receipt }, { status: 201 });
}

// GET /api/receipts — List receipts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get("entityId");
  const scanDate = searchParams.get("scanDate");

  const conditions = [];

  if (entityId) {
    conditions.push(eq(receipts.entityId, parseInt(entityId, 10)));
  }
  if (scanDate) {
    conditions.push(eq(receipts.scanDate, scanDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: receipts.id,
      entityId: receipts.entityId,
      entityName: entities.name,
      driveFileId: receipts.driveFileId,
      driveUrl: receipts.driveUrl,
      fileName: receipts.fileName,
      scanDate: receipts.scanDate,
      ocrResults: receipts.ocrResults,
      createdAt: receipts.createdAt,
    })
    .from(receipts)
    .innerJoin(entities, eq(receipts.entityId, entities.id))
    .where(where)
    .orderBy(desc(receipts.createdAt));

  return NextResponse.json({ receipts: rows });
}
