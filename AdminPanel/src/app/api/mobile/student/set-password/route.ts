import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, body, clientIp, handler, ok, rateLimit } from "@/lib/api";
import { signToken } from "@/lib/auth";
import { addAudit, BindError, findStudentByEmail, setFirstPasswordAndBindDevice } from "@/lib/db/repo";

const schema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı.").max(100),
  deviceId: z.string().min(8).max(100),
  deviceSecret: z.string().regex(/^[0-9a-f]{64}$/),
  platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
});

const STATUS: Record<BindError["code"], number> = { NOT_FOUND: 404, ALREADY_HAS_PASSWORD: 409, DEVICE_TAKEN: 409, WRONG_DEVICE: 403 };

// İlk giriş: şifresi olmayan öğrenci şifresini oluşturur; bu telefon hesaba bağlanır.
// Yönetici "Şifreyi sıfırla" yaptıysa öğrenci aynı telefonda yeniden şifre oluşturur.
export const POST = handler(async (req: Request) => {
  const input = await body(req, schema);
  rateLimit(`setpw:${input.email.toLowerCase()}`, 8);
  rateLimit(`setpw-ip:${clientIp(req)}`, 30);

  const student = await findStudentByEmail(input.email);
  if (!student || !student.isActive) throw new ApiError(404, "Bu e-posta adresi okul kayıtlarında bulunamadı.", "NOT_FOUND");

  try {
    await setFirstPasswordAndBindDevice({
      studentId: student.id,
      passwordHash: await bcrypt.hash(input.password, 10),
      deviceId: input.deviceId,
      deviceSecret: input.deviceSecret,
      platform: input.platform,
    });
  } catch (e) {
    if (e instanceof BindError) throw new ApiError(STATUS[e.code], e.message, e.code);
    throw e;
  }
  await addAudit({ adminUserId: null, action: "PASSWORD_CREATED", entity: "student", entityId: student.id, beforeValue: null, afterValue: { deviceId: input.deviceId, platform: input.platform } });

  const token = await signToken({ sub: student.id, role: "student", deviceId: input.deviceId }, "30d");
  return ok({
    token,
    student: { id: student.id, firstName: student.firstName, lastName: student.lastName, className: student.className },
  });
});
