import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import {
  parseReviewId,
  toReviewResponse,
  type ReviewDoc,
} from "@/modules/reviews/utils";

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
    const reviewId = parseReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const reviews = db.collection<ReviewDoc>("reviews");
    const auditLogs = db.collection<AuditLogDoc>("audit_logs");

    const existing = await reviews.findOne({ id: reviewId });
    if (!existing) {
      return apiError(404, "Review not found", "Not Found");
    }

    const now = new Date();
    const updated = await reviews.findOneAndUpdate(
      { id: reviewId },
      { $set: { status: "VISIBLE", updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!updated) {
      return apiError(404, "Review not found", "Not Found");
    }

    const auditId = await getNextSequenceValue("audit_logs");
    await auditLogs.insertOne({
      id: auditId,
      actorId: currentUser.userId,
      action: "REVIEW_APPROVED",
      entityType: "REVIEW",
      entityId: reviewId,
      createdAt: now,
    });

    const response = toReviewResponse(updated);
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
