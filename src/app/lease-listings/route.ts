import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import { createLeaseListingBodySchema } from "@/modules/lease-listings/schemas";
import {
  toLeaseListingResponse,
  type LeaseListingDoc,
} from "@/modules/lease-listings/utils";

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const leaseListings = db.collection<LeaseListingDoc>("lease_listings");
    const rows = await leaseListings
      .find({ status: "APPROVED" })
      .sort({ createdAt: -1 })
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

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const body = await validateJson(req, createLeaseListingBodySchema);
    const db = getDb();
    const leaseListings = db.collection<LeaseListingDoc>("lease_listings");

    const now = new Date();
    const id = await getNextSequenceValue("lease_listings");
    const doc: LeaseListingDoc = {
      id,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      lineId: body.lineId ?? null,
      location: body.location,
      rentCents: body.rentCents,
      depositCents: body.depositCents,
      startDate: body.startDate,
      endDate: body.endDate,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
      ownerId: currentUser.userId,
    };

    await leaseListings.insertOne(doc);
    const response = toLeaseListingResponse(doc);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
