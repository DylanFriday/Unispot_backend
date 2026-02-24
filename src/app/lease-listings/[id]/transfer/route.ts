import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import {
  parseLeaseListingId,
  toLeaseListingResponse,
  type LeaseListingDoc,
} from "@/modules/lease-listings/utils";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: Date;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);

    const { id } = await params;
    const leaseListingId = parseLeaseListingId(id);
    if (!leaseListingId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const updated = await withTransaction<LeaseListingDoc>(async (session, db) => {
      const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
      const auditLogs = db.collection<AuditLogDoc>("audit_logs");

      const existing = await leaseListings.findOne({ id: leaseListingId }, { session });
      if (!existing) {
        throw apiError(404, "Lease listing not found", "Not Found");
      }

      const isAdmin = currentUser.role === "ADMIN";
      const isOwner = existing.ownerId === currentUser.userId;
      if (!isAdmin && !isOwner) {
        throw apiError(403, "Forbidden", "Forbidden");
      }

      const now = new Date();
      const result = await leaseListings.findOneAndUpdate(
        { id: leaseListingId },
        { $set: { status: "TRANSFERRED", updatedAt: now } },
        { returnDocument: "after", session },
      );

      if (!result) {
        throw apiError(404, "Lease listing not found", "Not Found");
      }

      const auditId = await getNextSequenceValue("audit_logs", session);
      await auditLogs.insertOne(
        {
          id: auditId,
          actorId: currentUser.userId,
          action: "LEASE_TRANSFERRED",
          entityType: "LEASE_LISTING",
          entityId: leaseListingId,
          createdAt: now,
        },
        { session },
      );

      return result;
    });

    const response = toLeaseListingResponse(updated);
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
