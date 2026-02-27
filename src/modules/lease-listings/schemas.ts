import { z } from "zod";

export const createLeaseListingBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    description: z.string().trim().optional(),
    lineId: z.string().trim().nullable().optional(),
    location: z.string().trim().min(1, "location is required"),
    rentCents: z.number().int().min(0, "rentCents must be >= 0"),
    depositCents: z.number().int().min(0, "depositCents must be >= 0"),
    startDate: z.string().trim().min(1, "startDate is required"),
    endDate: z.string().trim().min(1, "endDate is required"),
  })
  .strip();

export const updateLeaseListingBodySchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),
    description: z.string().trim().optional(),
    lineId: z.string().trim().nullable().optional(),
    location: z.string().trim().min(1, "location cannot be empty").optional(),
    rentCents: z.number().int().min(0, "rentCents must be >= 0").optional(),
    depositCents: z.number().int().min(0, "depositCents must be >= 0").optional(),
    startDate: z.string().trim().min(1, "startDate cannot be empty").optional(),
    endDate: z.string().trim().min(1, "endDate cannot be empty").optional(),
  })
  .strip();
