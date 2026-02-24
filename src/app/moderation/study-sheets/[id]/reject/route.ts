import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { moderateStudySheet } from "@/modules/study-sheets/moderation";
import { rejectStudySheetBodySchema } from "@/modules/study-sheets/moderation-schemas";
import {
  normalizeStudySheet,
  parsePositiveInt,
} from "@/modules/study-sheets/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(
  req: NextRequest,
  { params }: Ctx,
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { id } = await params;
    if (process.env.NODE_ENV !== "production") {
      console.log({
        route: `${req.method} ${new URL(req.url).pathname}`,
        params: { id },
      });
    }
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, rejectStudySheetBodySchema);

    const updated = await withTransaction(async (session, db) =>
      moderateStudySheet(db, session, {
        studySheetId,
        actorId: currentUser.userId,
        status: "REJECTED",
        reason: body.reason,
      }),
    );

    const response = normalizeStudySheet(updated);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
