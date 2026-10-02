import { z } from "zod";
import { ApiError, body, clientIp, handler, ok, rateLimit } from "@/lib/api";
import { findStudentByEmail, getActiveDevice, getActiveDeviceForStudent } from "@/lib/db/repo";

const schema = z.object({ email: z.string().trim().min(3).max(200), deviceId: z.string().min(8).max(100) });

// Öğrenci e-postasını girer. Yalnızca okul veritabanındaki e-postalar devam edebilir.
// Yanıt: şifre henüz yoksa "create-password", varsa "password".
export const POST = handler(async (req: Request) => {
  rateLimit(`check:${clientIp(req)}`, 30);
  const { email, deviceId } = await body(req, schema);
  const student = await findStudentByEmail(email);
  if (!student || !student.isActive) throw new ApiError(404, "Bu e-posta adresi okul kayıtlarında bulunamadı.", "NOT_FOUND");

  const device = await getActiveDevice(deviceId);
  if (device && device.studentId !== student.id)
    throw new ApiError(409, "Bu telefon başka bir öğrenci hesabına bağlı. Bir telefonda yalnızca bir öğrenci hesabı kullanılabilir.", "DEVICE_TAKEN");
  const bound = await getActiveDeviceForStudent(student.id);
  if (bound && bound.id !== deviceId)
    throw new ApiError(403, "Hesabınız başka bir telefona bağlı. Telefon değiştirdiyseniz okul yönetiminden cihaz sıfırlaması isteyin.", "WRONG_DEVICE");

  return ok({ next: student.passwordHash ? "password" : "create-password", firstName: student.firstName });
});
