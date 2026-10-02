import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, body, clientIp, handler, ok, rateLimit } from "@/lib/api";
import { signToken } from "@/lib/auth";
import { addAudit, findAdminByEmail } from "@/lib/db/repo";

const schema = z.object({ email: z.string().trim().min(3), password: z.string().min(1).max(100) });

// Uygulama içindeki "Yönetici girişi". Bu oturum yalnızca kiosk (QR gösterme) ekranını açar.
export const POST = handler(async (req: Request) => {
  const { email, password } = await body(req, schema);
  rateLimit(`admin:${email.toLowerCase()}`, 10);
  rateLimit(`admin-ip:${clientIp(req)}`, 30);
  const admin = await findAdminByEmail(email);
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) throw new ApiError(401, "E-posta veya şifre hatalı.", "BAD_CREDENTIALS");
  await addAudit({ adminUserId: admin.id, action: "KIOSK_LOGIN", entity: "admin_user", entityId: admin.id, beforeValue: null, afterValue: null });
  const token = await signToken({ sub: admin.id, role: "kiosk-admin" }, "180d");
  return ok({ token, admin: { id: admin.id, fullName: admin.fullName } });
});
