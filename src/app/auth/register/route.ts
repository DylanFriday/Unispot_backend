import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { signJwt } from "@/lib/auth/jwt";
import { hashPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { registerBodySchema } from "@/modules/auth/schemas";
import { type UserDoc } from "@/modules/users/types";

type CounterDoc = {
  _id: string;
  value: number;
};

async function getNextUserId(): Promise<number> {
  const db = getDb();
  const counters = db.collection<CounterDoc>("counters");

  const result = await counters.findOneAndUpdate(
    { _id: "users" },
    { $inc: { value: 1 } },
    { returnDocument: "after", upsert: true },
  );

  return result?.value ?? 1;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await validateJson(req, registerBodySchema);
    const db = getDb();
    const users = db.collection<UserDoc>("users");

    const existingUser = await users.findOne(
      { email: body.email },
      { projection: { _id: 1 } },
    );

    if (existingUser) {
      return apiError(400, "Email already exists", "Bad Request");
    }

    const [id, passwordHash] = await Promise.all([
      getNextUserId(),
      hashPassword(body.password),
    ]);

    const now = new Date();

    await users.insertOne({
      id,
      email: body.email,
      role: "STUDENT",
      name: body.name,
      passwordHash,
      walletBalance: 0,
      avatarUrl: null,
      phone: null,
      bio: null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        access_token: signJwt({ userId: id, role: "STUDENT" }),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    if (error instanceof MongoServerError && error.code === 11000) {
      return apiError(400, "Email already exists", "Bad Request");
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
