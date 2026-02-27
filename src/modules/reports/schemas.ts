import { z } from "zod";

export const reportStatusSchema = z.enum(["PENDING", "RESOLVED", "REJECTED"]);

export const reportTargetTypeSchema = z.enum(["REVIEW", "TEACHER_REVIEW"]);

export const updateReportStatusBodySchema = z
  .object({
    status: z.enum(["RESOLVED", "REJECTED"]),
  })
  .strip();
