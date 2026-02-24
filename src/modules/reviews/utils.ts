export type ReviewStatus = "VISIBLE" | "UNDER_REVIEW" | "REMOVED";

export type ReviewDoc = {
  id?: unknown;
  rating?: unknown;
  text?: unknown;
  status?: unknown;
  studentId?: unknown;
  courseId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function parseReviewId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function parseCourseId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function toReviewResponse(doc: ReviewDoc): {
  id: number;
  rating: number;
  text: string;
  status: ReviewStatus;
  studentId: number;
  courseId: number;
  createdAt: Date;
  updatedAt: Date;
} | null {
  if (
    typeof doc.id !== "number" ||
    !Number.isInteger(doc.id) ||
    doc.id <= 0 ||
    typeof doc.rating !== "number" ||
    !Number.isInteger(doc.rating) ||
    doc.rating < 1 ||
    doc.rating > 5 ||
    typeof doc.text !== "string" ||
    (doc.status !== "VISIBLE" &&
      doc.status !== "UNDER_REVIEW" &&
      doc.status !== "REMOVED") ||
    typeof doc.studentId !== "number" ||
    !Number.isInteger(doc.studentId) ||
    doc.studentId <= 0 ||
    typeof doc.courseId !== "number" ||
    !Number.isInteger(doc.courseId) ||
    doc.courseId <= 0 ||
    !(doc.createdAt instanceof Date) ||
    !(doc.updatedAt instanceof Date)
  ) {
    return null;
  }

  return {
    id: doc.id,
    rating: doc.rating,
    text: doc.text,
    status: doc.status,
    studentId: doc.studentId,
    courseId: doc.courseId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
