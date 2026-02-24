import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { listModerationLeaseListingsQuerySchema } from "@/modules/lease-listings/moderation-schemas";
import {
  toLeaseListingResponse,
  type LeaseListingDoc,
} from "@/modules/lease-listings/utils";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { searchParams } = new URL(req.url);
    const parsedQuery = listModerationLeaseListingsQuerySchema.safeParse({
      status: searchParams.get("status"),
    });
    if (!parsedQuery.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
    const rows = await leaseListings
      .find({ status: parsedQuery.data.status })
      .sort({ createdAt: 1 })
      .toArray();

    const response = [];
    for (const row of rows) {
      const normalized = toLeaseListingResponse(row);
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
