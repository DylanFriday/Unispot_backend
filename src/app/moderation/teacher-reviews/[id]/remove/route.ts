import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { teacherReviewModerationRemoveBodySchema } from "@/modules/teacher-reviews/schemas";
import {
  parseTeacherReviewId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: Date;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const reviewId = parseTeacherReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }
    const body = await validateJson(req, teacherReviewModerationRemoveBodySchema);

    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const auditLogs = db.collection<AuditLogDoc>("audit_logs");

    const existing = await teacherReviews.findOne({ id: reviewId });
    if (!existing) {
      return apiError(404, "Teacher review not found", "Not Found");
    }

    const now = new Date();
    const updated = await teacherReviews.findOneAndUpdate(
      { id: reviewId },
      {
        $set: {
          status: "REMOVED",
          reviewedById: currentUser.userId,
          reviewedAt: now,
          decisionReason: body.reason ?? null,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) {
      return apiError(404, "Teacher review not found", "Not Found");
    }

    const auditId = await getNextSequenceValue("audit_logs");
    await auditLogs.insertOne({
      id: auditId,
      actorId: currentUser.userId,
      action: "TEACHER_REVIEW_REMOVED",
      entityType: "TEACHER_REVIEW",
      entityId: reviewId,
      createdAt: now,
    });

    const response = toTeacherReviewResponse(updated);
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
