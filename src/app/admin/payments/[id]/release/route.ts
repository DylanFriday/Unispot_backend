import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { type UserDoc } from "@/modules/users/types";

import { toPaymentResponse, type PaymentDoc } from "@/app/admin/payments/route";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  amount?: number;
  createdAt: Date;
};

function parsePaymentId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { id } = await params;
    const paymentId = parsePaymentId(id);
    if (!paymentId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const releasedPayment = await withTransaction<PaymentDoc>(async (session, db) => {
      const payments = db.collection<PaymentDoc>("payments");
      const users = db.collection<UserDoc>("users");
      const auditLogs = db.collection<AuditLogDoc>("audit_logs");

      const existing = await payments.findOne({ id: paymentId }, { session });
      if (!existing) {
        throw apiError(404, "Payment not found", "Not Found");
      }

      if (existing.status !== "APPROVED") {
        throw apiError(400, "Payment cannot be released", "Bad Request");
      }

      if (
        typeof existing.amount !== "number" ||
        !Number.isInteger(existing.amount) ||
        existing.amount < 0
      ) {
        throw apiError(500, "Internal Server Error", "Internal Server Error");
      }

      if (
        typeof existing.sellerId !== "number" ||
        !Number.isInteger(existing.sellerId) ||
        existing.sellerId <= 0
      ) {
        throw apiError(500, "Internal Server Error", "Internal Server Error");
      }

      const seller = await users.findOne({ id: existing.sellerId }, { session });
      if (!seller) {
        throw apiError(404, "Seller not found", "Not Found");
      }

      const now = new Date();
      const updated = await payments.findOneAndUpdate(
        { id: paymentId, status: "APPROVED" },
        {
          $set: {
            status: "RELEASED",
            releasedAt: now,
            releasedById: currentUser.userId,
            updatedAt: now,
          },
        },
        { returnDocument: "after", session },
      );

      if (!updated) {
        throw apiError(400, "Payment cannot be released", "Bad Request");
      }

      await users.updateOne(
        { id: existing.sellerId },
        { $inc: { walletBalance: existing.amount } },
        { session },
      );

      const auditId = await getNextSequenceValue("audit_logs", session);
      await auditLogs.insertOne(
        {
          id: auditId,
          actorId: currentUser.userId,
          action: "PAYMENT_RELEASED",
          entityType: "PAYMENT",
          entityId: paymentId,
          amount: existing.amount,
          createdAt: now,
        },
        { session },
      );

      return updated;
    });

    const response = toPaymentResponse(releasedPayment);
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
