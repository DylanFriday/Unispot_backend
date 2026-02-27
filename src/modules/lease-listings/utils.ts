export type LeaseStatus = "PENDING" | "APPROVED" | "REJECTED" | "TRANSFERRED";

export type LeaseListingDoc = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  lineId?: unknown;
  location?: unknown;
  rentCents?: unknown;
  depositCents?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  ownerId?: unknown;
};

export type LeaseListingResponse = {
  id: number;
  title: string;
  description: string | null;
  lineId: string | null;
  location: string;
  rentCents: number;
  depositCents: number;
  startDate: string;
  endDate: string;
  status: LeaseStatus;
  createdAt: Date;
  updatedAt: Date;
  ownerId: number;
};

export function parseLeaseListingId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function toLeaseListingResponse(
  doc: LeaseListingDoc,
): LeaseListingResponse | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.title !== "string" ||
    typeof doc.location !== "string" ||
    typeof doc.rentCents !== "number" ||
    !Number.isInteger(doc.rentCents) ||
    doc.rentCents < 0 ||
    typeof doc.depositCents !== "number" ||
    !Number.isInteger(doc.depositCents) ||
    doc.depositCents < 0 ||
    typeof doc.startDate !== "string" ||
    typeof doc.endDate !== "string" ||
    (doc.status !== "PENDING" &&
      doc.status !== "APPROVED" &&
      doc.status !== "REJECTED" &&
      doc.status !== "TRANSFERRED") ||
    !(doc.createdAt instanceof Date) ||
    !(doc.updatedAt instanceof Date) ||
    typeof doc.ownerId !== "number" ||
    !Number.isInteger(doc.ownerId) ||
    doc.ownerId <= 0
  ) {
    return null;
  }

  return {
    id: doc.id,
    title: doc.title,
    description: typeof doc.description === "string" ? doc.description : null,
    lineId: typeof doc.lineId === "string" ? doc.lineId : null,
    location: doc.location,
    rentCents: doc.rentCents,
    depositCents: doc.depositCents,
    startDate: doc.startDate,
    endDate: doc.endDate,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ownerId: doc.ownerId,
  };
}
