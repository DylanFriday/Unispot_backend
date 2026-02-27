import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";
import { requireRole } from "@/lib/auth/requireRole";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/errors";
import { withTransaction } from "@/lib/tx";
import { moderateStudySheet } from "@/modules/study-sheets/moderation";
import {
  normalizeStudySheet,
  parsePositiveInt,
  type StudySheetDoc,
} from "@/modules/study-sheets/utils";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const ROUTE_PATH = "POST /moderation/study-sheets/:id/approve";
const REQUIRED_APPROVE_ENV_VARS = ["MONGODB_URI"];
const REQUIRED_APPROVE_ENV_VARS_IN_PRODUCTION = ["JWT_SECRET"];

function getMissingApproveEnvVars(): string[] {
  const requiredEnvVars = [...REQUIRED_APPROVE_ENV_VARS];
  if (process.env.NODE_ENV === "production") {
    requiredEnvVars.push(...REQUIRED_APPROVE_ENV_VARS_IN_PRODUCTION);
  }

  return requiredEnvVars.filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

const missingApproveEnvVars = getMissingApproveEnvVars();

if (missingApproveEnvVars.length > 0) {
  console.error("approve route startup env validation failed", {
    route: ROUTE_PATH,
    missingEnvVars: missingApproveEnvVars,
  });
}

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id")?.trim() || randomUUID();
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

function internalServerError(requestId: string): NextResponse {
  return withRequestId(
    NextResponse.json(
      {
        statusCode: 500,
        message: "Internal Server Error",
        requestId,
      },
      { status: 500 },
    ),
    requestId,
  );
}

function logRouteError(
  requestId: string,
  route: string,
  params: { id?: string },
  error: unknown,
): void {
  const err = (error && typeof error === "object"
    ? (error as {
        name?: unknown;
        message?: unknown;
        stack?: unknown;
        code?: unknown;
        cause?: unknown;
      })
    : null) ?? { message: error };

  console.error({
    requestId,
    route,
    params,
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
    errorCode: err.code,
    cause: err.cause,
  });
}

export async function POST(
  req: NextRequest,
  { params }: Ctx,
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const routePath = `${req.method} ${new URL(req.url).pathname}`;
  let rawId: string | undefined;

  try {
    if (missingApproveEnvVars.length > 0) {
      console.error("approve route request env validation failed", {
        requestId,
        route: routePath,
        missingEnvVars: missingApproveEnvVars,
      });
      return internalServerError(requestId);
    }

    const currentUser = requireAuth(req);
    requireRole(currentUser, ["STAFF", "ADMIN"]);

    const { id } = await params;
    rawId = id;
    if (process.env.NODE_ENV !== "production") {
      console.log({ route: routePath, params: { id } });
    }
    const studySheetId = parsePositiveInt(id);
    if (!studySheetId) {
      return withRequestId(
        apiError(400, "Validation failed", "Bad Request", requestId),
        requestId,
      );
    }

    const db = getDb();
    const existing = await db
      .collection<StudySheetDoc>("study_sheets")
      .findOne({ id: studySheetId }, { projection: { id: 1, status: 1 } });

    if (!existing) {
      return withRequestId(
        apiError(404, "Study sheet not found", "Not Found", requestId),
        requestId,
      );
    }

    if (existing.status !== "PENDING") {
      return withRequestId(
        apiError(
          400,
          "Study sheet is not in a valid state for approval",
          "Bad Request",
          requestId,
        ),
        requestId,
      );
    }

    const updated = await withTransaction(
      async (session, txDb) =>
        moderateStudySheet(txDb, session, {
          studySheetId,
          actorId: currentUser.userId,
          status: "APPROVED",
        }),
      { requestId, route: routePath },
    );

    const response = normalizeStudySheet(updated);
    if (!response) {
      console.error({
        requestId,
        route: routePath,
        errorMessage: "normalizeStudySheet returned null",
      });
      return internalServerError(requestId);
    }

    return withRequestId(
      NextResponse.json(
        {
          ...response,
          requestId,
        },
        { status: 200 },
      ),
      requestId,
    );
  } catch (error: unknown) {
    logRouteError(
      requestId,
      routePath,
      { id: rawId },
      error,
    );

    if (error instanceof NextResponse) {
      return withRequestId(error, requestId);
    }

    return internalServerError(requestId);
  }
}
