import { z } from "zod";

export const getCoursesQuerySchema = z.object({
  query: z.string().trim().optional(),
});

export const createCourseBodySchema = z
  .object({
    code: z.string().trim().min(1, "code is required"),
    name: z.string().trim().min(1, "name is required"),
  })
  .strip();

export type GetCoursesQuery = z.infer<typeof getCoursesQuerySchema>;
export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;
