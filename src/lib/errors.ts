import { NextResponse } from "next/server";

const ERROR_NAME_BY_STATUS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

export function apiError(
  statusCode: number,
  message: string,
  errorName?: string,
  requestId?: string,
): NextResponse {
  const response = NextResponse.json(
    {
      statusCode,
      message,
      error: errorName ?? ERROR_NAME_BY_STATUS[statusCode] ?? "Error",
      ...(requestId ? { requestId } : {}),
    },
    { status: statusCode },
  );

  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }

  return response;
}
