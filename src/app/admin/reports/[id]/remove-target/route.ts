import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { parseReportId, type ReportDoc } from "@/modules/reports/types";

type ReviewDoc = { id?: unknown };
type TeacherReviewDoc = { id?: unknown };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireRole(requireAuth(req), ["ADMIN"]);

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const result = await withTransaction(async (session, db) => {
      const reports = db.collection<ReportDoc>("reports");
      const report = await reports.findOne({ id: reportId }, { session });
      if (!report) {
        throw apiError(404, "Report not found", "Not Found");
      }

      if (
        (report.targetType !== "REVIEW" &&
          report.targetType !== "TEACHER_REVIEW") ||
        typeof report.targetId !== "number"
      ) {
        throw apiError(400, "Validation failed", "Bad Request");
      }

      const now = new Date();
      if (report.targetType === "REVIEW") {
        const reviews = db.collection<ReviewDoc>("reviews");
        const votes = db.collection("review_votes");
        const history = db.collection("review_history");

        await votes.deleteMany({ reviewId: report.targetId }, { session });
        await history.deleteMany({ reviewId: report.targetId }, { session });
        await reports.updateMany(
          { targetType: "REVIEW", targetId: report.targetId, status: "PENDING" },
          { $set: { status: "RESOLVED", updatedAt: now } },
          { session },
        );
        const deleted = await reviews.findOneAndDelete(
          { id: report.targetId },
          { session },
        );
        if (!deleted) {
          throw apiError(404, "Reported target not found", "Not Found");
        }
      } else {
        const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
        const votes = db.collection("teacher_review_votes");
        const history = db.collection("teacher_review_history");

        await votes.deleteMany({ teacherReviewId: report.targetId }, { session });
        await history.deleteMany({ teacherReviewId: report.targetId }, { session });
        await reports.updateMany(
          {
            targetType: "TEACHER_REVIEW",
            targetId: report.targetId,
            status: "PENDING",
          },
          { $set: { status: "RESOLVED", updatedAt: now } },
          { session },
        );
        const deleted = await teacherReviews.findOneAndDelete(
          { id: report.targetId },
          { session },
        );
        if (!deleted) {
          throw apiError(404, "Reported target not found", "Not Found");
        }
      }

      const updated = await reports.findOneAndUpdate(
        { id: reportId },
        { $set: { status: "RESOLVED", updatedAt: now } },
        { returnDocument: "after", session },
      );

      if (!updated) {
        throw apiError(404, "Report not found", "Not Found");
      }

      return updated;
    });

    return NextResponse.json(
      {
        id: result.id,
        status: result.status,
        updatedAt: result.updatedAt,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
