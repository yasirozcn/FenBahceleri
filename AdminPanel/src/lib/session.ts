import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken, verifyToken } from "./auth";
import { getAdmin } from "./db/repo";
import type { AdminUser } from "./db/types";

const COOKIE = "fb_admin";

export async function createWebSession(adminId: string) {
  const token = await signToken({ sub: adminId, role: "web-admin" }, "12h");
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false", path: "/", maxAge: 12 * 3600 });
}

export async function destroyWebSession() {
  (await cookies()).delete(COOKIE);
}

/** Oturumdaki yönetici (yalnızca ADMIN rolü web paneline girebilir). */
export async function getWebAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims || claims.role !== "web-admin") return null;
  const admin = await getAdmin(claims.sub);
  return admin && admin.role === "ADMIN" ? admin : null;
}

export async function requireWebAdmin(): Promise<AdminUser> {
  const admin = await getWebAdmin();
  if (!admin) redirect("/login");
  return admin;
}
