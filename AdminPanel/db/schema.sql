-- Fen Bahçeleri Giriş-Çıkış Sistemi — PostgreSQL şeması
-- Kullanım: psql "$DATABASE_URL" -f db/schema.sql
-- Tablo/kolon adları src/lib/db/types.ts ile birebir eşleşir (snake_case ↔ camelCase).

BEGIN;

CREATE TABLE IF NOT EXISTS students (
  id                  text PRIMARY KEY,
  school_no           text NOT NULL,
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  email               text NOT NULL,
  class_name          text NOT NULL,
  password_hash       text,
  presence_status     text NOT NULL DEFAULT 'OUT' CHECK (presence_status IN ('IN', 'OUT')),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS students_email_uq ON students (lower(email));

CREATE TABLE IF NOT EXISTS guardians (
  id        text PRIMARY KEY,
  full_name text NOT NULL,
  phone     text NOT NULL
);

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id   text NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  guardian_id  text NOT NULL REFERENCES guardians (id) ON DELETE CASCADE,
  relation     text NOT NULL DEFAULT 'Veli',
  notify_entry boolean NOT NULL DEFAULT true,
  notify_exit  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (student_id, guardian_id)
);

-- Tek seferlik aktivasyon kodları kaldırıldı: ilk girişte şifre oluşturulur ve cihaz hesaba bağlanır.
DROP TABLE IF EXISTS activation_codes;

CREATE TABLE IF NOT EXISTS devices (
  id               text PRIMARY KEY,
  student_id       text NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  platform         text NOT NULL,
  device_secret    text NOT NULL,
  attestation_info text,
  status           text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  bound_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz,
  revoked_by       text
);
-- Kural: öğrenci başına en fazla 1 aktif cihaz.
CREATE UNIQUE INDEX IF NOT EXISTS devices_one_active_per_student ON devices (student_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS kiosks (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  secret       text NOT NULL,
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS scan_attempts (
  id            text PRIMARY KEY,
  device_id     text NOT NULL,
  student_id    text REFERENCES students (id) ON DELETE SET NULL,
  kiosk_id      text REFERENCES kiosks (id) ON DELETE SET NULL,
  time_slot     bigint,
  ble_token     text,
  ble_rssi      integer,
  ble_ok        boolean,
  integrity_ok  boolean,
  result        text NOT NULL CHECK (result IN ('ACCEPTED', 'REJECTED')),
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Kural: aynı cihaz aynı kioskun aynı QR dilimini yalnızca bir kez kullanabilir (tekrar oynatma koruması).
CREATE UNIQUE INDEX IF NOT EXISTS scan_attempts_no_replay ON scan_attempts (device_id, kiosk_id, time_slot) WHERE result = 'ACCEPTED';
CREATE INDEX IF NOT EXISTS scan_attempts_created_idx ON scan_attempts (created_at DESC);

CREATE TABLE IF NOT EXISTS attendance_events (
  id              text PRIMARY KEY,
  student_id      text NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL CHECK (source IN ('APP', 'MANUAL', 'OFFLINE')),
  kiosk_id        text REFERENCES kiosks (id) ON DELETE SET NULL,
  scan_attempt_id text REFERENCES scan_attempts (id) ON DELETE SET NULL,
  review_status   text NOT NULL DEFAULT 'UNREVIEWED' CHECK (review_status IN ('UNREVIEWED', 'OK', 'SUSPICIOUS')),
  reviewed_by     text,
  note            text
);
CREATE INDEX IF NOT EXISTS attendance_events_student_idx ON attendance_events (student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS attendance_events_time_idx ON attendance_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS sms_messages (
  id                  text PRIMARY KEY,
  event_id            text NOT NULL REFERENCES attendance_events (id) ON DELETE CASCADE,
  guardian_id         text NOT NULL REFERENCES guardians (id) ON DELETE CASCADE,
  phone               text NOT NULL,
  body                text NOT NULL,
  provider_message_id text,
  status              text NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'MOCK_SENT')),
  attempt_count       integer NOT NULL DEFAULT 0,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- Kural: bir olay için bir veliye tek SMS (tekrar denemede çift SMS gitmez).
  UNIQUE (event_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id          text PRIMARY KEY,
  student_id  text NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('EARLY_LEAVE', 'NO_PHONE')),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  approved_by text,
  note        text
);

CREATE TABLE IF NOT EXISTS admin_users (
  id                  text PRIMARY KEY,
  full_name           text NOT NULL,
  email               text NOT NULL,
  role                text NOT NULL CHECK (role IN ('ADMIN', 'KIOSK')),
  password_hash       text NOT NULL,
  two_factor_enabled  boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_uq ON admin_users (lower(email));

CREATE TABLE IF NOT EXISTS audit_logs (
  id            text PRIMARY KEY,
  admin_user_id text,
  action        text NOT NULL,
  entity        text NOT NULL,
  entity_id     text,
  before_value  jsonb,
  after_value   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

-- Fotoğraf (referans fotoğraf + okutma selfie'si) şimdilik kaldırıldı; eski kurulumlardaki kolonlar silinir.
ALTER TABLE students DROP COLUMN IF EXISTS reference_photo_url;
ALTER TABLE attendance_events DROP COLUMN IF EXISTS selfie_url;
ALTER TABLE attendance_events DROP COLUMN IF EXISTS selfie_status;

-- Kiosklar artık yönsüz (tek kiosk; giriş/çıkışı sunucu belirler).
ALTER TABLE kiosks DROP COLUMN IF EXISTS direction;

COMMIT;
