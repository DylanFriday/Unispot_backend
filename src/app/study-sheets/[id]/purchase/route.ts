import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import {
  getNextSequenceValue,
  makeReferenceCode,
  parsePositiveInt,
  type PaymentDoc,
  type PurchaseDoc,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

type PurchaseResponse = {
  id: number;
  reference_code: string;
  amount: number;
};

async function generateUniqueReferenceCode(): Promise<string | null> {
  const db = getDb();
  const payments = db.collection<PaymentDoc>("payments");

  for (let i = 0; i < 5; i += 1) {
    const candidate = makeReferenceCode();
    const exists = await payments.findOne(
      { referenceCode: candidate },
      { projection: { _id: 1 } },
    );
    if (!exists) {
      return candidate;
    }
  }

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const { id } = await params;
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const referenceCode = await generateUniqueReferenceCode();
    if (!referenceCode) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const purchaseResult = await withTransaction<PurchaseResponse>(
      async (session, db) => {
        const studySheets = db.collection<StudySheetDoc>("study_sheets");
        const purchases = db.collection<PurchaseDoc>("purchases");
        const payments = db.collection<PaymentDoc>("payments");

        const studySheet = await studySheets.findOne({ id: studySheetId }, { session });
        if (!studySheet) {
          throw apiError(404, "Study sheet not found", "Not Found");
        }

        if (studySheet.status !== "APPROVED") {
          throw apiError(400, "Study sheet is not available for purchase", "Bad Request");
        }

        if (
          typeof studySheet.priceCents !== "number" ||
          !Number.isInteger(studySheet.priceCents) ||
          studySheet.priceCents < 0
        ) {
          throw apiError(500, "Internal Server Error", "Internal Server Error");
        }

        if (
          typeof studySheet.ownerId !== "number" ||
          !Number.isInteger(studySheet.ownerId) ||
          studySheet.ownerId <= 0
        ) {
          throw apiError(500, "Internal Server Error", "Internal Server Error");
        }

        const existingPurchase = await purchases.findOne(
          { studySheetId, buyerId: currentUser.userId },
          { session, projection: { _id: 1 } },
        );
        if (existingPurchase) {
          throw apiError(400, "Already purchased", "Bad Request");
        }

        const purchaseId = await getNextSequenceValue("purchases", session);
        const paymentId = await getNextSequenceValue("payments", session);
        const now = new Date();

        try {
          await purchases.insertOne(
            {
              id: purchaseId,
              buyerId: currentUser.userId,
              studySheetId,
              amountCents: studySheet.priceCents,
              createdAt: now,
            },
            { session },
          );
        } catch (error: unknown) {
          if (error instanceof MongoServerError && error.code === 11000) {
            throw apiError(400, "Already purchased", "Bad Request");
          }
          throw error;
        }

        try {
          await payments.insertOne(
            {
              id: paymentId,
              purchaseId,
              referenceCode,
              amount: studySheet.priceCents,
              status: "PENDING",
              buyerId: currentUser.userId,
              sellerId: studySheet.ownerId,
              studySheetId,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
        } catch (error: unknown) {
          if (error instanceof MongoServerError && error.code === 11000) {
            throw apiError(
              500,
              "Failed to generate unique payment reference",
              "Internal Server Error",
            );
          }
          throw error;
        }

        return {
          id: paymentId,
          reference_code: referenceCode,
          amount: studySheet.priceCents,
        };
      },
    );

    return NextResponse.json(purchaseResult, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
