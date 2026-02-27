import { z } from "zod";

export const leaseModerationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const listModerationLeaseListingsQuerySchema = z.object({
  status: leaseModerationStatusSchema,
});

export const rejectLeaseListingBodySchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required"),
  })
  .strip();
