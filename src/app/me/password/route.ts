import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";

const PASSWORD_CHANGE_COOLDOWN_MS = 60 * 1000;
const passwordCooldownUntilByUserId = new Map<number, number>();

type PasswordUserDoc = {
  id?: unknown;
  passwordHash?: unknown;
};

const patchPasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, "currentPassword is required"),
    newPassword: z.string().min(1, "newPassword is required"),
  })
  .strip();

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    const body = await validateJson(req, patchPasswordBodySchema);
    const now = Date.now();
    const cooldownUntil = passwordCooldownUntilByUserId.get(currentUser.userId) ?? 0;

    if (cooldownUntil > now) {
      return apiError(
        400,
        "Please wait 1 minute before changing password again",
        "Bad Request",
      );
    }

    const db = getDb();
    const users = db.collection<PasswordUserDoc>("users");
    const user = await users.findOne(
      { id: currentUser.userId },
      { projection: { id: 1, passwordHash: 1 } },
    );

    if (!user) {
      return apiError(404, "User not found", "Not Found");
    }

    if (typeof user.passwordHash !== "string") {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const isCurrentPasswordValid = await verifyPassword(
      body.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      return apiError(400, "Current password is incorrect", "Bad Request");
    }

    const newPasswordHash = await hashPassword(body.newPassword);

    await users.updateOne(
      { id: currentUser.userId },
      { $set: { passwordHash: newPasswordHash, updatedAt: new Date() } },
    );

    passwordCooldownUntilByUserId.set(
      currentUser.userId,
      now + PASSWORD_CHANGE_COOLDOWN_MS,
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
