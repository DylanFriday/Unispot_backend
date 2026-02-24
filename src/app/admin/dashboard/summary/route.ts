import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";

type CountRow = {
  _id: null;
  total?: unknown;
  students?: unknown;
  staff?: unknown;
  admins?: unknown;
  pending?: unknown;
  approved?: unknown;
  rejected?: unknown;
  transferred?: unknown;
  visible?: unknown;
  underReview?: unknown;
  removed?: unknown;
  pendingCount?: unknown;
  approvedCount?: unknown;
  releasedCount?: unknown;
  totalAmountCents?: unknown;
  pendingAmountCents?: unknown;
};

type ModerationQueueRow = {
  _id: null;
  studySheetsPending?: unknown;
  leasesPending?: unknown;
  reviewsUnderReview?: unknown;
};

type TopCourseRow = {
  courseId?: unknown;
  code?: unknown;
  name?: unknown;
  reviewCount?: unknown;
  avgRating?: unknown;
};

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const db = getDb();
    const users = db.collection("users");
    const studySheets = db.collection("study_sheets");
    const payments = db.collection("payments");
    const leases = db.collection("lease_listings");
    const reviews = db.collection("reviews");

    const [usersAgg] = await users
      .aggregate<CountRow>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            students: { $sum: { $cond: [{ $eq: ["$role", "STUDENT"] }, 1, 0] } },
            staff: { $sum: { $cond: [{ $eq: ["$role", "STAFF"] }, 1, 0] } },
            admins: { $sum: { $cond: [{ $eq: ["$role", "ADMIN"] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    const [studySheetsAgg] = await studySheets
      .aggregate<CountRow>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    const [paymentsAgg] = await payments
      .aggregate<CountRow>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pendingCount: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
            approvedCount: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
            releasedCount: { $sum: { $cond: [{ $eq: ["$status", "RELEASED"] }, 1, 0] } },
            totalAmountCents: { $sum: { $ifNull: ["$amount", 0] } },
            pendingAmountCents: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, { $ifNull: ["$amount", 0] }, 0] },
            },
          },
        },
      ])
      .toArray();

    const [moderationQueueAgg] = await studySheets
      .aggregate<ModerationQueueRow>([
        {
          $lookup: {
            from: "lease_listings",
            pipeline: [{ $match: { status: "PENDING" } }, { $count: "count" }],
            as: "leasePendingAgg",
          },
        },
        {
          $lookup: {
            from: "reviews",
            pipeline: [{ $match: { status: "UNDER_REVIEW" } }, { $count: "count" }],
            as: "reviewUnderReviewAgg",
          },
        },
        {
          $match: { status: "PENDING" },
        },
        {
          $group: {
            _id: null,
            studySheetsPending: { $sum: 1 },
            leasesPending: { $first: { $ifNull: [{ $arrayElemAt: ["$leasePendingAgg.count", 0] }, 0] } },
            reviewsUnderReview: {
              $first: { $ifNull: [{ $arrayElemAt: ["$reviewUnderReviewAgg.count", 0] }, 0] },
            },
          },
        },
      ])
      .toArray();

    const [fallbackModerationQueueAgg] =
      moderationQueueAgg
        ? [moderationQueueAgg]
        : await leases
            .aggregate<ModerationQueueRow>([
              {
                $lookup: {
                  from: "study_sheets",
                  pipeline: [{ $match: { status: "PENDING" } }, { $count: "count" }],
                  as: "studyPendingAgg",
                },
              },
              {
                $lookup: {
                  from: "reviews",
                  pipeline: [{ $match: { status: "UNDER_REVIEW" } }, { $count: "count" }],
                  as: "reviewUnderReviewAgg",
                },
              },
              { $match: { status: "PENDING" } },
              {
                $group: {
                  _id: null,
                  leasesPending: { $sum: 1 },
                  studySheetsPending: {
                    $first: { $ifNull: [{ $arrayElemAt: ["$studyPendingAgg.count", 0] }, 0] },
                  },
                  reviewsUnderReview: {
                    $first: { $ifNull: [{ $arrayElemAt: ["$reviewUnderReviewAgg.count", 0] }, 0] },
                  },
                },
              },
            ])
            .toArray();

    const [leasesAgg] = await leases
      .aggregate<CountRow>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] } },
            transferred: { $sum: { $cond: [{ $eq: ["$status", "TRANSFERRED"] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    const [reviewsAgg] = await reviews
      .aggregate<CountRow>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            visible: { $sum: { $cond: [{ $eq: ["$status", "VISIBLE"] }, 1, 0] } },
            underReview: { $sum: { $cond: [{ $eq: ["$status", "UNDER_REVIEW"] }, 1, 0] } },
            removed: { $sum: { $cond: [{ $eq: ["$status", "REMOVED"] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    const topCoursesRaw = await reviews
      .aggregate<TopCourseRow>([
        { $match: { status: "VISIBLE" } },
        {
          $group: {
            _id: "$courseId",
            reviewCount: { $sum: 1 },
            avgRating: { $avg: "$rating" },
          },
        },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "id",
            as: "course",
          },
        },
        { $unwind: "$course" },
        {
          $project: {
            _id: 0,
            courseId: "$_id",
            code: "$course.code",
            name: "$course.name",
            reviewCount: "$reviewCount",
            avgRating: { $round: [{ $ifNull: ["$avgRating", 0] }, 2] },
          },
        },
        { $sort: { reviewCount: -1, avgRating: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    const topCourses = topCoursesRaw
      .filter((row) => typeof row.courseId === "number" && typeof row.code === "string" && typeof row.name === "string")
      .map((row) => ({
        courseId: asInt(row.courseId),
        code: String(row.code),
        name: String(row.name),
        reviewCount: asInt(row.reviewCount),
        avgRating: Number(asNumber(row.avgRating).toFixed(2)),
      }));

    return NextResponse.json(
      {
        users: {
          total: asInt(usersAgg?.total),
          students: asInt(usersAgg?.students),
          staff: asInt(usersAgg?.staff),
          admins: asInt(usersAgg?.admins),
        },
        studySheets: {
          total: asInt(studySheetsAgg?.total),
          pending: asInt(studySheetsAgg?.pending),
          approved: asInt(studySheetsAgg?.approved),
          rejected: asInt(studySheetsAgg?.rejected),
        },
        payments: {
          total: asInt(paymentsAgg?.total),
          pendingCount: asInt(paymentsAgg?.pendingCount),
          approvedCount: asInt(paymentsAgg?.approvedCount),
          releasedCount: asInt(paymentsAgg?.releasedCount),
          totalAmountCents: asInt(paymentsAgg?.totalAmountCents),
          pendingAmountCents: asInt(paymentsAgg?.pendingAmountCents),
        },
        moderationQueue: {
          studySheetsPending: asInt(fallbackModerationQueueAgg?.studySheetsPending),
          leasesPending: asInt(fallbackModerationQueueAgg?.leasesPending),
          reviewsUnderReview: asInt(fallbackModerationQueueAgg?.reviewsUnderReview),
        },
        leases: {
          total: asInt(leasesAgg?.total),
          pending: asInt(leasesAgg?.pending),
          approved: asInt(leasesAgg?.approved),
          rejected: asInt(leasesAgg?.rejected),
          transferred: asInt(leasesAgg?.transferred),
        },
        reviews: {
          total: asInt(reviewsAgg?.total),
          visible: asInt(reviewsAgg?.visible),
          underReview: asInt(reviewsAgg?.underReview),
          removed: asInt(reviewsAgg?.removed),
        },
        topCourses,
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
