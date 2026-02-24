import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import {
  parseTeacherReviewId,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type TeacherReviewVoteDoc = {
  id?: unknown;
  teacherReviewId: number;
  voterId: number;
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

    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const votes = db.collection<TeacherReviewVoteDoc>("teacher_review_votes");

    const review = await teacherReviews.findOne({ id: reviewId }, { projection: { id: 1 } });
    if (!review) {
      return apiError(404, "Teacher review not found", "Not Found");
    }

    const existing = await votes.findOne(
      { teacherReviewId: reviewId, voterId: currentUser.userId },
      { projection: { _id: 1 } },
    );
    if (existing) {
      return apiError(400, "Already upvoted", "Bad Request");
    }

    const voteId = await getNextSequenceValue("teacher_review_votes");
    const voteDoc = {
      id: voteId,
      teacherReviewId: reviewId,
      voterId: currentUser.userId,
      createdAt: new Date(),
    };

    try {
      await votes.insertOne(voteDoc);
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return apiError(400, "Already upvoted", "Bad Request");
      }
      throw error;
    }

    return NextResponse.json(voteDoc, { status: 201 });
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
    const votes = db.collection<TeacherReviewVoteDoc>("teacher_review_votes");
    await votes.deleteOne({ teacherReviewId: reviewId, voterId: currentUser.userId });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
