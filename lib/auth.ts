import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-change-in-production"
);

export interface UserSession {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

export async function createToken(user: UserSession): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) return null;

  return verifyToken(token);
}

export async function verifyAuth(req: NextRequest): Promise<UserSession | null> {
  // Try Authorization header first
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Try cookie
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;

  return verifyToken(token);
}

export function setAuthCookie(token: string): void {
  // This is called from the auth route handler
  // cookies() is used in the route handler context
}
