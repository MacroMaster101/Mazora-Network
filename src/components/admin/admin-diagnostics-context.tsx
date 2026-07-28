"use client";

import { createContext, useContext, type ReactNode } from "react";

const AdminDiagnosticsContext = createContext(false);

export function AdminDiagnosticsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <AdminDiagnosticsContext.Provider value={enabled}>
      {children}
    </AdminDiagnosticsContext.Provider>
  );
}

export function useAdminDiagnostics(): boolean {
  return useContext(AdminDiagnosticsContext);
}
