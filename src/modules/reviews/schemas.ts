import { z } from "zod";

export const createReviewBodySchema = z
  .object({
    courseId: z.number().int().positive("courseId must be a positive integer"),
    rating: z.number().int().min(1, "rating must be at least 1").max(5, "rating must be at most 5"),
    text: z.string().trim().min(1, "text is required"),
  })
  .strip();

export const updateReviewBodySchema = z
  .object({
    rating: z.number().int().min(1, "rating must be at least 1").max(5, "rating must be at most 5"),
    text: z.string().trim().min(1, "text is required"),
  })
  .strip();

export const reportReviewBodySchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required"),
  })
  .strip();
