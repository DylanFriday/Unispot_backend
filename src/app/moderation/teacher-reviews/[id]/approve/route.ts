import { MongoServerError, type Collection, type ClientSession } from "mongodb";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { getNextSequenceValue } from "@/modules/study-sheets/utils";
import {
  parseTeacherReviewId,
  toTeacherReviewResponse,
  type TeacherReviewDoc,
} from "@/modules/teacher-reviews/utils";

type TeacherDoc = {
  id?: unknown;
  name?: unknown;
};

type CourseTeacherDoc = {
  id?: unknown;
  courseId: number;
  teacherId: number;
};

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  createdAt: Date;
};

async function findOrCreateTeacherByNameTx(
  name: string,
  deps: {
    teachers: Collection<TeacherDoc>;
    session: ClientSession;
  },
): Promise<TeacherDoc | null> {
  const existing = await deps.teachers.findOne(
    { name },
    { projection: { id: 1, name: 1 }, session: deps.session },
  );
  if (existing) return existing;

  const teacherId = await getNextSequenceValue("teachers", deps.session);
  try {
    await deps.teachers.insertOne({ id: teacherId, name }, { session: deps.session });
    return { id: teacherId, name };
  } catch (error: unknown) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }
    return deps.teachers.findOne(
      { name },
      { projection: { id: 1, name: 1 }, session: deps.session },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);
    const { id } = await params;
    const reviewId = parseTeacherReviewId(id);
    if (!reviewId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const updated = await withTransaction<TeacherReviewDoc>(async (session, db) => {
      const teacherReviews = db.collection<TeacherReviewDoc>("teacher_reviews");
      const teachers = db.collection<TeacherDoc>("teachers");
      const courseTeachers = db.collection<CourseTeacherDoc>("course_teachers");
      const auditLogs = db.collection<AuditLogDoc>("audit_logs");

      const review = await teacherReviews.findOne({ id: reviewId }, { session });
      if (!review) {
        throw apiError(404, "Teacher review not found", "Not Found");
      }
      if (
        typeof review.teacherName !== "string" ||
        typeof review.courseId !== "number" ||
        !Number.isInteger(review.courseId) ||
        review.courseId <= 0
      ) {
        throw apiError(500, "Internal Server Error", "Internal Server Error");
      }

      const teacher = await findOrCreateTeacherByNameTx(review.teacherName, {
        teachers,
        session,
      });
      if (!teacher || typeof teacher.id !== "number" || !Number.isInteger(teacher.id)) {
        throw apiError(500, "Internal Server Error", "Internal Server Error");
      }

      const linkExists = await courseTeachers.findOne(
        { courseId: review.courseId, teacherId: teacher.id },
        { projection: { _id: 1 }, session },
      );
      if (!linkExists) {
        const linkId = await getNextSequenceValue("course_teachers", session);
        try {
          await courseTeachers.insertOne(
            { id: linkId, courseId: review.courseId, teacherId: teacher.id },
            { session },
          );
        } catch (error: unknown) {
          if (!(error instanceof MongoServerError) || error.code !== 11000) {
            throw error;
          }
        }
      }

      const now = new Date();
      const result = await teacherReviews.findOneAndUpdate(
        { id: reviewId },
        {
          $set: {
            teacherId: teacher.id,
            status: "VISIBLE",
            reviewedById: currentUser.userId,
            reviewedAt: now,
            decisionReason: null,
            updatedAt: now,
          },
        },
        { returnDocument: "after", session },
      );
      if (!result) {
        throw apiError(404, "Teacher review not found", "Not Found");
      }

      const auditId = await getNextSequenceValue("audit_logs", session);
      await auditLogs.insertOne(
        {
          id: auditId,
          actorId: currentUser.userId,
          action: "TEACHER_REVIEW_APPROVED",
          entityType: "TEACHER_REVIEW",
          entityId: reviewId,
          createdAt: now,
        },
        { session },
      );

      return result;
    });

    const response = toTeacherReviewResponse(updated);
    if (!response) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }
    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
