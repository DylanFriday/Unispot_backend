import { z } from "zod";

export const studySheetModerationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const listModerationStudySheetsQuerySchema = z.object({
  status: studySheetModerationStatusSchema,
});

export const rejectStudySheetBodySchema = z
  .object({
    reason: z.string().trim().min(1, "reason is required"),
  })
  .strip();

export type StudySheetModerationStatus = z.infer<
  typeof studySheetModerationStatusSchema
>;
