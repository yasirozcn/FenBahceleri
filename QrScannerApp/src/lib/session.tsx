import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type AppConfig, type StudentSummary } from "./api";
import { tokens } from "./device";

type Session = {
  ready: boolean;
  studentToken: string | null;
  adminToken: string | null;
  student: StudentSummary | null;
  config: AppConfig | null;
  setStudentSession: (token: string, student: StudentSummary) => Promise<void>;
  setStudent: (s: StudentSummary) => void;
  clearStudentSession: () => Promise<void>;
  setAdminSession: (token: string) => Promise<void>;
  clearAdminSession: () => Promise<void>;
  refreshConfig: () => Promise<AppConfig | null>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);

  const refreshConfig = useCallback(async () => {
    try {
      const c = await api<AppConfig>("/api/mobile/config");
      setConfig(c);
      return c;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [s, a] = await Promise.all([tokens.getStudent(), tokens.getAdmin()]);
      setStudentToken(s);
      setAdminToken(a);
      setReady(true);
      void refreshConfig();
    })();
  }, [refreshConfig]);

  const value = useMemo<Session>(
    () => ({
      ready,
      studentToken,
      adminToken,
      student,
      config,
      refreshConfig,
      setStudent,
      setStudentSession: async (token, s) => {
        await tokens.setStudent(token);
        setStudentToken(token);
        setStudent(s);
      },
      clearStudentSession: async () => {
        await tokens.clearStudent();
        setStudentToken(null);
        setStudent(null);
      },
      setAdminSession: async (token) => {
        await tokens.setAdmin(token);
        setAdminToken(token);
      },
      clearAdminSession: async () => {
        await tokens.clearAdmin();
        setAdminToken(null);
      },
    }),
    [ready, studentToken, adminToken, student, config, refreshConfig],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession, SessionProvider içinde kullanılmalı");
  return s;
}
