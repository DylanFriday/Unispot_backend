import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import {
  normalizeStudySheet,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const db = getDb();
    const studySheets = db.collection<StudySheetDoc>("study_sheets");
    const rows = await studySheets
      .find({ ownerId: currentUser.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const response = [];
    for (const row of rows) {
      const normalized = normalizeStudySheet(row);
      if (!normalized) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      response.push(normalized);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
