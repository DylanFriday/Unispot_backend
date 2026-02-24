export type UserRole = "STUDENT" | "STAFF" | "ADMIN";

export type UserDoc = {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  passwordHash: string;
  walletBalance: number;
  avatarUrl?: string | null;
  phone?: string | null;
  bio?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
