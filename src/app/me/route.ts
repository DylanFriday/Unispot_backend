import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/requireAuth";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";

type UserRole = "STUDENT" | "STAFF" | "ADMIN";

type UserProfileDoc = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  phone?: unknown;
  bio?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ProfileResponse = {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const patchMeBodySchema = z
  .object({
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    fullName: z.string().trim().min(1, "fullName cannot be empty").optional(),
    avatarUrl: z.string().trim().min(1, "avatarUrl cannot be empty").optional(),
    phone: z.string().trim().min(1, "phone cannot be empty").optional(),
    bio: z.string().trim().min(1, "bio cannot be empty").optional(),
  })
  .strip();

function toProfileResponse(user: UserProfileDoc): ProfileResponse | null {
  if (
    typeof user.id !== "number" ||
    !Number.isInteger(user.id) ||
    user.id <= 0 ||
    typeof user.email !== "string" ||
    (user.role !== "STUDENT" && user.role !== "STAFF" && user.role !== "ADMIN") ||
    typeof user.name !== "string" ||
    !(user.createdAt instanceof Date) ||
    !(user.updatedAt instanceof Date)
  ) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    fullName: user.name,
    avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : null,
    phone: typeof user.phone === "string" ? user.phone : null,
    bio: typeof user.bio === "string" ? user.bio : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    const db = getDb();
    const users = db.collection<UserProfileDoc>("users");

    const user = await users.findOne(
      { id: currentUser.userId },
      {
        projection: {
          id: 1,
          email: 1,
          role: 1,
          name: 1,
          avatarUrl: 1,
          phone: 1,
          bio: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );

    if (!user) {
      return apiError(404, "User not found", "Not Found");
    }

    const profile = toProfileResponse(user);

    if (!profile) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    const body = await validateJson(req, patchMeBodySchema);
    const db = getDb();
    const users = db.collection<UserProfileDoc>("users");

    const name = body.name ?? body.fullName;
    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof name === "string") {
      updateSet.name = name;
    }

    if (typeof body.avatarUrl === "string") {
      updateSet.avatarUrl = body.avatarUrl;
    }

    if (typeof body.phone === "string") {
      updateSet.phone = body.phone;
    }

    if (typeof body.bio === "string") {
      updateSet.bio = body.bio;
    }

    const updatedUser = await users.findOneAndUpdate(
      { id: currentUser.userId },
      { $set: updateSet },
      {
        returnDocument: "after",
        projection: {
          id: 1,
          email: 1,
          role: 1,
          name: 1,
          avatarUrl: 1,
          phone: 1,
          bio: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );

    if (!updatedUser) {
      return apiError(404, "User not found", "Not Found");
    }

    const profile = toProfileResponse(updatedUser);

    if (!profile) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
