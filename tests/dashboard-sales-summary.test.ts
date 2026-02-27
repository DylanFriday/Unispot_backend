import { describe, expect, it } from "vitest";

import {
  buildMonthlyRevenuePipeline,
  buildRecentSalesFilter,
  getLast12MonthKeys,
  toMonthlyRevenue,
  toRecentSale,
} from "../src/modules/dashboard/sales";

describe("dashboard sales summary helpers", () => {
  it("returns 12 zero-filled months when there are no sales", () => {
    const now = new Date("2026-02-26T00:00:00.000Z");

    const monthly = toMonthlyRevenue([], now);

    expect(monthly).toHaveLength(12);
    expect(monthly.every((row) => row.amountCents === 0)).toBe(true);
    expect(monthly.map((row) => row.month)).toEqual(getLast12MonthKeys(now));
  });

  it("uses APPROVED and RELEASED statuses for monthly revenue aggregation", () => {
    const now = new Date("2026-02-26T00:00:00.000Z");

    const pipeline = buildMonthlyRevenuePipeline(88, now);
    const firstStage = pipeline[0] as {
      $match?: {
        sellerId?: number;
        status?: { $in?: string[] };
      };
    };

    expect(firstStage.$match?.sellerId).toBe(88);
    expect(firstStage.$match?.status?.$in).toEqual(["APPROVED", "RELEASED"]);
  });

  it("groups monthly revenue correctly and keeps month order", () => {
    const now = new Date("2026-02-26T00:00:00.000Z");

    const monthly = toMonthlyRevenue(
      [
        { month: "2025-10", amountCents: 1200 },
        { month: "2026-01", amountCents: 3400 },
        { month: "2024-12", amountCents: 9999 },
      ],
      now,
    );

    expect(monthly).toHaveLength(12);
    expect(monthly[7]).toEqual({ month: "2025-10", amountCents: 1200 });
    expect(monthly[10]).toEqual({ month: "2026-01", amountCents: 3400 });
    expect(monthly.find((row) => row.month === "2024-12")).toBeUndefined();
  });

  it("builds seller-scoped recent sales filter and maps recent sale shape", () => {
    expect(buildRecentSalesFilter(42)).toEqual({ sellerId: 42 });

    const recent = toRecentSale({
      id: 9,
      amount: 2500,
      status: "APPROVED",
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      buyerId: 77,
      referenceCode: "PAY-XYZ",
    });

    expect(recent).toEqual({
      id: 9,
      amountCents: 2500,
      status: "APPROVED",
      createdAt: new Date("2026-02-20T00:00:00.000Z"),
      buyerId: 77,
      referenceCode: "PAY-XYZ",
    });
  });
});
