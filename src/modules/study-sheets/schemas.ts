import { z } from "zod";

export const createStudySheetBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required"),
    description: z.string().trim().optional(),
    fileUrl: z.string().trim().min(1, "fileUrl is required"),
    priceCents: z.number().int().min(0, "priceCents must be >= 0"),
    courseCode: z.string().trim().min(1, "courseCode is required"),
  })
  .strip();

export const listStudySheetsQuerySchema = z.object({
  courseCode: z.string().trim().optional(),
});

export const updateStudySheetBodySchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),
    description: z.string().trim().optional(),
    fileUrl: z.string().trim().min(1, "fileUrl cannot be empty").optional(),
    priceCents: z.number().int().min(0, "priceCents must be >= 0").optional(),
  })
  .strip();

export type CreateStudySheetBody = z.infer<typeof createStudySheetBodySchema>;
export type UpdateStudySheetBody = z.infer<typeof updateStudySheetBodySchema>;
