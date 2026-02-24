import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import {
  normalizeStudySheet,
  type PurchaseDoc,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

type PurchasedResponse = {
  purchaseId: number;
  purchasedAt: Date;
  amountCents: number;
  studySheet: ReturnType<typeof normalizeStudySheet> extends infer T
    ? Exclude<T, null>
    : never;
};

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const db = getDb();
    const purchases = db.collection<PurchaseDoc>("purchases");
    const studySheets = db.collection<StudySheetDoc>("study_sheets");

    const rows = await purchases
      .find({ buyerId: currentUser.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const response: PurchasedResponse[] = [];
    for (const row of rows) {
      if (
        typeof row.id !== "number" ||
        !Number.isInteger(row.id) ||
        row.id <= 0 ||
        !(row.createdAt instanceof Date) ||
        typeof row.amountCents !== "number" ||
        !Number.isFinite(row.amountCents) ||
        !Number.isInteger(row.amountCents) ||
        row.amountCents < 0 ||
        typeof row.studySheetId !== "number" ||
        !Number.isInteger(row.studySheetId) ||
        row.studySheetId <= 0
      ) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }

      const studySheet = await studySheets.findOne({ id: row.studySheetId });
      if (!studySheet) {
        continue;
      }

      const normalizedStudySheet = normalizeStudySheet(studySheet);
      if (!normalizedStudySheet) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }

      response.push({
        purchaseId: row.id,
        purchasedAt: row.createdAt,
        amountCents: row.amountCents,
        studySheet: normalizedStudySheet,
      });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
