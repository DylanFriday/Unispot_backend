import { type ClientSession, type Db } from "mongodb";

import { apiError } from "@/lib/errors";
import { getNextSequenceValue, type StudySheetDoc } from "@/modules/study-sheets/utils";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  amount?: number;
  createdAt: Date;
};

type StudySheetApprovalDoc = {
  id?: unknown;
  studySheetId: number;
  reviewerId: number;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function moderateStudySheet(
  db: Db,
  session: ClientSession,
  params: {
    studySheetId: number;
    actorId: number;
    status: "APPROVED" | "REJECTED";
    reason?: string;
  },
): Promise<StudySheetDoc> {
  const studySheets = db.collection<StudySheetDoc>("study_sheets");
  const approvals = db.collection<StudySheetApprovalDoc>("study_sheet_approvals");
  const auditLogs = db.collection<AuditLogDoc>("audit_logs");

  const existing = await studySheets.findOne({ id: params.studySheetId }, { session });
  if (!existing) {
    throw apiError(404, "Study sheet not found", "Not Found");
  }

  const now = new Date();
  const updated = await studySheets.findOneAndUpdate(
    { id: params.studySheetId },
    {
      $set: {
        status: params.status,
        updatedAt: now,
      },
    },
    { returnDocument: "after", session },
  );

  if (!updated) {
    throw apiError(404, "Study sheet not found", "Not Found");
  }

  const approvalId = await getNextSequenceValue("study_sheet_approvals", session);
  await approvals.updateOne(
    { studySheetId: params.studySheetId },
    {
      $setOnInsert: {
        id: approvalId,
        studySheetId: params.studySheetId,
        createdAt: now,
      },
      $set: {
        reviewerId: params.actorId,
        decision: params.status,
        reason: params.reason ?? null,
        updatedAt: now,
      },
    },
    { upsert: true, session },
  );

  const amount =
    typeof updated.priceCents === "number" && Number.isInteger(updated.priceCents)
      ? updated.priceCents
      : 0;

  const auditId = await getNextSequenceValue("audit_logs", session);
  await auditLogs.insertOne(
    {
      id: auditId,
      actorId: params.actorId,
      action:
        params.status === "APPROVED"
          ? "STUDY_SHEET_APPROVED"
          : "STUDY_SHEET_REJECTED",
      entityType: "STUDY_SHEET",
      entityId: params.studySheetId,
      amount,
      createdAt: now,
    },
    { session },
  );

  return updated;
}
