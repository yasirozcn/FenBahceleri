import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { bearerClaims, type KioskClaims, type StudentClaims } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "ERROR") {
    super(message);
  }
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Route handler'ları sarar: ApiError ve doğrulama hatalarını düzgün JSON yanıta çevirir. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Geçersiz istek.", code: "VALIDATION", issues: e.issues }, { status: 400 });
      console.error("[api]", e);
      const msg = e instanceof Error ? e.message : "Beklenmeyen hata.";
      return NextResponse.json({ error: msg, code: "ERROR" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "İstek gövdesi JSON olmalı.", "BAD_JSON");
  }
  return schema.parse(json);
}

export async function requireStudent(req: Request): Promise<StudentClaims> {
  const c = await bearerClaims(req);
  if (!c || c.role !== "student") throw new ApiError(401, "Oturum süresi doldu. Tekrar giriş yapın.", "UNAUTHORIZED");
  return c;
}

export async function requireKioskAdmin(req: Request): Promise<KioskClaims> {
  const c = await bearerClaims(req);
  if (!c || c.role !== "kiosk-admin") throw new ApiError(401, "Yönetici oturumu gerekli.", "UNAUTHORIZED");
  return c;
}

// Basit, bellek içi deneme sınırlayıcı (giriş uç noktalarına kaba kuvvet saldırısını yavaşlatır).
// Birden çok sunucu çalıştırıldığında PostgreSQL veya Redis tabanlı bir sınırlayıcıyla değiştirilmeli.
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return;
  }
  h.count++;
  if (h.count > max) throw new ApiError(429, "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.", "RATE_LIMIT");
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

