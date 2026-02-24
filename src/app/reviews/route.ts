import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { createReviewBodySchema } from "@/modules/reviews/schemas";
import { toReviewResponse, type ReviewDoc } from "@/modules/reviews/utils";

type CourseDoc = {
  id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);
    const body = await validateJson(req, createReviewBodySchema);

    const db = getDb();
    const courses = db.collection<CourseDoc>("courses");
    const reviews = db.collection<ReviewDoc>("reviews");

    const course = await courses.findOne({ id: body.courseId }, { projection: { id: 1 } });
    if (!course) {
      return apiError(404, "Course not found", "Not Found");
    }

    const exists = await reviews.findOne(
      { studentId: currentUser.userId, courseId: body.courseId },
      { projection: { _id: 1 } },
    );
    if (exists) {
      return apiError(400, "You have already reviewed this course", "Bad Request");
    }

    const id = await getNextSequenceValue("reviews");
    const now = new Date();
    const doc: ReviewDoc = {
      id,
      rating: body.rating,
      text: body.text,
      status: "VISIBLE",
      studentId: currentUser.userId,
      courseId: body.courseId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await reviews.insertOne(doc);
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return apiError(400, "You have already reviewed this course", "Bad Request");
      }
      throw error;
    }

    const response = toReviewResponse(doc);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
