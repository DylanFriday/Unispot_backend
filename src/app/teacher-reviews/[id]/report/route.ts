import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { reportTeacherReviewBodySchema } from "@/modules/teacher-reviews/schemas";
import {
  parseTeacherReviewId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type TeacherReviewReportDoc = {
  id?: unknown;
  teacherReviewId: number;
  reporterId: number;
  reason: string;
  createdAt: Date;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);
    const { id } = await params;
    const reviewId = parseTeacherReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, reportTeacherReviewBodySchema);

    const updated = await withTransaction<TeacherReviewDoc>(async (session, db) => {
      const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
      const reports = db.collection<TeacherReviewReportDoc>("teacher_review_reports");

      const review = await teacherReviews.findOne({ id: reviewId }, { session });
      if (!review) {
        throw apiError(404, "Teacher review not found", "Not Found");
      }

      const existing = await reports.findOne(
        { teacherReviewId: reviewId, reporterId: currentUser.userId },
        { session, projection: { _id: 1 } },
      );
      if (existing) {
        throw apiError(400, "You already reported this teacher review", "Bad Request");
      }

      const reportId = await getNextSequenceValue("teacher_review_reports", session);
      try {
        await reports.insertOne(
          {
            id: reportId,
            teacherReviewId: reviewId,
            reporterId: currentUser.userId,
            reason: body.reason,
            createdAt: new Date(),
          },
          { session },
        );
      } catch (error: unknown) {
        if (error instanceof MongoServerError && error.code === 11000) {
          throw apiError(400, "You already reported this teacher review", "Bad Request");
        }
        throw error;
      }

      const result = await teacherReviews.findOneAndUpdate(
        { id: reviewId },
        { $set: { status: "UNDER_REVIEW", updatedAt: new Date() } },
        { returnDocument: "after", session },
      );
      if (!result) {
        throw apiError(404, "Teacher review not found", "Not Found");
      }
      return result;
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
