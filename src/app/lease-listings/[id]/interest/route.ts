import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { parseLeaseListingId, type LeaseListingDoc } from "@/modules/lease-listings/utils";

type InterestRequestDoc = {
  id?: unknown;
  leaseListingId?: unknown;
  studentId?: unknown;
  createdAt?: unknown;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const { id } = await params;
    const leaseListingId = parseLeaseListingId(id);
    if (!leaseListingId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
    const interests = db.collection<InterestRequestDoc>("interest_requests");

    const leaseListing = await leaseListings.findOne({ id: leaseListingId });
    if (!leaseListing) {
      return apiError(404, "Lease listing not found", "Not Found");
    }

    const existing = await interests.findOne(
      { leaseListingId, studentId: currentUser.userId },
      { projection: { _id: 1 } },
    );
    if (existing) {
      return apiError(400, "Interest already submitted", "Bad Request");
    }

    const now = new Date();
    const interestId = await getNextSequenceValue("interest_requests");
    const doc = {
      id: interestId,
      leaseListingId,
      studentId: currentUser.userId,
      createdAt: now,
    };

    try {
      await interests.insertOne(doc);
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return apiError(400, "Interest already submitted", "Bad Request");
      }
      throw error;
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
