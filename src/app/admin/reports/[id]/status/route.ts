import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { validateJson } from "@/lib/validate";
import { parseReportId } from "@/modules/reports/types";
import { updateReportStatusBodySchema } from "@/modules/reports/schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const currentUser = requireAuth(req);
    requireRole(currentUser, ["ADMIN"]);

    const { id } = await params;
    const reportId = parseReportId(id);
    if (!reportId) {
      return apiError(400, "Validation failed", "Bad Request");
    }

    const body = await validateJson(req, updateReportStatusBodySchema);

    const db = getDb();
    const reports = db.collection("reports");
    const updated = await reports.findOneAndUpdate(
      { id: reportId },
      {
        $set: {
          status: body.status,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError(404, "Report not found", "Not Found");
    }

    return NextResponse.json(
      {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error;
    }
    return apiError(500, "Internal Server Error", "Internal Server Error");
  }
}
