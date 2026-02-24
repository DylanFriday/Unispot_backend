import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { updateTeacherReviewBodySchema } from "@/modules/teacher-reviews/schemas";
import {
  parseTeacherReviewId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type TeacherReviewHistoryDoc = {
  id?: unknown;
  teacherReviewId: number;
  oldRating: number;
  oldText: string;
  createdAt: Date;
};

export async function PATCH(
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

    const body = await validateJson(req, updateTeacherReviewBodySchema);
    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const existing = await teacherReviews.findOne({ id: reviewId });
    if (!existing) {
      return apiError(404, "Teacher review not found", "Not Found");
    }
    if (existing.studentId !== currentUser.userId) {
      return apiError(403, "Forbidden", "Forbidden");
    }
    if (typeof existing.rating !== "number" || typeof existing.text !== "string") {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const updated = await withTransaction<TeacherReviewDoc>(async (session, txDb) => {
      const txReviews = txDb.collection<TeacherReviewDoc>("teacher_reviews");
      const history = txDb.collection<TeacherReviewHistoryDoc>("teacher_review_history");
      const historyId = await getNextSequenceValue("teacher_review_history", session);

      await history.insertOne(
        {
          id: historyId,
          teacherReviewId: reviewId,
          oldRating: existing.rating as number,
          oldText: existing.text as string,
          createdAt: new Date(),
        },
        { session },
      );

      const result = await txReviews.findOneAndUpdate(
        { id: reviewId },
        { $set: { rating: body.rating, text: body.text, updatedAt: new Date() } },
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

export async function DELETE(
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

    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const existing = await teacherReviews.findOne({ id: reviewId });
    if (!existing) {
      return apiError(404, "Teacher review not found", "Not Found");
    }
    if (existing.studentId !== currentUser.userId) {
      return apiError(403, "Forbidden", "Forbidden");
    }

    const deleted = await withTransaction<TeacherReviewDoc>(async (session, txDb) => {
      const txReviews = txDb.collection<TeacherReviewDoc>("teacher_reviews");
      const votes = txDb.collection("teacher_review_votes");
      const reports = txDb.collection("teacher_review_reports");
      const history = txDb.collection("teacher_review_history");

      await votes.deleteMany({ teacherReviewId: reviewId }, { session });
      await reports.deleteMany({ teacherReviewId: reviewId }, { session });
      await history.deleteMany({ teacherReviewId: reviewId }, { session });

      const result = await txReviews.findOneAndDelete({ id: reviewId }, { session });
      if (!result) {
        throw apiError(404, "Teacher review not found", "Not Found");
      }
      return result;
    });

    const response = toTeacherReviewResponse(deleted);
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
