import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import {
  buildMonthlyRevenuePipeline,
  buildRecentSalesFilter,
  toMonthlyRevenue,
  toRecentSale,
  type MonthlyRevenueAggRow,
  type PaymentDoc,
  type RecentSale,
} from "@/modules/dashboard/sales";

type UserDoc = {
  id?: unknown;
  walletBalance?: unknown;
};

type CountRow = {
  _id: null;
  total?: unknown;
  pending?: unknown;
  approved?: unknown;
  rejected?: unknown;
  transferred?: unknown;
  visible?: unknown;
  underReview?: unknown;
  removed?: unknown;
};

type SalesRow = {
  _id: null;
  totalSalesCount?: unknown;
  totalSalesAmountCents?: unknown;
  pendingPayoutCents?: unknown;
  releasedPayoutCents?: unknown;
};

type PurchasesRow = {
  _id: null;
  totalPurchasesCount?: unknown;
  totalSpentCents?: unknown;
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

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const db = getDb();
    const users = db.collection<UserDoc>("users");
    const studySheets = db.collection("study_sheets");
    const payments = db.collection<PaymentDoc>("payments");
    const purchases = db.collection("purchases");
    const leases = db.collection("lease_listings");
    const reviews = db.collection("reviews");

    const user = await users.findOne(
      { id: currentUser.userId },
      { projection: { walletBalance: 1 } },
    );
    if (!user) {
      return apiError(404, "User not found", "Not Found");
    }

    const [myStudySheetsAgg] = await studySheets
      .aggregate<CountRow>([
        { $match: { ownerId: currentUser.userId } },
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

    const [mySalesAgg] = await payments
      .aggregate<SalesRow>([
        { $match: { sellerId: currentUser.userId } },
        {
          $group: {
            _id: null,
            totalSalesCount: { $sum: 1 },
            totalSalesAmountCents: { $sum: { $ifNull: ["$amount", 0] } },
            pendingPayoutCents: {
              $sum: { $cond: [{ $ne: ["$status", "RELEASED"] }, { $ifNull: ["$amount", 0] }, 0] },
            },
            releasedPayoutCents: {
              $sum: { $cond: [{ $eq: ["$status", "RELEASED"] }, { $ifNull: ["$amount", 0] }, 0] },
            },
          },
        },
      ])
      .toArray();

    const recentSalesRaw = await payments
      .find(buildRecentSalesFilter(currentUser.userId), {
        projection: { id: 1, amount: 1, status: 1, createdAt: 1, buyerId: 1, referenceCode: 1 },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const recentSales: RecentSale[] = [];
    for (const row of recentSalesRaw) {
      const normalized = toRecentSale(row);
      if (!normalized) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      recentSales.push(normalized);
    }

    const now = new Date();
    const monthlyRevenueRaw = await payments
      .aggregate<MonthlyRevenueAggRow>(buildMonthlyRevenuePipeline(currentUser.userId, now))
      .toArray();
    const monthlyRevenue = toMonthlyRevenue(monthlyRevenueRaw, now);

    const [myPurchasesAgg] = await purchases
      .aggregate<PurchasesRow>([
        { $match: { buyerId: currentUser.userId } },
        {
          $group: {
            _id: null,
            totalPurchasesCount: { $sum: 1 },
            totalSpentCents: { $sum: { $ifNull: ["$amountCents", { $ifNull: ["$amount", 0] }] } },
          },
        },
      ])
      .toArray();

    const [myLeasesAgg] = await leases
      .aggregate<CountRow>([
        { $match: { ownerId: currentUser.userId } },
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

    const [myReviewsAgg] = await reviews
      .aggregate<CountRow>([
        { $match: { studentId: currentUser.userId } },
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

    return NextResponse.json(
      {
        walletBalance: asInt(user.walletBalance),
        myStudySheets: {
          total: asInt(myStudySheetsAgg?.total),
          pending: asInt(myStudySheetsAgg?.pending),
          approved: asInt(myStudySheetsAgg?.approved),
          rejected: asInt(myStudySheetsAgg?.rejected),
        },
        mySales: {
          totalSalesCount: asInt(mySalesAgg?.totalSalesCount),
          totalSalesAmountCents: asInt(mySalesAgg?.totalSalesAmountCents),
          pendingPayoutCents: asInt(mySalesAgg?.pendingPayoutCents),
          releasedPayoutCents: asInt(mySalesAgg?.releasedPayoutCents),
          recentSales,
          monthlyRevenue,
        },
        myPurchases: {
          totalPurchasesCount: asInt(myPurchasesAgg?.totalPurchasesCount),
          totalSpentCents: asInt(myPurchasesAgg?.totalSpentCents),
        },
        myLeases: {
          total: asInt(myLeasesAgg?.total),
          pending: asInt(myLeasesAgg?.pending),
          approved: asInt(myLeasesAgg?.approved),
          rejected: asInt(myLeasesAgg?.rejected),
          transferred: asInt(myLeasesAgg?.transferred),
        },
        myReviews: {
          total: asInt(myReviewsAgg?.total),
          visible: asInt(myReviewsAgg?.visible),
          underReview: asInt(myReviewsAgg?.underReview),
          removed: asInt(myReviewsAgg?.removed),
        },
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
