import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";

const key = () => new TextEncoder().encode(config.authSecret);

export type StudentClaims = { sub: string; role: "student"; deviceId: string };
export type KioskClaims = { sub: string; role: "kiosk-admin" };
export type WebAdminClaims = { sub: string; role: "web-admin" };
export type Claims = StudentClaims | KioskClaims | WebAdminClaims;

export async function signToken(claims: Claims, expiresIn: string): Promise<string> {
  const { sub, ...rest } = claims;
  return new SignJWT(rest).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuedAt().setExpirationTime(expiresIn).sign(key());
}

export async function verifyToken(token: string): Promise<Claims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { ...(payload as object), sub: payload.sub! } as Claims;
  } catch {
    return null;
  }
}

/** Mobil isteklerdeki "Authorization: Bearer <token>" başlığını çözer. */
export async function bearerClaims(req: Request): Promise<Claims | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return verifyToken(h.slice(7));
}
