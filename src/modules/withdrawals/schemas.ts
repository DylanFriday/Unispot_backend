import { z } from "zod";

export const createWithdrawalBodySchema = z
  .object({
    amountCents: z.number().int().positive("amountCents must be greater than 0"),
  })
  .strip();

export const withdrawalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
