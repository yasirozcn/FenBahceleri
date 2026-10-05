// Veritabanı tablolarının TypeScript karşılıkları.
// Tablo/kolon adları tasarım dokümanındaki "Veritabanı tabloları" bölümüyle aynıdır
// (DB tarafında snake_case, kodda camelCase). PostgreSQL'e geçişte bu tipler korunur.

export type PresenceStatus = "IN" | "OUT";
export type Direction = "IN" | "OUT";

export interface Student {
  id: string;
  schoolNo: string;
  firstName: string;
  lastName: string;
  email: string;
  className: string;
  /** Öğrencinin şifresi (bcrypt özeti). Boşsa öğrenci uygulamada ilk girişte şifre oluşturur (yönetici sıfırlayınca da boşalır). */
  passwordHash: string | null;
  presenceStatus: PresenceStatus;
  isActive: boolean;
  createdAt: string;
}

export interface Guardian {
  id: string;
  fullName: string;
  phone: string;
}

export interface StudentGuardian {
  studentId: string;
  guardianId: string;
  relation: string;
  notifyEntry: boolean;
  notifyExit: boolean;
}

export interface Device {
  id: string; // uygulamanın ürettiği cihaz kimliği
  studentId: string;
  platform: string;
  /** 1. aşamada donanım anahtarı yerine: cihazın ürettiği gizli anahtar (istek imzalama). */
  deviceSecret: string;
  attestationInfo: string | null;
  status: "ACTIVE" | "REVOKED";
  boundAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface Kiosk {
  id: string;
  name: string;
  /** QR ve BLE jetonunu üreten gizli anahtar. */
  secret: string;
  status: "ACTIVE" | "DISABLED";
  lastSeenAt: string | null;
}

export type RejectReason =
  | "INVALID_QR"
  | "EXPIRED_QR"
  | "UNKNOWN_KIOSK"
  | "BAD_SIGNATURE"
  | "DEVICE_NOT_BOUND"
  | "BLE_MISSING"
  | "BLE_MISMATCH"
  | "REPLAY"
  | "WRONG_STATE" // eski sürüm (yönlü kiosklar); artık üretilmiyor, eski kayıtlar için duruyor
  | "DIRECTION_REQUIRED"; // ilk okutmada yön seçilmedi — kaydedilmez, uygulama yön sorar

export interface ScanAttempt {
  id: string;
  deviceId: string;
  studentId: string | null;
  kioskId: string | null;
  timeSlot: number | null;
  bleToken: string | null;
  bleRssi: number | null;
  bleOk: boolean | null;
  integrityOk: boolean | null;
  result: "ACCEPTED" | "REJECTED";
  rejectReason: RejectReason | null;
  createdAt: string;
}

export interface AttendanceEvent {
  id: string;
  studentId: string;
  direction: Direction;
  occurredAt: string;
  source: "APP" | "MANUAL" | "OFFLINE";
  kioskId: string | null;
  scanAttemptId: string | null;
  reviewStatus: "UNREVIEWED" | "OK" | "SUSPICIOUS";
  reviewedBy: string | null;
  note: string | null;
}

export interface SmsMessage {
  id: string;
  eventId: string;
  guardianId: string;
  phone: string;
  body: string;
  providerMessageId: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "MOCK_SENT";
  attemptCount: number;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface Permission {
  id: string;
  studentId: string;
  type: "EARLY_LEAVE" | "NO_PHONE";
  startsAt: string;
  endsAt: string;
  approvedBy: string | null;
  note: string | null;
}

export type AdminRole = "ADMIN" | "KIOSK";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  passwordHash: string;
  twoFactorEnabled: boolean;
}

export interface AuditLog {
  id: string;
  adminUserId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  createdAt: string;
}

/** Geçici JSON veritabanının tamamı. Her anahtar bir tabloya karşılık gelir. */
export interface Database {
  students: Student[];
  guardians: Guardian[];
  studentGuardians: StudentGuardian[];
  devices: Device[];
  kiosks: Kiosk[];
  scanAttempts: ScanAttempt[];
  attendanceEvents: AttendanceEvent[];
  smsMessages: SmsMessage[];
  permissions: Permission[];
  adminUsers: AdminUser[];
  auditLogs: AuditLog[];
}
