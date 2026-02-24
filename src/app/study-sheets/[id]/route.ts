import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { validateJson } from "@/lib/validate";
import { updateStudySheetBodySchema } from "@/modules/study-sheets/schemas";
import {
  normalizeStudySheet,
  parsePositiveInt,
  type PurchaseDoc,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

type AuditLogDoc = {
  id?: unknown;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number;
  amount?: number;
  createdAt: Date;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const { id } = await params;
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, updateStudySheetBodySchema);
    const db = getDb();
    const studySheets = db.collection<StudySheetDoc>("study_sheets");
    const auditLogs = db.collection<AuditLogDoc>("audit_logs");
    const existing = await studySheets.findOne({ id: studySheetId });

    if (!existing) {
      return apiError(404, "Study sheet not found", "Not Found");
    }

    if (existing.ownerId !== currentUser.userId) {
      return apiError(403, "Forbidden", "Forbidden");
    }

    const updateSet: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.title === "string") {
      updateSet.title = body.title;
    }
    if (typeof body.description === "string") {
      updateSet.description = body.description;
    }
    if (typeof body.fileUrl === "string") {
      updateSet.fileUrl = body.fileUrl;
    }
    if (typeof body.priceCents === "number") {
      updateSet.priceCents = body.priceCents;
    }

    const updated = await studySheets.findOneAndUpdate(
      { id: studySheetId },
      { $set: updateSet },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError(404, "Study sheet not found", "Not Found");
    }

    if (
      typeof updated.priceCents !== "number" ||
      !Number.isInteger(updated.priceCents) ||
      updated.priceCents < 0
    ) {
      return apiError(500, "Internal Server Error", "Internal Server Error");
    }

    await auditLogs.insertOne({
      actorId: currentUser.userId,
      action: "STUDY_SHEET_UPDATED",
      entityType: "STUDY_SHEET",
      entityId: studySheetId,
      amount: updated.priceCents,
      createdAt: new Date(),
    });

    const response = normalizeStudySheet(updated);
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STUDENT"]);

    const { id } = await params;
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const deleted = await withTransaction<StudySheetDoc>(async (session, db) => {
      const studySheets = db.collection<StudySheetDoc>("study_sheets");
      const purchases = db.collection<PurchaseDoc>("purchases");
      const approvals = db.collection("study_sheet_approvals");
      const auditLogs = db.collection<AuditLogDoc>("audit_logs");

      const existing = await studySheets.findOne({ id: studySheetId }, { session });
      if (!existing) {
        throw apiError(404, "Study sheet not found", "Not Found");
      }

      if (existing.ownerId !== currentUser.userId) {
        throw apiError(403, "Forbidden", "Forbidden");
      }

      const purchaseCount = await purchases.countDocuments(
        { studySheetId },
        { session },
      );
      if (purchaseCount > 0) {
        throw apiError(
          400,
          "Cannot delete study sheet with existing purchases",
          "Bad Request",
        );
      }

      await approvals.deleteMany({ studySheetId }, { session });

      const amount =
        typeof existing.priceCents === "number" && Number.isInteger(existing.priceCents)
          ? existing.priceCents
          : 0;

      await auditLogs.insertOne(
        {
          actorId: currentUser.userId,
          action: "STUDY_SHEET_DELETED",
          entityType: "STUDY_SHEET",
          entityId: studySheetId,
          amount,
          createdAt: new Date(),
        },
        { session },
      );

      const result = await studySheets.findOneAndDelete(
        { id: studySheetId },
        { session },
      );
      if (!result) {
        throw apiError(404, "Study sheet not found", "Not Found");
      }

      return result;
    });

    const response = normalizeStudySheet(deleted);
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
