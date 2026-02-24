import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import {
  parseCourseId,
  toReviewResponse,
  type ReviewDoc,
} from "@/modules/reviews/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const courseId = parseCourseId(id);
    if (!courseId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const reviews = db.collection<ReviewDoc>("reviews");
    const rows = await reviews
      .find({ courseId, status: "VISIBLE" })
      .sort({ createdAt: -1 })
      .toArray();

    const response = [];
    for (const row of rows) {
      const normalized = toReviewResponse(row);
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
