import { z } from "zod";

const roleSchema = z.enum(["STUDENT", "STAFF", "ADMIN"]);

export const registerBodySchema = z
  .object({
    email: z.string().trim().email("email must be an email"),
    name: z.string().trim().min(1, "name is required"),
    password: z.string().min(1, "password is required"),
  })
  .strip();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email("email must be an email"),
    password: z.string().min(1, "password is required"),
  })
  .strip();

export const patchMeBodySchema = z
  .object({
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    fullName: z.string().trim().min(1, "fullName cannot be empty").optional(),
    avatarUrl: z.string().trim().min(1, "avatarUrl cannot be empty").optional(),
    phone: z.string().trim().min(1, "phone cannot be empty").optional(),
    bio: z.string().trim().min(1, "bio cannot be empty").optional(),
  })
  .strip();

export const authUserSchema = z
  .object({
    id: z.number().int().positive(),
    email: z.string().email(),
    role: roleSchema,
    name: z.string(),
    fullName: z.string().optional(),
    avatarUrl: z.string().nullish(),
    phone: z.string().nullish(),
    bio: z.string().nullish(),
    passwordHash: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strip();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type PatchMeBody = z.infer<typeof patchMeBodySchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
