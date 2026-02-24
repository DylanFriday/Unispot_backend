import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { createCourseTeacherBodySchema } from "@/modules/teachers/schemas";

type CounterDoc = {
  _id: string;
  value: number;
};

type CourseDoc = {
  id?: unknown;
};

type TeacherDoc = {
  id?: unknown;
  name?: unknown;
};

type CourseTeacherDoc = {
  courseId?: unknown;
  teacherId?: unknown;
};

type TeacherResponse = {
  id: number;
  name: string;
};

function parseCourseId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toTeacherResponse(doc: TeacherDoc): TeacherResponse | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.name !== "string"
  ) {
    return null;
  }

  return {
    id: doc.id,
    name: doc.name,
  };
}

async function getNextTeacherId(): Promise<number> {
  const db = getDb();
  const counters = db.collection<CounterDoc>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: "teachers" },
    { $inc: { value: 1 } },
    { returnDocument: "after", upsert: true },
  );

  return result?.value ?? 1;
}

async function findOrCreateTeacherByName(name: string): Promise<TeacherDoc | null> {
  const db = getDb();
  const teachers = db.collection<TeacherDoc>("teachers");

  const existing = await teachers.findOne(
    { name },
    { projection: { id: 1, name: 1 } },
  );
  if (existing) {
    return existing;
  }

  const teacherId = await getNextTeacherId();

  try {
    await teachers.insertOne({ id: teacherId, name });
    return {
      id: teacherId,
      name,
    };
  } catch (error: unknown) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }

    return teachers.findOne(
      { name },
      { projection: { id: 1, name: 1 } },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const courseId = parseCourseId(id);

    if (!courseId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const db = getDb();
    const courseTeachers = db.collection<CourseTeacherDoc>("course_teachers");
    const teachers = db.collection<TeacherDoc>("teachers");

    const links = await courseTeachers
      .find({ courseId }, { projection: { teacherId: 1 } })
      .toArray();

    const teacherIds = links
      .map((link) => link.teacherId)
      .filter((teacherId): teacherId is number => {
        return (
          typeof teacherId === "number" &&
          Number.isInteger(teacherId) &&
          teacherId > 0
        );
      });

    if (teacherIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const rows = await teachers
      .find(
        { id: { $in: teacherIds } },
        {
          projection: { id: 1, name: 1 },
        },
      )
      .sort({ name: 1 })
      .toArray();

    const response: TeacherResponse[] = [];
    for (const row of rows) {
      const teacher = toTeacherResponse(row);
      if (!teacher) {
        return apiError(500, "Internal Server Error", "Internal Server Error");
      }
      response.push(teacher);
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { id } = await params;
    const courseId = parseCourseId(id);
    if (!courseId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, createCourseTeacherBodySchema);
    const db = getDb();
    const courses = db.collection<CourseDoc>("courses");
    const courseTeachers = db.collection<CourseTeacherDoc>("course_teachers");

    const existingCourse = await courses.findOne(
      { id: courseId },
      { projection: { id: 1 } },
    );
    if (!existingCourse) {
      return apiError(404, "Course not found", "Not Found");
    }

    const teacherDoc = await findOrCreateTeacherByName(body.teacherName);
    if (!teacherDoc) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    const teacher = toTeacherResponse(teacherDoc);
    if (!teacher) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    try {
      await courseTeachers.updateOne(
        { courseId, teacherId: teacher.id },
        { $setOnInsert: { courseId, teacherId: teacher.id } },
        { upsert: true },
      );
    } catch (error: unknown) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) {
        throw error;
      }
    }

    return NextResponse.json(teacher, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
