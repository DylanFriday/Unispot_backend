import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { parseReviewId, type ReviewDoc } from "@/modules/reviews/utils";

type ReviewVoteDoc = {
  id?: unknown;
  reviewId: number;
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
    const reviewId = parseReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const reviews = db.collection<ReviewDoc>("reviews");
    const votes = db.collection<ReviewVoteDoc>("review_votes");

    const review = await reviews.findOne({ id: reviewId }, { projection: { id: 1 } });
    if (!review) {
      return apiError(404, "Review not found", "Not Found");
    }

    const existing = await votes.findOne(
      { reviewId, voterId: currentUser.userId },
      { projection: { _id: 1 } },
    );
    if (existing) {
      return apiError(400, "Already upvoted", "Bad Request");
    }

    const voteId = await getNextSequenceValue("review_votes");
    const voteDoc = {
      id: voteId,
      reviewId,
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
    const reviewId = parseReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const votes = db.collection<ReviewVoteDoc>("review_votes");
    await votes.deleteOne({ reviewId, voterId: currentUser.userId });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
