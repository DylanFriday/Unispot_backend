import { z } from "zod";

export const teacherReviewStatusSchema = z.enum([
  "VISIBLE",
  "UNDER_REVIEW",
  "REMOVED",
]);

export const createTeacherReviewBodySchema = z
  .object({
    courseId: z.number().int().positive("courseId must be a positive integer"),
    teacherName: z.string().trim().min(1, "teacherName is required"),
    rating: z.number().int().min(1, "rating must be at least 1").max(5, "rating must be at most 5"),
    text: z.string().trim().min(1, "text is required"),
  })
  .strip();

export const updateTeacherReviewBodySchema = z
  .object({
    rating: z.number().int().min(1, "rating must be at least 1").max(5, "rating must be at most 5"),
    text: z.string().trim().min(1, "text is required"),
  })
  .strip();

export const reportTeacherReviewBodySchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required").optional(),
  })
  .strip();

export const teacherReviewModerationRemoveBodySchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required").optional(),
  })
  .strip();
