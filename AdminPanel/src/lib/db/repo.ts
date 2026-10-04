// VERİ ERİŞİM KATMANI (repository)
// Uygulamanın tüm veritabanı erişimi bu dosyadaki fonksiyonlardan geçer (PostgreSQL, bkz. pg.ts).
// Tablo ve kolonlar db/schema.sql'de; satırlar camelCase'e çevrilip types.ts'teki tiplerle döner.

import { randomBytes } from "crypto";
import { camel, insertRow, q, tx } from "./pg";
import type {
  AdminUser,
  AttendanceEvent,
  AuditLog,
  Device,
  Direction,
  Guardian,
  Kiosk,
  KioskDirection,
  ScanAttempt,
  SmsMessage,
  Student,
} from "./types";

export const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;
const nowIso = () => new Date().toISOString();
const first = <T>(rows: T[]): T | null => rows[0] ?? null;

// ---------------------------------------------------------------- öğrenciler

export type StudentRow = Student & {
  guardians: (Guardian & { relation: string; notifyEntry: boolean; notifyExit: boolean })[];
  activeDevice: Device | null;
};

export async function findStudentByEmail(email: string): Promise<Student | null> {
  return first(await q<Student>("SELECT * FROM students WHERE lower(email) = lower($1)", [email.trim()]));
}

export async function getStudent(id: string): Promise<Student | null> {
  return first(await q<Student>("SELECT * FROM students WHERE id = $1", [id]));
}

export async function listStudents(): Promise<StudentRow[]> {
  const [students, guardians, devices] = await Promise.all([
    q<Student>("SELECT * FROM students"),
    q<Guardian & { studentId: string; relation: string; notifyEntry: boolean; notifyExit: boolean }>(
      `SELECT g.*, sg.student_id, sg.relation, sg.notify_entry, sg.notify_exit
       FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id`,
    ),
    q<Device>("SELECT * FROM devices WHERE status = 'ACTIVE'"),
  ]);
  students.sort((a, b) => a.className.localeCompare(b.className) || a.lastName.localeCompare(b.lastName, "tr"));
  return students.map((s) => ({
    ...s,
    guardians: guardians.filter((g) => g.studentId === s.id),
    activeDevice: devices.find((d) => d.studentId === s.id) ?? null,
  }));
}

export async function createStudent(input: {
  schoolNo: string;
  firstName: string;
  lastName: string;
  email: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
}): Promise<Student> {
  return tx(async (c) => {
    const email = input.email.trim().toLowerCase();
    const dup = await c.query("SELECT 1 FROM students WHERE lower(email) = $1", [email]);
    if (dup.rows.length) throw new Error("Bu e-posta ile kayıtlı bir öğrenci var.");
    const student: Student = {
      id: newId("stu"),
      schoolNo: input.schoolNo.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      className: input.className.trim(),
      passwordHash: null,
      presenceStatus: "OUT",
      isActive: true,
      createdAt: nowIso(),
    };
    await insertRow(c, "students", student);
    if (input.guardianPhone.trim()) {
      const guardian: Guardian = { id: newId("gua"), fullName: input.guardianName.trim() || "Veli", phone: input.guardianPhone.trim() };
      await insertRow(c, "guardians", guardian);
      await insertRow(c, "student_guardians", { studentId: student.id, guardianId: guardian.id, relation: "Veli", notifyEntry: true, notifyExit: true });
    }
    return student;
  });
}

export async function setStudentPassword(studentId: string, passwordHash: string | null): Promise<void> {
  await q("UPDATE students SET password_hash = $2 WHERE id = $1", [studentId, passwordHash]);
}

// ---------------------------------------------------------------- cihazlar

export async function getActiveDevice(deviceId: string): Promise<Device | null> {
  return first(await q<Device>("SELECT * FROM devices WHERE id = $1 AND status = 'ACTIVE'", [deviceId]));
}

export async function getActiveDeviceForStudent(studentId: string): Promise<Device | null> {
  return first(await q<Device>("SELECT * FROM devices WHERE student_id = $1 AND status = 'ACTIVE'", [studentId]));
}

/**
 * İlk giriş (veya yönetici şifreyi sıfırladıktan sonraki giriş): şifreyi kaydeder ve cihazı hesaba bağlar — tek transaction'da.
 * Kurallar: öğrenci başına tek aktif cihaz, cihaz başına tek öğrenci. Hesap zaten bir cihaza bağlıysa yalnızca o cihazdan şifre belirlenebilir.
 * Hata kodları: ALREADY_HAS_PASSWORD, NOT_FOUND, DEVICE_TAKEN, WRONG_DEVICE.
 */
export async function setFirstPasswordAndBindDevice(input: {
  studentId: string;
  passwordHash: string;
  deviceId: string;
  deviceSecret: string;
  platform: string;
}): Promise<void> {
  await tx(async (c) => {
    // Öğrenciyi kilitle: aynı hesap için eş zamanlı iki "şifre oluştur" isteğinden yalnızca biri geçer.
    const student = (await c.query("SELECT id, password_hash FROM students WHERE id = $1 FOR UPDATE", [input.studentId])).rows[0];
    if (!student) throw new BindError("NOT_FOUND", "Öğrenci bulunamadı.");
    if (student.password_hash) throw new BindError("ALREADY_HAS_PASSWORD", "Bu hesabın şifresi zaten oluşturulmuş. Şifrenizle giriş yapın.");
    const active = (await c.query("SELECT id, student_id FROM devices WHERE status = 'ACTIVE' AND (id = $1 OR student_id = $2)", [input.deviceId, input.studentId])).rows;
    if (active.some((d) => d.id === input.deviceId && d.student_id !== input.studentId))
      throw new BindError("DEVICE_TAKEN", "Bu telefon başka bir öğrenci hesabına bağlı. Bir telefonda yalnızca bir öğrenci hesabı kullanılabilir.");
    if (active.some((d) => d.student_id === input.studentId && d.id !== input.deviceId))
      throw new BindError("WRONG_DEVICE", "Hesabınız başka bir telefona bağlı. Telefon değiştirdiyseniz okul yönetiminden cihaz sıfırlaması isteyin.");
    await c.query("UPDATE students SET password_hash = $2 WHERE id = $1", [input.studentId, input.passwordHash]);
    await c.query(
      `INSERT INTO devices (id, student_id, platform, device_secret, attestation_info, status, bound_at, revoked_at, revoked_by)
       VALUES ($1, $2, $3, $4, NULL, 'ACTIVE', now(), NULL, NULL)
       -- Aynı telefon zaten bağlıysa (şifre sıfırlama sonrası) ya da daha önce sıfırlanmışsa satır güncellenir.
       ON CONFLICT (id) DO UPDATE SET student_id = EXCLUDED.student_id, platform = EXCLUDED.platform, device_secret = EXCLUDED.device_secret,
         status = 'ACTIVE', bound_at = CASE WHEN devices.status = 'ACTIVE' THEN devices.bound_at ELSE now() END, revoked_at = NULL, revoked_by = NULL`,
      [input.deviceId, input.studentId, input.platform, input.deviceSecret],
    );
  });
}

export class BindError extends Error {
  constructor(public code: "NOT_FOUND" | "ALREADY_HAS_PASSWORD" | "DEVICE_TAKEN" | "WRONG_DEVICE", message: string) {
    super(message);
  }
}

/** Panelden "şifreyi sıfırla": şifreyi siler, cihaz bağlı kalır. Öğrenci aynı telefonda yeni şifre oluşturur. */
export async function resetStudentPassword(studentId: string): Promise<void> {
  await q("UPDATE students SET password_hash = NULL WHERE id = $1", [studentId]);
}

/** Panelden "cihazı sıfırla": aktif cihazı iptal eder ve şifreyi siler; öğrenci yeni telefonunda ilk kez giriş yapar gibi şifre oluşturur. */
export async function resetStudentDevice(studentId: string, adminId: string): Promise<void> {
  await tx(async (c) => {
    await c.query("UPDATE devices SET status = 'REVOKED', revoked_at = now(), revoked_by = $2 WHERE student_id = $1 AND status = 'ACTIVE'", [studentId, adminId]);
    await c.query("UPDATE students SET password_hash = NULL WHERE id = $1", [studentId]);
  });
}

// ---------------------------------------------------------------- yöneticiler

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  return first(await q<AdminUser>("SELECT * FROM admin_users WHERE lower(email) = lower($1)", [email.trim()]));
}

export async function getAdmin(id: string): Promise<AdminUser | null> {
  return first(await q<AdminUser>("SELECT * FROM admin_users WHERE id = $1", [id]));
}

// ---------------------------------------------------------------- kiosklar

export function listKiosks(): Promise<Kiosk[]> {
  return q<Kiosk>("SELECT * FROM kiosks ORDER BY name");
}

export async function getKiosk(id: string): Promise<Kiosk | null> {
  return first(await q<Kiosk>("SELECT * FROM kiosks WHERE id = $1", [id]));
}

export async function touchKiosk(id: string): Promise<void> {
  await q("UPDATE kiosks SET last_seen_at = now() WHERE id = $1", [id]);
}

export async function createKiosk(name: string, direction: KioskDirection): Promise<Kiosk> {
  const kiosk: Kiosk = { id: newId("kiosk"), name: name.trim(), direction, secret: randomBytes(32).toString("hex"), status: "ACTIVE", lastSeenAt: null };
  await tx((c) => insertRow(c, "kiosks", kiosk));
  return kiosk;
}

export async function setKioskStatus(id: string, status: Kiosk["status"]): Promise<void> {
  await q("UPDATE kiosks SET status = $2 WHERE id = $1", [id, status]);
}

// ---------------------------------------------------------------- okutmalar ve olaylar

export async function insertScanAttempt(a: Omit<ScanAttempt, "id" | "createdAt">): Promise<ScanAttempt> {
  const row: ScanAttempt = { ...a, id: newId("att"), createdAt: nowIso() };
  // Aynı dilimin kabul edilmiş ikinci kaydı veritabanı kısıtına takılır (scan_attempts_no_replay): tekrar oynatma olarak reddedilir.
  try {
    await tx((c) => insertRow(c, "scan_attempts", row));
    return row;
  } catch (e) {
    if ((e as { code?: string }).code === "23505" && row.result === "ACCEPTED") {
      const rejected: ScanAttempt = { ...row, id: newId("att"), result: "REJECTED", rejectReason: "REPLAY" };
      await tx((c) => insertRow(c, "scan_attempts", rejected));
      return rejected;
    }
    throw e;
  }
}

export async function isReplay(deviceId: string, kioskId: string, slot: number): Promise<boolean> {
  const rows = await q("SELECT 1 FROM scan_attempts WHERE device_id = $1 AND kiosk_id = $2 AND time_slot = $3 AND result = 'ACCEPTED' LIMIT 1", [
    deviceId,
    kioskId,
    slot,
  ]);
  return rows.length > 0;
}

export async function lastEventForStudent(studentId: string): Promise<AttendanceEvent | null> {
  return first(await q<AttendanceEvent>("SELECT * FROM attendance_events WHERE student_id = $1 ORDER BY occurred_at DESC LIMIT 1", [studentId]));
}

/** Kabul edilen bir giriş/çıkışı kaydeder: olay + öğrenci durumu + veli SMS'leri tek transaction'da. */
export async function createEventWithSms(input: {
  studentId: string;
  direction: Direction;
  source: AttendanceEvent["source"];
  kioskId: string | null;
  scanAttemptId: string | null;
  note?: string | null;
  buildSms: (student: Student) => string;
}): Promise<{ event: AttendanceEvent; sms: SmsMessage[] }> {
  return tx(async (c) => {
    const s = (await c.query("SELECT * FROM students WHERE id = $1 FOR UPDATE", [input.studentId])).rows[0];
    if (!s) throw new Error("Öğrenci bulunamadı.");
    const student = camel<Student>(s);
    const now = nowIso();
    const event: AttendanceEvent = {
      id: newId("evt"),
      studentId: student.id,
      direction: input.direction,
      occurredAt: now,
      source: input.source,
      kioskId: input.kioskId,
      scanAttemptId: input.scanAttemptId,
      reviewStatus: "UNREVIEWED",
      reviewedBy: null,
      note: input.note ?? null,
    };
    await insertRow(c, "attendance_events", event);
    await c.query("UPDATE students SET presence_status = $2 WHERE id = $1", [student.id, input.direction]);
    student.presenceStatus = input.direction;

    const guardians = (
      await c.query(
        `SELECT g.id, g.phone FROM student_guardians sg JOIN guardians g ON g.id = sg.guardian_id
         WHERE sg.student_id = $1 AND (CASE WHEN $2 = 'IN' THEN sg.notify_entry ELSE sg.notify_exit END)`,
        [student.id, input.direction],
      )
    ).rows as { id: string; phone: string }[];
    const sms: SmsMessage[] = [];
    for (const g of guardians) {
      const msg: SmsMessage = {
        id: newId("sms"),
        eventId: event.id,
        guardianId: g.id,
        phone: g.phone,
        body: input.buildSms(student),
        providerMessageId: null,
        status: "QUEUED",
        attemptCount: 0,
        sentAt: null,
        deliveredAt: null,
        createdAt: now,
      };
      await insertRow(c, "sms_messages", msg);
      sms.push(msg);
    }
    return { event, sms };
  });
}

const SMS_COLUMNS: Record<string, string> = {
  providerMessageId: "provider_message_id",
  status: "status",
  attemptCount: "attempt_count",
  sentAt: "sent_at",
  deliveredAt: "delivered_at",
  body: "body",
};

export async function updateSms(id: string, patch: Partial<SmsMessage>): Promise<void> {
  const entries = Object.entries(patch).filter(([k]) => k in SMS_COLUMNS);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${SMS_COLUMNS[k]} = $${i + 2}`).join(", ");
  await q(`UPDATE sms_messages SET ${sets} WHERE id = $1`, [id, ...entries.map(([, v]) => v)]);
}

export async function getEvent(id: string): Promise<AttendanceEvent | null> {
  return first(await q<AttendanceEvent>("SELECT * FROM attendance_events WHERE id = $1", [id]));
}

export async function reviewEvent(eventId: string, status: AttendanceEvent["reviewStatus"], adminId: string): Promise<void> {
  await q("UPDATE attendance_events SET review_status = $2, reviewed_by = $3 WHERE id = $1", [eventId, status, adminId]);
}

export type EventRow = AttendanceEvent & { student: Pick<Student, "id" | "firstName" | "lastName" | "className" | "schoolNo">; kioskName: string | null };

export async function listEvents(
  filter: { studentId?: string; review?: AttendanceEvent["reviewStatus"]; onlyFlagged?: boolean; kioskId?: string; since?: string; limit?: number } = {},
): Promise<EventRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (filter.studentId) add("e.student_id = ?", filter.studentId);
  if (filter.review) add("e.review_status = ?", filter.review);
  if (filter.onlyFlagged) where.push("(e.review_status = 'SUSPICIOUS' OR e.source <> 'APP')");
  if (filter.kioskId) add("e.kiosk_id = ?", filter.kioskId);
  if (filter.since) add("e.occurred_at > ?", filter.since);
  params.push(filter.limit ?? 200);
  const rows = await q<AttendanceEvent & { sFirstName: string; sLastName: string; sClassName: string; sSchoolNo: string; kioskName: string | null }>(
    `SELECT e.*, s.first_name AS s_first_name, s.last_name AS s_last_name, s.class_name AS s_class_name, s.school_no AS s_school_no, k.name AS kiosk_name
     FROM attendance_events e
     JOIN students s ON s.id = e.student_id
     LEFT JOIN kiosks k ON k.id = e.kiosk_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY e.occurred_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map(({ sFirstName, sLastName, sClassName, sSchoolNo, kioskName, ...e }) => ({
    ...e,
    student: { id: e.studentId, firstName: sFirstName, lastName: sLastName, className: sClassName, schoolNo: sSchoolNo },
    kioskName,
  }));
}

export type AttemptRow = ScanAttempt & { studentName: string | null; kioskName: string | null };

export function listScanAttempts(onlyRejected = true, limit = 200): Promise<AttemptRow[]> {
  return q<AttemptRow>(
    `SELECT a.*, CASE WHEN s.id IS NULL THEN NULL ELSE s.first_name || ' ' || s.last_name END AS student_name, k.name AS kiosk_name
     FROM scan_attempts a
     LEFT JOIN students s ON s.id = a.student_id
     LEFT JOIN kiosks k ON k.id = a.kiosk_id
     WHERE NOT $1 OR a.result = 'REJECTED'
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [onlyRejected, limit],
  );
}

/** Bir kioskun belirli andan sonraki tüm okutma denemeleri (kabul + red); kiosk/test ekranındaki log için. */
export function listKioskAttempts(kioskId: string, since: string, limit = 20): Promise<AttemptRow[]> {
  return q<AttemptRow>(
    `SELECT a.*, CASE WHEN s.id IS NULL THEN NULL ELSE s.first_name || ' ' || s.last_name END AS student_name, k.name AS kiosk_name
     FROM scan_attempts a
     LEFT JOIN students s ON s.id = a.student_id
     LEFT JOIN kiosks k ON k.id = a.kiosk_id
     WHERE a.kiosk_id = $1 AND a.created_at > $2
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [kioskId, since, limit],
  );
}

export function listSms(limit = 200): Promise<(SmsMessage & { studentName: string })[]> {
  return q(
    `SELECT m.*, COALESCE(s.first_name || ' ' || s.last_name, '-') AS student_name
     FROM sms_messages m
     LEFT JOIN attendance_events e ON e.id = m.event_id
     LEFT JOIN students s ON s.id = e.student_id
     ORDER BY m.created_at DESC
     LIMIT $1`,
    [limit],
  );
}

export async function dashboardStats(): Promise<{ total: number; inside: number; outside: number; todayEvents: number; unreviewed: number; rejectedToday: number }> {
  // "Bugün" Türkiye saatine göre hesaplanır.
  const [r] = await q<Record<string, number>>(
    `WITH t AS (SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul') AS start)
     SELECT
       (SELECT count(*) FROM students WHERE is_active)::int AS total,
       (SELECT count(*) FROM students WHERE is_active AND presence_status = 'IN')::int AS inside,
       (SELECT count(*) FROM students WHERE is_active AND presence_status = 'OUT')::int AS outside,
       (SELECT count(*) FROM attendance_events, t WHERE occurred_at >= t.start)::int AS today_events,
       (SELECT count(*) FROM attendance_events, t WHERE occurred_at >= t.start AND review_status = 'UNREVIEWED')::int AS unreviewed,
       (SELECT count(*) FROM scan_attempts, t WHERE created_at >= t.start AND result = 'REJECTED')::int AS rejected_today`,
  );
  return r as Awaited<ReturnType<typeof dashboardStats>>;
}

// ---------------------------------------------------------------- denetim kaydı

export async function addAudit(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  await tx((c) => insertRow(c, "audit_logs", { ...entry, id: newId("aud"), createdAt: nowIso() }));
}

export function listAudit(limit = 200): Promise<(AuditLog & { adminName: string | null })[]> {
  return q(
    `SELECT a.*, u.full_name AS admin_name FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.admin_user_id
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit],
  );
}
