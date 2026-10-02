import { z } from "zod";
import bcrypt from "bcryptjs";
import { ApiError, body, clientIp, handler, ok, rateLimit } from "@/lib/api";
import { signToken } from "@/lib/auth";
import { findStudentByEmail, getActiveDeviceForStudent } from "@/lib/db/repo";

const schema = z.object({ email: z.string().trim().min(3), password: z.string().min(1).max(100), deviceId: z.string().min(8).max(100) });

export const POST = handler(async (req: Request) => {
  const { email, password, deviceId } = await body(req, schema);
  rateLimit(`login:${email.toLowerCase()}`, 10);
  rateLimit(`login-ip:${clientIp(req)}`, 50);

  const student = await findStudentByEmail(email);
  if (!student || !student.isActive || !student.passwordHash || !(await bcrypt.compare(password, student.passwordHash)))
    throw new ApiError(401, "E-posta veya şifre hatalı.", "BAD_CREDENTIALS");

  const device = await getActiveDeviceForStudent(student.id);
  if (!device || device.id !== deviceId)
    throw new ApiError(403, "Hesabınız başka bir cihaza bağlı. Telefon değiştirdiyseniz okul yönetiminden cihaz sıfırlaması isteyin.", "WRONG_DEVICE");

  const token = await signToken({ sub: student.id, role: "student", deviceId }, "30d");
  return ok({
    token,
    student: { id: student.id, firstName: student.firstName, lastName: student.lastName, className: student.className },
  });
});
