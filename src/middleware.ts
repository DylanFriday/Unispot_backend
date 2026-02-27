import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { buildCorsHeaders } from "@/lib/cors";

type JwtPayload = {
  userId?: unknown;
  role?: unknown;
};

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function withResponseHeaders(
  response: NextResponse,
  corsHeaders: Headers,
  requestId: string,
): NextResponse {
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

function errorResponse(
  status: number,
  message: string,
  requestId: string,
  corsHeaders: Headers,
): NextResponse {
  return withResponseHeaders(
    NextResponse.json(
      {
        statusCode: status,
        message,
        requestId,
      },
      { status },
    ),
    corsHeaders,
    requestId,
  );
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

async function verifyAccessToken(
  token: string,
  encodedSecret: Uint8Array,
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

function resolveJwtSecret(): string | null {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  // Keep local behavior aligned with route-level auth helper.
  if (process.env.NODE_ENV !== "production") {
    return "dev-secret";
  }

  return null;
}

function isProtectedModerationPath(path: string): boolean {
  return (
    path.startsWith("/moderation/") ||
    path.startsWith("/api/moderation/")
  );
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id")?.trim() || generateRequestId();
  const corsHeaders = buildCorsHeaders(req);
  const path = req.nextUrl.pathname;

  if (req.method === "OPTIONS") {
    return withResponseHeaders(new NextResponse(null, { status: 204 }), corsHeaders, requestId);
  }

  if (isProtectedModerationPath(path)) {
    const jwtSecret = resolveJwtSecret();
    if (!jwtSecret) {
      console.error({
        requestId,
        route: path,
        errorName: "ServerConfigurationError",
        errorMessage: "Missing JWT_SECRET for middleware verification",
      });
      return errorResponse(500, "Internal Server Error", requestId, corsHeaders);
    }

    const token = getBearerToken(req);
    if (!token) {
      return errorResponse(401, "Unauthorized", requestId, corsHeaders);
    }

    const payload = await verifyAccessToken(
      token,
      new TextEncoder().encode(jwtSecret),
    );
    if (!payload) {
      console.error({
        requestId,
        route: path,
        errorName: "Unauthorized",
        errorMessage: "Invalid or unverifiable JWT",
      });
      return errorResponse(401, "Unauthorized", requestId, corsHeaders);
    }

    if (payload.role !== "ADMIN") {
      return errorResponse(403, "Forbidden", requestId, corsHeaders);
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  return withResponseHeaders(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }), corsHeaders, requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
