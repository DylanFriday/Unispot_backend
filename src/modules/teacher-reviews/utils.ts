export type TeacherReviewStatus = "VISIBLE" | "UNDER_REVIEW" | "REMOVED";

export type TeacherReviewDoc = {
  id?: unknown;
  studentId?: unknown;
  courseId?: unknown;
  teacherId?: unknown;
  teacherName?: unknown;
  normalizedName?: unknown;
  rating?: unknown;
  text?: unknown;
  status?: unknown;
  reviewedById?: unknown;
  reviewedAt?: unknown;
  decisionReason?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function parseTeacherReviewId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseCourseId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseTeacherId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function normalizeTeacherName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function toTeacherReviewResponse(doc: TeacherReviewDoc): {
  id: number;
  studentId: number;
  courseId: number;
  teacherId: number | null;
  teacherName: string;
  normalizedName: string;
  rating: number;
  text: string;
  status: TeacherReviewStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.studentId !== "number" ||
    !Number.isInteger(doc.studentId) ||
    doc.studentId <= 0 ||
    typeof doc.courseId !== "number" ||
    !Number.isInteger(doc.courseId) ||
    doc.courseId <= 0 ||
    typeof doc.teacherName !== "string" ||
    typeof doc.normalizedName !== "string" ||
    typeof doc.rating !== "number" ||
    !Number.isInteger(doc.rating) ||
    doc.rating < 1 ||
    doc.rating > 5 ||
    typeof doc.text !== "string" ||
    (doc.status !== "VISIBLE" &&
      doc.status !== "UNDER_REVIEW" &&
      doc.status !== "REMOVED") ||
    !(doc.createdAt instanceof Date) ||
    !(doc.updatedAt instanceof Date)
  ) {
    return null;
  }

  return {
    id: doc.id,
    studentId: doc.studentId,
    courseId: doc.courseId,
    teacherId:
      typeof doc.teacherId === "number" &&
      Number.isInteger(doc.teacherId) &&
      doc.teacherId > 0
        ? doc.teacherId
        : null,
    teacherName: doc.teacherName,
    normalizedName: doc.normalizedName,
    rating: doc.rating,
    text: doc.text,
    status: doc.status,
    reviewedById:
      typeof doc.reviewedById === "number" &&
      Number.isInteger(doc.reviewedById) &&
      doc.reviewedById > 0
        ? doc.reviewedById
        : null,
    reviewedAt: doc.reviewedAt instanceof Date ? doc.reviewedAt : null,
    decisionReason: typeof doc.decisionReason === "string" ? doc.decisionReason : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
