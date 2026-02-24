import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import {
  createStudySheetBodySchema,
  listStudySheetsQuerySchema,
} from "@/modules/study-sheets/schemas";
import {
  getNextSequenceValue,
  normalizeStudySheet,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

type CourseDoc = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
};

async function findOrCreateCourseByCode(courseCode: string): Promise<CourseDoc | null> {
  const db = getDb();
  const courses = db.collection<CourseDoc>("courses");
  const existing = await courses.findOne({ code: courseCode });
  if (existing) {
    return existing;
  }

  const courseId = await getNextSequenceValue("courses");

  try {
    await courses.insertOne({
      id: courseId,
      code: courseCode,
      name: courseCode,
    });
    return {
      id: courseId,
      code: courseCode,
      name: courseCode,
    };
  } catch {
    return courses.findOne({ code: courseCode });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const body = await validateJson(req, createStudySheetBodySchema);
    const db = getDb();
    const studySheets = db.collection<StudySheetDoc>("study_sheets");
    const course = await findOrCreateCourseByCode(body.courseCode);

    if (!course || typeof course.id !== "number" || !Number.isInteger(course.id)) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const id = await getNextSequenceValue("study_sheets");
    const now = new Date();

    await studySheets.insertOne({
      id,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      fileUrl: body.fileUrl,
      priceCents: body.priceCents,
      status: "PENDING",
      courseId: course.id,
      courseCode: body.courseCode,
      ownerId: currentUser.userId,
      createdAt: now,
      updatedAt: now,
    });

    const created = await studySheets.findOne({ id });
    if (!created) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const response = normalizeStudySheet(created);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = listStudySheetsQuerySchema.safeParse({
      courseCode: searchParams.get("courseCode") ?? undefined,
    });

    if (!parsedQuery.success) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const studySheets = db.collection<StudySheetDoc>("study_sheets");
    const filter: Record<string, unknown> = { status: "APPROVED" };

    if (parsedQuery.data.courseCode) {
      filter.courseCode = parsedQuery.data.courseCode;
    }

    const rows = await studySheets.find(filter).sort({ createdAt: -1 }).toArray();
    const response = [];
    for (const row of rows) {
      const normalized = normalizeStudySheet(row);
      if (!normalized) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      response.push(normalized);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
