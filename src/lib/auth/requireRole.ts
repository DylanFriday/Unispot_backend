import { apiError } from "@/lib/errors";
import { type JwtPayloadData, type JwtRole } from "@/lib/auth/jwt";

export function requireRole(
  currentUser: JwtPayloadData,
  allowedRoles: JwtRole[],
): void {
  if (!allowedRoles.includes(currentUser.role)) {
    throw apiError(403, "Forbidden", "Forbidden");
  }
}
