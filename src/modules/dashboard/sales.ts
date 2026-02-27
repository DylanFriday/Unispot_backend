export type PaymentStatus = "PENDING" | "APPROVED" | "RELEASED";

export type PaymentDoc = {
  id?: unknown;
  amount?: unknown;
  status?: unknown;
  createdAt?: unknown;
  buyerId?: unknown;
  referenceCode?: unknown;
  sellerId?: unknown;
};

export type RecentSale = {
  id: number;
  amountCents: number;
  status: PaymentStatus;
  createdAt: Date;
  buyerId: number;
  referenceCode?: string;
};

export type MonthlyRevenuePoint = {
  month: string;
  amountCents: number;
};

export type MonthlyRevenueAggRow = {
  month?: unknown;
  amountCents?: unknown;
};

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return value === "PENDING" || value === "APPROVED" || value === "RELEASED";
}

function toMonthKeyUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getLast12MonthKeys(now: Date): string[] {
  const keys: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let offset = 11; offset >= 0; offset -= 1) {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - offset);
    keys.push(toMonthKeyUtc(d));
  }

  return keys;
}

export function getMonthlyRevenueWindow(now: Date): { start: Date; endExclusive: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  start.setUTCMonth(start.getUTCMonth() - 11);

  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, endExclusive };
}

export function buildRecentSalesFilter(sellerId: number): { sellerId: number } {
  return { sellerId };
}

export function buildMonthlyRevenuePipeline(sellerId: number, now: Date): object[] {
  const { start, endExclusive } = getMonthlyRevenueWindow(now);

  return [
    {
      $match: {
        sellerId,
        status: { $in: ["APPROVED", "RELEASED"] },
        createdAt: { $gte: start, $lt: endExclusive },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m",
            date: "$createdAt",
            timezone: "UTC",
          },
        },
        amountCents: { $sum: { $ifNull: ["$amount", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        month: "$_id",
        amountCents: 1,
      },
    },
    { $sort: { month: 1 } },
  ];
}

export function toRecentSale(doc: PaymentDoc): RecentSale | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    !isPaymentStatus(doc.status) ||
    !(doc.createdAt instanceof Date) ||
    typeof doc.buyerId !== "number" ||
    !Number.isInteger(doc.buyerId) ||
    doc.buyerId <= 0
  ) {
    return null;
  }

  const base: RecentSale = {
    id: doc.id,
    amountCents: asInt(doc.amount),
    status: doc.status,
    createdAt: doc.createdAt,
    buyerId: doc.buyerId,
  };

  if (typeof doc.referenceCode === "string" && doc.referenceCode.length > 0) {
    return { ...base, referenceCode: doc.referenceCode };
  }

  return base;
}

export function toMonthlyRevenue(
  rows: MonthlyRevenueAggRow[],
  now: Date,
): MonthlyRevenuePoint[] {
  const seed = new Map<string, number>();
  for (const key of getLast12MonthKeys(now)) {
    seed.set(key, 0);
  }

  for (const row of rows) {
    if (typeof row.month !== "string") continue;
    if (!seed.has(row.month)) continue;
    seed.set(row.month, asInt(row.amountCents));
  }

  return Array.from(seed.entries()).map(([month, amountCents]) => ({
    month,
    amountCents,
  }));
}
