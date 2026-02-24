import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import {
  createCourseBodySchema,
  getCoursesQuerySchema,
} from "@/modules/courses/schemas";

type CourseDoc = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
};

type CounterDoc = {
  _id: string;
  value: number;
};

type CourseResponse = {
  id: number;
  code: string;
  name: string;
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toCourseResponse(doc: CourseDoc): CourseResponse | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.code !== "string" ||
    typeof doc.name !== "string"
  ) {
    return null;
  }

  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
  };
}

async function getNextCourseId(): Promise<number> {
  const db = getDb();
  const counters = db.collection<CounterDoc>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: "courses" },
    { $inc: { value: 1 } },
    { returnDocument: "after", upsert: true },
  );

  return result?.value ?? 1;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = getCoursesQuerySchema.safeParse({
      query: searchParams.get("query") ?? undefined,
    });

    if (!parsedQuery.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const searchText = parsedQuery.data.query;
    const db = getDb();
    const courses = db.collection<CourseDoc>("courses");
    const filter =
      searchText && searchText.length > 0
        ? {
            $or: [
              { code: { $regex: escapeRegex(searchText), $options: "i" } },
              { name: { $regex: escapeRegex(searchText), $options: "i" } },
            ],
          }
        : {};

    const rows = await courses
      .find(filter, { projection: { id: 1, code: 1, name: 1 } })
      .sort({ code: 1 })
      .toArray();

    const response: CourseResponse[] = [];

    for (const row of rows) {
      const course = toCourseResponse(row);
      if (!course) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      response.push(course);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const body = await validateJson(req, createCourseBodySchema);
    const db = getDb();
    const courses = db.collection<CourseDoc>("courses");
    const existing = await courses.findOne(
      { code: body.code },
      { projection: { _id: 1 } },
    );

    if (existing) {
      return apiError(400, "Course code already exists", "Bad Request");
    }

    const id = await getNextCourseId();

    await courses.insertOne({
      id,
      code: body.code,
      name: body.name,
    });

    return NextResponse.json(
      {
        id,
        code: body.code,
        name: body.name,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }

    if (error instanceof MongoServerError && error.code === 11000) {
      return apiError(400, "Course code already exists", "Bad Request");
    }

    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
