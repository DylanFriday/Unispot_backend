import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import {
  parseWithdrawalId,
  toWithdrawalResponse,
  type WithdrawalDoc,
} from "@/modules/withdrawals/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { id } = await params;
    const withdrawalId = parseWithdrawalId(id);
    if (!withdrawalId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const updated = await withTransaction<WithdrawalDoc>(async (session, db) => {
      const withdrawals = db.collection<WithdrawalDoc>("withdrawal_requests");
      const existing = await withdrawals.findOne({ id: withdrawalId }, { session });
      if (!existing) {
        throw apiError(404, "Withdrawal not found", "Not Found");
      }
      if (existing.status !== "PENDING") {
        throw apiError(400, "Withdrawal cannot be approved", "Bad Request");
      }

      const now = new Date();
      const result = await withdrawals.findOneAndUpdate(
        { id: withdrawalId, status: "PENDING" },
        {
          $set: {
            status: "APPROVED",
            reviewedById: currentUser.userId,
            reviewedAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after", session },
      );

      if (!result) {
        throw apiError(400, "Withdrawal cannot be approved", "Bad Request");
      }
      return result;
    });

    const response = toWithdrawalResponse(updated);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
