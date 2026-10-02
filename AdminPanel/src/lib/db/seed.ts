// Geliştirme ve test için örnek veriler.
// Buradaki e-postalar ve şifreler YALNIZCA TEST DEĞERLERİDİR.
// Gerçek okulda: öğrenciler Excel/CSV ile içe aktarılır, admin şifreleri ilk kurulumda değiştirilir.
// Öğrencilerin şifresi yoktur; uygulamada ilk girişte kendileri oluşturur.

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Database } from "./types";

export const SEED_ADMINS = [
  { email: "admin@fenbahceleri.test", password: "Admin12345", fullName: "Okul Yöneticisi", role: "ADMIN" as const },
  { email: "kapi@fenbahceleri.test", password: "Kapi12345", fullName: "Kapı Tableti", role: "KIOSK" as const },
];

export const SEED_STUDENTS = [
  { schoolNo: "101", firstName: "Ali", lastName: "Yılmaz", email: "ali.yilmaz@fenbahceleri.test", className: "9-A", guardian: "Ayşe Yılmaz", phone: "+905551110001" },
  { schoolNo: "102", firstName: "Zeynep", lastName: "Kaya", email: "zeynep.kaya@fenbahceleri.test", className: "9-A", guardian: "Mehmet Kaya", phone: "+905551110002" },
  { schoolNo: "103", firstName: "Emir", lastName: "Demir", email: "emir.demir@fenbahceleri.test", className: "10-B", guardian: "Fatma Demir", phone: "+905551110003" },
  { schoolNo: "104", firstName: "Elif", lastName: "Şahin", email: "elif.sahin@fenbahceleri.test", className: "10-B", guardian: "Ahmet Şahin", phone: "+905551110004" },
  { schoolNo: "105", firstName: "Kerem", lastName: "Çelik", email: "kerem.celik@fenbahceleri.test", className: "11-C", guardian: "Hülya Çelik", phone: "+905551110005" },
];

const id = (p: string) => `${p}_${randomBytes(6).toString("hex")}`;

export async function buildSeed(): Promise<Database> {
  const now = new Date();

  const db: Database = {
    students: [],
    guardians: [],
    studentGuardians: [],
    devices: [],
    kiosks: [
      { id: "kiosk_giris", name: "Ana Kapı Giriş", direction: "ENTRY", secret: randomBytes(32).toString("hex"), status: "ACTIVE", lastSeenAt: null },
      { id: "kiosk_cikis", name: "Ana Kapı Çıkış", direction: "EXIT", secret: randomBytes(32).toString("hex"), status: "ACTIVE", lastSeenAt: null },
    ],
    scanAttempts: [],
    attendanceEvents: [],
    smsMessages: [],
    permissions: [],
    adminUsers: [],
    auditLogs: [],
  };

  for (const a of SEED_ADMINS) {
    db.adminUsers.push({
      id: id("adm"),
      fullName: a.fullName,
      email: a.email,
      role: a.role,
      passwordHash: await bcrypt.hash(a.password, 10),
      twoFactorEnabled: false,
    });
  }

  for (const s of SEED_STUDENTS) {
    const studentId = id("stu");
    const guardianId = id("gua");
    db.students.push({
      id: studentId,
      schoolNo: s.schoolNo,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      className: s.className,
      passwordHash: null,
      presenceStatus: "OUT",
      isActive: true,
      createdAt: now.toISOString(),
    });
    db.guardians.push({ id: guardianId, fullName: s.guardian, phone: s.phone });
    db.studentGuardians.push({ studentId, guardianId, relation: "Veli", notifyEntry: true, notifyExit: true });
  }

  return db;
}
