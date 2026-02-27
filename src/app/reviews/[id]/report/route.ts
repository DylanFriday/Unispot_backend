import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { type ReportDoc } from "@/modules/reports/types";
import { reportReviewBodySchema } from "@/modules/reviews/schemas";
import { parseReviewId, toReviewResponse, type ReviewDoc } from "@/modules/reviews/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);
    const { id } = await params;
    const reviewId = parseReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, reportReviewBodySchema);
    let alreadyReported = false;

    const reviewDoc = await withTransaction<ReviewDoc>(async (session, db) => {
      const reviews = db.collection<ReviewDoc>("reviews");
      const reports = db.collection<ReportDoc>("reports");

      const review = await reviews.findOne({ id: reviewId }, { session });
      if (!review) {
        throw apiError(404, "Review not found", "Not Found");
      }

      const existing = await reports.findOne(
        {
          reporterId: currentUser.userId,
          targetType: "REVIEW",
          targetId: reviewId,
          status: "PENDING",
        },
        { session, projection: { _id: 1 } },
      );
      if (existing) {
        alreadyReported = true;
        return review;
      }

      const now = new Date();
      const reportId = await getNextSequenceValue("reports", session);
      try {
        await reports.insertOne(
          {
            id: reportId,
            reporterId: currentUser.userId,
            targetType: "REVIEW",
            targetId: reviewId,
            reason: body.reason,
            status: "PENDING",
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      } catch (error: unknown) {
        if (error instanceof MongoServerError && error.code === 11000) {
          alreadyReported = true;
          return review;
        }
        throw error;
      }
      return review;
    });

    const response = toReviewResponse(reviewDoc);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(
      {
        message: alreadyReported ? "Already reported" : "Report submitted",
        review: response,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
