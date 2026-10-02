"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addAudit,
  createKiosk,
  createStudent,
  getStudent,
  resetStudentDevice,
  resetStudentPassword,
  reviewEvent,
  setKioskStatus,
} from "@/lib/db/repo";
import { manualEvent } from "@/lib/scan";
import { requireWebAdmin } from "@/lib/session";

/** Şifreyi siler; cihaz bağlı kalır. Öğrenci aynı telefonda uygulamaya girince yeni şifre oluşturur. */
export async function resetPasswordAction(form: FormData) {
  const admin = await requireWebAdmin();
  const studentId = String(form.get("studentId"));
  await resetStudentPassword(studentId);
  await addAudit({ adminUserId: admin.id, action: "PASSWORD_RESET", entity: "student", entityId: studentId, beforeValue: null, afterValue: null });
  revalidatePath("/ogrenciler");
}

/** Cihaz bağlantısını ve şifreyi siler. Öğrenci yeni telefonda ilk kez giriyormuş gibi şifre oluşturur. */
export async function resetDeviceAction(form: FormData) {
  const admin = await requireWebAdmin();
  const studentId = String(form.get("studentId"));
  await resetStudentDevice(studentId, admin.id);
  await addAudit({ adminUserId: admin.id, action: "DEVICE_RESET", entity: "student", entityId: studentId, beforeValue: null, afterValue: null });
  revalidatePath("/ogrenciler");
}

const studentSchema = z.object({
  schoolNo: z.string().trim().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  className: z.string().trim().min(1),
  guardianName: z.string().trim().default(""),
  guardianPhone: z.string().trim().default(""),
});

export async function createStudentAction(_prev: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const admin = await requireWebAdmin();
  const parsed = studentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Lütfen zorunlu alanları doğru doldurun." };
  try {
    const s = await createStudent(parsed.data);
    await addAudit({ adminUserId: admin.id, action: "STUDENT_CREATED", entity: "student", entityId: s.id, beforeValue: null, afterValue: { email: s.email } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kayıt oluşturulamadı." };
  }
  revalidatePath("/ogrenciler");
  return { ok: true };
}

export async function manualEventAction(form: FormData) {
  const admin = await requireWebAdmin();
  const studentId = String(form.get("studentId"));
  const direction = form.get("direction") === "IN" ? "IN" : "OUT";
  const note = String(form.get("note") ?? "").trim() || "Manuel kayıt";
  const student = await getStudent(studentId);
  if (!student) return;
  if ((direction === "IN" && student.presenceStatus === "IN") || (direction === "OUT" && student.presenceStatus === "OUT")) return;
  const event = await manualEvent(studentId, direction, note);
  await addAudit({ adminUserId: admin.id, action: "MANUAL_EVENT", entity: "attendance_event", entityId: event.id, beforeValue: null, afterValue: { direction, note } });
  revalidatePath("/");
  revalidatePath("/ogrenciler");
  revalidatePath("/hareketler");
}

export async function reviewEventAction(form: FormData) {
  const admin = await requireWebAdmin();
  const eventId = String(form.get("eventId"));
  const status = form.get("status") === "SUSPICIOUS" ? "SUSPICIOUS" : "OK";
  await reviewEvent(eventId, status, admin.id);
  await addAudit({ adminUserId: admin.id, action: "EVENT_REVIEWED", entity: "attendance_event", entityId: eventId, beforeValue: null, afterValue: { status } });
  revalidatePath("/hareketler");
  revalidatePath("/");
}

export async function createKioskAction(form: FormData) {
  const admin = await requireWebAdmin();
  const name = String(form.get("name") ?? "").trim();
  const direction = form.get("direction") === "EXIT" ? "EXIT" : "ENTRY";
  if (!name) return;
  const k = await createKiosk(name, direction);
  await addAudit({ adminUserId: admin.id, action: "KIOSK_CREATED", entity: "kiosk", entityId: k.id, beforeValue: null, afterValue: { name, direction } });
  revalidatePath("/kiosklar");
}

export async function toggleKioskAction(form: FormData) {
  const admin = await requireWebAdmin();
  const id = String(form.get("kioskId"));
  const status = form.get("status") === "DISABLED" ? "DISABLED" : "ACTIVE";
  await setKioskStatus(id, status);
  await addAudit({ adminUserId: admin.id, action: "KIOSK_STATUS", entity: "kiosk", entityId: id, beforeValue: null, afterValue: { status } });
  revalidatePath("/kiosklar");
}
