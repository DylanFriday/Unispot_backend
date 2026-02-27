import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { teacherReviewStatusSchema } from "@/modules/teacher-reviews/schemas";
import {
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status") ?? "UNDER_REVIEW";
    const parsedStatus = teacherReviewStatusSchema.safeParse(rawStatus);
    if (!parsedStatus.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
    const rows = await teacherReviews
      .find({ status: parsedStatus.data })
      .sort({ createdAt: 1 })
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
