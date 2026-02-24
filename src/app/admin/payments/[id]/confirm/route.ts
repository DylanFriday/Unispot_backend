import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";

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

    const updatedPayment = await withTransaction<PaymentDoc>(async (session, db) => {
      const payments = db.collection<PaymentDoc>("payments");
      const auditLogs = db.collection<AuditLogDoc>("audit_logs");

      const existing = await payments.findOne({ id: paymentId }, { session });
      if (!existing) {
        throw apiError(404, "Payment not found", "Not Found");
      }

      if (existing.status !== "PENDING") {
        throw apiError(400, "Payment cannot be confirmed", "Bad Request");
      }

      const now = new Date();
      const updated = await payments.findOneAndUpdate(
        { id: paymentId, status: "PENDING" },
        {
          $set: {
            status: "APPROVED",
            approvedAt: now,
            approvedById: currentUser.userId,
            updatedAt: now,
          },
        },
        { returnDocument: "after", session },
      );

      if (!updated) {
        throw apiError(400, "Payment cannot be confirmed", "Bad Request");
      }

      const amount =
        typeof updated.amount === "number" && Number.isInteger(updated.amount)
          ? updated.amount
          : 0;

      const auditId = await getNextSequenceValue("audit_logs", session);
      await auditLogs.insertOne(
        {
          id: auditId,
          actorId: currentUser.userId,
          action: "PAYMENT_CONFIRMED",
          entityType: "PAYMENT",
          entityId: paymentId,
          amount,
          createdAt: now,
        },
        { session },
      );

      return updated;
    });

    const response = toPaymentResponse(updatedPayment);
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
