import { type ClientSession } from "mongodb";

import { getDb } from "@/lib/db";

export type StudySheetStatus = "PENDING" | "APPROVED" | "REJECTED";

export type StudySheetDoc = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  fileUrl?: unknown;
  priceCents?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  ownerId?: unknown;
  courseId?: unknown;
  courseCode?: unknown;
};

export type PurchaseDoc = {
  id?: unknown;
  buyerId?: unknown;
  studySheetId?: unknown;
  amountCents?: unknown;
  createdAt?: unknown;
};

export type PaymentDoc = {
  id?: unknown;
  purchaseId?: unknown;
  referenceCode?: unknown;
  amount?: unknown;
  status?: unknown;
  buyerId?: unknown;
  sellerId?: unknown;
  studySheetId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type CounterDoc = {
  _id: string;
  value: number;
};

export function parsePositiveInt(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function getNextSequenceValue(
  sequenceName: string,
  session?: ClientSession,
): Promise<number> {
  const db = getDb();
  const counters = db.collection<CounterDoc>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { value: 1 } },
    { returnDocument: "after", upsert: true, session },
  );

  return result?.value ?? 1;
}

export function normalizeStudySheet(
  doc: StudySheetDoc,
): {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  priceCents: number;
  status: StudySheetStatus;
  createdAt: Date;
  updatedAt: Date;
  ownerId: number;
  courseId: number;
  courseCode: string;
} | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.title !== "string" ||
    typeof doc.fileUrl !== "string" ||
    typeof doc.priceCents !== "number" ||
    !Number.isInteger(doc.priceCents) ||
    doc.priceCents < 0 ||
    (doc.status !== "PENDING" && doc.status !== "APPROVED" && doc.status !== "REJECTED") ||
    !(doc.createdAt instanceof Date) ||
    !(doc.updatedAt instanceof Date) ||
    typeof doc.ownerId !== "number" ||
    !Number.isInteger(doc.ownerId) ||
    doc.ownerId <= 0 ||
    typeof doc.courseId !== "number" ||
    !Number.isInteger(doc.courseId) ||
    doc.courseId <= 0 ||
    typeof doc.courseCode !== "string"
  ) {
    return null;
  }

  return {
    id: doc.id,
    title: doc.title,
    description: typeof doc.description === "string" ? doc.description : null,
    fileUrl: doc.fileUrl,
    priceCents: doc.priceCents,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ownerId: doc.ownerId,
    courseId: doc.courseId,
    courseCode: doc.courseCode,
  };
}

export function makeReferenceCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REF-${stamp}-${rand}`;
}
