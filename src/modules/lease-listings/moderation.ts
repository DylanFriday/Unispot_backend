import { type ClientSession, type Db } from "mongodb";

import { apiError } from "@/lib/errors";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { type LeaseListingDoc } from "@/modules/lease-listings/utils";

type LeaseApprovalDoc = {
  id?: unknown;
  leaseListingId: number;
  reviewerId: number;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
  createdAt: Date;
};

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: Date;
};

export async function moderateLeaseListing(
  db: Db,
  session: ClientSession,
  params: {
    leaseListingId: number;
    actorId: number;
    status: string;
    reason?: string | null;
  },
): Promise<LeaseListingDoc> {
  const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
  const leaseApprovals = db.collection<LeaseApprovalDoc>("lease_approvals");
  const auditLogs = db.collection<AuditLogDoc>("audit_logs");

  const existing = await leaseListings.findOne({ id: params.leaseListingId }, { session });
  if (!existing) {
    throw apiError(404, "Lease listing not found", "Not Found");
  }

  const now = new Date();
  const updated = await leaseListings.findOneAndUpdate(
    { id: params.leaseListingId },
    {
      $set: {
        status: params.status,
        updatedAt: now,
      },
    },
    { returnDocument: "after", session },
  );
  if (!updated) {
    throw apiError(404, "Lease listing not found", "Not Found");
  }

  await leaseApprovals.deleteOne({ leaseListingId: params.leaseListingId }, { session });
  const approvalId = await getNextSequenceValue("lease_approvals", session);
  await leaseApprovals.insertOne(
    {
      id: approvalId,
      leaseListingId: params.leaseListingId,
      reviewerId: params.actorId,
      decision: params.status as "APPROVED" | "REJECTED",
      reason: params.reason ?? null,
      createdAt: now,
    },
    { session },
  );

  const auditId = await getNextSequenceValue("audit_logs", session);
  await auditLogs.insertOne(
    {
      id: auditId,
      actorId: params.actorId,
      action:
        params.status === "APPROVED"
          ? "LEASE_LISTING_APPROVED"
          : "LEASE_LISTING_REJECTED",
      entityType: "LEASE_LISTING",
      entityId: params.leaseListingId,
      createdAt: now,
    },
    { session },
  );

  return updated;
}
