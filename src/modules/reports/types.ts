export type ReportTargetType = "REVIEW" | "TEACHER_REVIEW";
export type ReportStatus = "PENDING" | "RESOLVED" | "REJECTED";

export type ReportDoc = {
  id?: unknown;
  reporterId?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function parseReportId(rawId: string): number | null {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
