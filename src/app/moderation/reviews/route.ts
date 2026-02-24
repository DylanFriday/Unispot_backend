import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { toReviewResponse, type ReviewDoc } from "@/modules/reviews/utils";

const reviewModerationStatusSchema = z.enum(["VISIBLE", "UNDER_REVIEW", "REMOVED"]);

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parsedStatus = reviewModerationStatusSchema.safeParse(
      searchParams.get("status"),
    );
    if (!parsedStatus.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const reviews = db.collection<ReviewDoc>("reviews");
    const rows = await reviews
      .find({ status: parsedStatus.data })
      .sort({ createdAt: 1 })
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
