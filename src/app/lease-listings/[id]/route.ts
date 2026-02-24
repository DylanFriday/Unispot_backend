import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { updateLeaseListingBodySchema } from "@/modules/lease-listings/schemas";
import {
  parseLeaseListingId,
  toLeaseListingResponse,
  type LeaseListingDoc,
} from "@/modules/lease-listings/utils";

export async function PATCH(
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

    const body = await validateJson(req, updateLeaseListingBodySchema);
    const db = getDb();
    const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
    const existing = await leaseListings.findOne({ id: leaseListingId });

    if (!existing) {
      return apiError(404, "Lease listing not found", "Not Found");
    }
    if (existing.ownerId !== currentUser.userId) {
      return apiError(403, "Forbidden", "Forbidden");
    }

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string") updateSet.title = body.title;
    if (typeof body.description === "string") updateSet.description = body.description;
    if (body.lineId === null || typeof body.lineId === "string") {
      updateSet.lineId = body.lineId;
    }
    if (typeof body.location === "string") updateSet.location = body.location;
    if (typeof body.rentCents === "number") updateSet.rentCents = body.rentCents;
    if (typeof body.depositCents === "number") updateSet.depositCents = body.depositCents;
    if (typeof body.startDate === "string") updateSet.startDate = body.startDate;
    if (typeof body.endDate === "string") updateSet.endDate = body.endDate;

    const updated = await leaseListings.findOneAndUpdate(
      { id: leaseListingId },
      { $set: updateSet },
      { returnDocument: "after" },
    );
    if (!updated) {
      return apiError(404, "Lease listing not found", "Not Found");
    }

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

export async function DELETE(
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
    const existing = await leaseListings.findOne({ id: leaseListingId });
    if (!existing) {
      return apiError(404, "Lease listing not found", "Not Found");
    }
    if (existing.ownerId !== currentUser.userId) {
      return apiError(403, "Forbidden", "Forbidden");
    }

    const deleted = await leaseListings.findOneAndDelete({ id: leaseListingId });
    if (!deleted) {
      return apiError(404, "Lease listing not found", "Not Found");
    }

    const response = toLeaseListingResponse(deleted);
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
