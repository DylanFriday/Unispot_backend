import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { reportStatusSchema } from "@/modules/reports/schemas";

type AggregatedReportRow = {
  id?: unknown;
  reporterId?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  reporter?: {
    id?: unknown;
    name?: unknown;
    email?: unknown;
  } | null;
  target?: {
    id?: unknown;
    text?: unknown;
    status?: unknown;
    rating?: unknown;
    teacherName?: unknown;
  } | null;
};

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parsedStatus = reportStatusSchema.safeParse(
      searchParams.get("status") ?? "PENDING",
    );
    if (!parsedStatus.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const reports = db.collection("reports");

    const rows = await reports
      .aggregate<AggregatedReportRow>([
        { $match: { status: parsedStatus.data } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "reporterId",
            foreignField: "id",
            as: "reporter",
          },
        },
        {
          $unwind: {
            path: "$reporter",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "reviews",
            let: { targetId: "$targetId", targetType: "$targetType" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$$targetType", "REVIEW"] },
                      { $eq: ["$id", "$$targetId"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  id: 1,
                  text: 1,
                  status: 1,
                  rating: 1,
                },
              },
            ],
            as: "reviewTarget",
          },
        },
        {
          $lookup: {
            from: "teacher_reviews",
            let: { targetId: "$targetId", targetType: "$targetType" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$$targetType", "TEACHER_REVIEW"] },
                      { $eq: ["$id", "$$targetId"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  id: 1,
                  text: 1,
                  status: 1,
                  rating: 1,
                  teacherName: 1,
                },
              },
            ],
            as: "teacherReviewTarget",
          },
        },
        {
          $addFields: {
            target: {
              $cond: [
                { $eq: ["$targetType", "REVIEW"] },
                { $arrayElemAt: ["$reviewTarget", 0] },
                { $arrayElemAt: ["$teacherReviewTarget", 0] },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            reporterId: 1,
            targetType: 1,
            targetId: 1,
            reason: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            reporter: {
              id: "$reporter.id",
              name: "$reporter.name",
              email: "$reporter.email",
            },
            target: 1,
          },
        },
      ])
      .toArray();

    const response = rows.map((row) => ({
      id: typeof row.id === "number" ? row.id : null,
      reporterId: typeof row.reporterId === "number" ? row.reporterId : null,
      targetType:
        row.targetType === "REVIEW" || row.targetType === "TEACHER_REVIEW"
          ? row.targetType
          : null,
      targetId: typeof row.targetId === "number" ? row.targetId : null,
      reason: typeof row.reason === "string" ? row.reason : null,
      status:
        row.status === "PENDING" ||
        row.status === "RESOLVED" ||
        row.status === "REJECTED"
          ? row.status
          : null,
      createdAt: row.createdAt instanceof Date ? row.createdAt : null,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : null,
      reporter: {
        id:
          typeof row.reporter?.id === "number"
            ? row.reporter.id
            : null,
        name:
          typeof row.reporter?.name === "string"
            ? row.reporter.name
            : null,
        email:
          typeof row.reporter?.email === "string"
            ? row.reporter.email
            : null,
      },
      target: row.target
        ? {
            id: typeof row.target.id === "number" ? row.target.id : null,
            text: typeof row.target.text === "string" ? row.target.text : null,
            status:
              typeof row.target.status === "string" ? row.target.status : null,
            rating:
              typeof row.target.rating === "number" ? row.target.rating : null,
            teacherName:
              typeof row.target.teacherName === "string"
                ? row.target.teacherName
                : null,
          }
        : null,
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
