import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, db: "connected" }, { status: 200 });
  } catch {
    return apiError(500, "Database connection failed", "Internal Server Error");
  }
}
