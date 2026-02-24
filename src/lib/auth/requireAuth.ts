import { apiError } from "@/lib/errors";
import { verifyJwt, type JwtPayloadData } from "@/lib/auth/jwt";

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

export function requireAuth(req: Request): JwtPayloadData {
  const token = getBearerToken(req);

  if (!token) {
    throw apiError(401, "Unauthorized", "Unauthorized");
  }

  const payload = verifyJwt(token);

  if (!payload) {
    throw apiError(401, "Unauthorized", "Unauthorized");
  }

  return payload;
}
