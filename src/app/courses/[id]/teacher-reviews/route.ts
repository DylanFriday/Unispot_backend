import { NextResponse } from "next/server";

import { verifyJwt } from "@/lib/auth/jwt";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import {
  parseCourseId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

function getOptionalStudentIdFromBearer(req: Request): number | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const payload = verifyJwt(token);
  if (!payload || payload.role !== "STUDENT") {
    return null;
  }

  return payload.userId;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: rawCourseId } = await params;
    const courseId = parseCourseId(rawCourseId);
    if (!courseId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const studentId = getOptionalStudentIdFromBearer(req);
    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const filter =
      studentId === null
        ? { courseId, status: "VISIBLE" }
        : {
            courseId,
            $or: [
              { status: "VISIBLE" },
              { status: "UNDER_REVIEW", studentId },
            ],
          };

    const rows = await teacherReviews.find(filter).sort({ createdAt: -1 }).toArray();
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
