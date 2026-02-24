import jwt from "jsonwebtoken";

export type JwtRole = "STUDENT" | "STAFF" | "ADMIN";

export type JwtPayloadData = {
  userId: number;
  role: JwtRole;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function signJwt(payload: JwtPayloadData): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

export function verifyJwt(token: string): JwtPayloadData | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.userId !== "number" ||
      typeof decoded.role !== "string"
    ) {
      return null;
    }

    return {
      userId: decoded.userId,
      role: decoded.role as JwtRole,
    };
  } catch {
    return null;
  }
}
