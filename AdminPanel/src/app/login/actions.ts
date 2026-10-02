"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { addAudit, findAdminByEmail } from "@/lib/db/repo";
import { createWebSession, destroyWebSession } from "@/lib/session";

export async function loginAction(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const admin = await findAdminByEmail(email);
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return { error: "E-posta veya şifre hatalı." };
  if (admin.role !== "ADMIN") return { error: "Bu hesap yalnızca kiosk (QR) ekranı içindir; panele giriş yetkisi yok." };
  await createWebSession(admin.id);
  await addAudit({ adminUserId: admin.id, action: "WEB_LOGIN", entity: "admin_user", entityId: admin.id, beforeValue: null, afterValue: null });
  redirect("/");
}

export async function logoutAction() {
  await destroyWebSession();
  redirect("/login");
}
