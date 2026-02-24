import { NextResponse } from "next/server";

import { signJwt, type JwtRole } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { loginBodySchema } from "@/modules/auth/schemas";

type LoginUserDoc = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  passwordHash?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await validateJson(req, loginBodySchema);
    const db = getDb();
    const users = db.collection<LoginUserDoc>("users");

    const user = await users.findOne(
      { email: body.email },
      { projection: { id: 1, role: 1, passwordHash: 1 } },
    );

    if (!user || typeof user.passwordHash !== "string") {
      return apiError(401, "Invalid credentials", "Unauthorized");
    }

    const validPassword = await verifyPassword(body.password, user.passwordHash);

    if (!validPassword) {
      return apiError(401, "Invalid credentials", "Unauthorized");
    }

    if (
      typeof user.id !== "number" ||
      !Number.isInteger(user.id) ||
      user.id <= 0 ||
      (user.role !== "STUDENT" && user.role !== "STAFF" && user.role !== "ADMIN")
    ) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(
      {
        access_token: signJwt({ userId: user.id, role: user.role as JwtRole }),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
