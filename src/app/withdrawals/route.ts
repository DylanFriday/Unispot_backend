import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { type UserDoc } from "@/modules/users/types";
import {
  createWithdrawalBodySchema,
  withdrawalStatusSchema,
} from "@/modules/withdrawals/schemas";
import { toWithdrawalResponse, type WithdrawalDoc } from "@/modules/withdrawals/utils";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);
    const body = await validateJson(req, createWithdrawalBodySchema);

    const created = await withTransaction<WithdrawalDoc>(async (session, db) => {
      const users = db.collection<UserDoc>("users");
      const withdrawals = db.collection<WithdrawalDoc>("withdrawal_requests");

      const user = await users.findOne({ id: currentUser.userId }, { session });
      if (!user) {
        throw apiError(404, "User not found", "Not Found");
      }

      if (
        typeof user.walletBalance !== "number" ||
        !Number.isInteger(user.walletBalance) ||
        user.walletBalance < 0
      ) {
        throw apiError(500, "Internal Server Error", "Internal Server Error");
      }

      if (user.walletBalance < body.amountCents) {
        throw apiError(400, "Insufficient wallet balance", "Bad Request");
      }

      await users.updateOne(
        { id: currentUser.userId },
        { $inc: { walletBalance: -body.amountCents } },
        { session },
      );

      const withdrawalId = await getNextSequenceValue("withdrawal_requests", session);
      const now = new Date();

      const createdDoc: WithdrawalDoc = {
        id: withdrawalId,
        sellerId: currentUser.userId,
        amount: body.amountCents,
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await withdrawals.insertOne(createdDoc, { session });
      return createdDoc;
    });

    const response = toWithdrawalResponse(created);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parsedStatus = withdrawalStatusSchema.safeParse(
      searchParams.get("status") ?? "PENDING",
    );
    if (!parsedStatus.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const withdrawals = db.collection<WithdrawalDoc>("withdrawal_requests");
    const rows = await withdrawals
      .find({ status: parsedStatus.data })
      .sort({ createdAt: -1 })
      .toArray();

    const response = [];
    for (const row of rows) {
      const normalized = toWithdrawalResponse(row);
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
