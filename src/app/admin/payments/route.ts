import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";

const paymentStatusSchema = z.enum(["PENDING", "APPROVED", "RELEASED"]);

type PaymentDoc = {
  id?: unknown;
  purchaseId?: unknown;
  referenceCode?: unknown;
  amount?: unknown;
  status?: unknown;
  approvedAt?: unknown;
  releasedAt?: unknown;
  approvedById?: unknown;
  releasedById?: unknown;
  buyerId?: unknown;
  sellerId?: unknown;
  studySheetId?: unknown;
  createdAt?: unknown;
};

type PaymentResponse = {
  id: number;
  purchaseId: number;
  referenceCode: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "RELEASED";
  approvedAt: Date | null;
  releasedAt: Date | null;
  approvedById: number | null;
  releasedById: number | null;
  buyerId: number;
  sellerId: number;
  studySheetId: number;
  createdAt: Date;
};

function toPaymentResponse(payment: PaymentDoc): PaymentResponse | null {
  if (
    typeof payment.id !== "number" ||
    !Number.isInteger(payment.id) ||
    payment.id <= 0 ||
    typeof payment.purchaseId !== "number" ||
    !Number.isInteger(payment.purchaseId) ||
    payment.purchaseId <= 0 ||
    typeof payment.referenceCode !== "string" ||
    typeof payment.amount !== "number" ||
    !Number.isInteger(payment.amount) ||
    payment.amount < 0 ||
    (payment.status !== "PENDING" &&
      payment.status !== "APPROVED" &&
      payment.status !== "RELEASED") ||
    typeof payment.buyerId !== "number" ||
    !Number.isInteger(payment.buyerId) ||
    payment.buyerId <= 0 ||
    typeof payment.sellerId !== "number" ||
    !Number.isInteger(payment.sellerId) ||
    payment.sellerId <= 0 ||
    typeof payment.studySheetId !== "number" ||
    !Number.isInteger(payment.studySheetId) ||
    payment.studySheetId <= 0 ||
    !(payment.createdAt instanceof Date)
  ) {
    return null;
  }

  return {
    id: payment.id,
    purchaseId: payment.purchaseId,
    referenceCode: payment.referenceCode,
    amount: payment.amount,
    status: payment.status,
    approvedAt: payment.approvedAt instanceof Date ? payment.approvedAt : null,
    releasedAt: payment.releasedAt instanceof Date ? payment.releasedAt : null,
    approvedById:
      typeof payment.approvedById === "number" &&
      Number.isInteger(payment.approvedById) &&
      payment.approvedById > 0
        ? payment.approvedById
        : null,
    releasedById:
      typeof payment.releasedById === "number" &&
      Number.isInteger(payment.releasedById) &&
      payment.releasedById > 0
        ? payment.releasedById
        : null,
    buyerId: payment.buyerId,
    sellerId: payment.sellerId,
    studySheetId: payment.studySheetId,
    createdAt: payment.createdAt,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parsedStatus = paymentStatusSchema.safeParse(searchParams.get("status"));
    if (!parsedStatus.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const payments = db.collection<PaymentDoc>("payments");
    const rows = await payments
      .find({ status: parsedStatus.data })
      .sort({ createdAt: -1 })
      .toArray();

    const response: PaymentResponse[] = [];
    for (const row of rows) {
      const normalized = toPaymentResponse(row);
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

export { toPaymentResponse, type PaymentDoc };
