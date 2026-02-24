import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { createTeacherReviewBodySchema } from "@/modules/teacher-reviews/schemas";
import {
  normalizeTeacherName,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type CourseDoc = {
  id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);
    const body = await validateJson(req, createTeacherReviewBodySchema);

    const db = getDb();
    const courses = db.collection<CourseDoc>("courses");
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");

    const course = await courses.findOne({ id: body.courseId }, { projection: { id: 1 } });
    if (!course) {
      return apiError(404, "Course not found", "Not Found");
    }

    const normalizedName = normalizeTeacherName(body.teacherName);
    const duplicate = await teacherReviews.findOne(
      {
        studentId: currentUser.userId,
        courseId: body.courseId,
        normalizedName,
        status: { $in: ["VISIBLE", "UNDER_REVIEW"] },
      },
      { projection: { _id: 1 } },
    );
    if (duplicate) {
      return apiError(400, "You already reviewed this teacher", "Bad Request");
    }

    const id = await getNextSequenceValue("teacher_reviews");
    const now = new Date();
    const doc: TeacherReviewDoc = {
      id,
      studentId: currentUser.userId,
      courseId: body.courseId,
      teacherId: null,
      teacherName: body.teacherName.trim(),
      normalizedName,
      rating: body.rating,
      text: body.text,
      status: "VISIBLE",
      reviewedById: null,
      reviewedAt: null,
      decisionReason: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await teacherReviews.insertOne(doc);
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return apiError(400, "You already reviewed this teacher", "Bad Request");
      }
      throw error;
    }

    const response = toTeacherReviewResponse(doc);
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
