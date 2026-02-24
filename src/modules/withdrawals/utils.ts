export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type WithdrawalDoc = {
  id?: unknown;
  sellerId?: unknown;
  amount?: unknown;
  status?: unknown;
  reviewedById?: unknown;
  reviewedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type WithdrawalResponse = {
  id: number;
  sellerId: number;
  amount: number;
  status: WithdrawalStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function parseWithdrawalId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function toWithdrawalResponse(doc: WithdrawalDoc): WithdrawalResponse | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.sellerId !== "number" ||
    !Number.isInteger(doc.sellerId) ||
    doc.sellerId <= 0 ||
    typeof doc.amount !== "number" ||
    !Number.isInteger(doc.amount) ||
    doc.amount < 0 ||
    (doc.status !== "PENDING" && doc.status !== "APPROVED" && doc.status !== "REJECTED") ||
    !(doc.createdAt instanceof Date) ||
    !(doc.updatedAt instanceof Date)
  ) {
    return null;
  }

  return {
    id: doc.id,
    sellerId: doc.sellerId,
    amount: doc.amount,
    status: doc.status,
    reviewedById:
      typeof doc.reviewedById === "number" &&
      Number.isInteger(doc.reviewedById) &&
      doc.reviewedById > 0
        ? doc.reviewedById
        : null,
    reviewedAt: doc.reviewedAt instanceof Date ? doc.reviewedAt : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
