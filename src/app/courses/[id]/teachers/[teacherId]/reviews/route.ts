import { NextResponse } from "next/server";

import { apiError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import {
  parseCourseId,
  parseTeacherId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; teacherId: string }> },
): Promise<NextResponse> {
  try {
    const { id: rawCourseId, teacherId: rawTeacherId } = await params;
    const courseId = parseCourseId(rawCourseId);
    const teacherId = parseTeacherId(rawTeacherId);
    if (!courseId || !teacherId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const rows = await teacherReviews
      .find({ courseId, teacherId, status: "VISIBLE" })
      .sort({ createdAt: -1 })
      .toArray();

    const response = [];
    for (const row of rows) {
      const normalized = toTeacherReviewResponse(row);
      if (!normalized) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      response.push(normalized);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
