import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { moderateLeaseListing } from "@/modules/lease-listings/moderation";
import { rejectLeaseListingBodySchema } from "@/modules/lease-listings/moderation-schemas";
import {
  parseLeaseListingId,
  toLeaseListingResponse,
} from "@/modules/lease-listings/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { id } = await params;
    const leaseListingId = parseLeaseListingId(id);
    if (!leaseListingId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, rejectLeaseListingBodySchema);

    const updated = await withTransaction(async (session, db) =>
      moderateLeaseListing(db, session, {
        leaseListingId,
        actorId: currentUser.userId,
        status: "REJECTED",
        reason: body.reason,
      }),
    );

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
