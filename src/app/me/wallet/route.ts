import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";

type UserWalletDoc = {
  id?: unknown;
  walletBalance?: unknown;
};

type WalletAggregateRow = {
  _id: null;
  totalEarned: unknown;
  pendingPayout: unknown;
};

function toNumberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    const db = getDb();
    const users = db.collection<UserWalletDoc>("users");
    const payments = db.collection("payments");

    const user = await users.findOne(
      { id: currentUser.userId },
      { projection: { id: 1, walletBalance: 1 } },
    );

    if (!user) {
      return apiError(404, "User not found", "Not Found");
    }

    const [aggregate] = await payments
      .aggregate<WalletAggregateRow>([
        { $match: { sellerId: currentUser.userId } },
        {
          $group: {
            _id: null,
            totalEarned: {
              $sum: {
                $cond: [{ $eq: ["$status", "RELEASED"] }, "$amount", 0],
              },
            },
            pendingPayout: {
              $sum: {
                $cond: [{ $eq: ["$status", "APPROVED"] }, "$amount", 0],
              },
            },
          },
        },
      ])
      .toArray();

    return NextResponse.json(
      {
        walletBalance: toNumberOrZero(user.walletBalance),
        totalEarned: toNumberOrZero(aggregate?.totalEarned),
        pendingPayout: toNumberOrZero(aggregate?.pendingPayout),
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
