import { z } from "zod";

export const createCourseTeacherBodySchema = z
  .object({
    teacherName: z.string().trim().min(1, "teacherName is required"),
  })
  .strip();

export type CreateCourseTeacherBody = z.infer<typeof createCourseTeacherBodySchema>;
