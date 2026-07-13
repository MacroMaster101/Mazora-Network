"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AuthModal } from "./auth-modal";
import { ForgotPasswordPanel, LoginPanel, RegisterPanel } from "./auth-panels";

export type AuthDialogView = "login" | "register" | "forgot-password";

type DialogState = { view: AuthDialogView; next?: string; error?: string } | null;
type AuthDialogContextValue = {
  dialog: DialogState;
  open: (view: AuthDialogView, next?: string) => void;
  close: () => void;
};

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

const labels: Record<AuthDialogView, string> = {
  login: "Log in to Mazora Network",
  register: "Create a Mazora Network account",
  "forgot-password": "Recover your Mazora Network account",
};

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const value = useMemo<AuthDialogContextValue>(
    () => ({ dialog, open: (view, next) => setDialog({ view, next }), close: () => setDialog(null) }),
    [dialog],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedView = url.searchParams.get("auth");
    const view = requestedView === "login" || requestedView === "register" || requestedView === "forgot-password"
      ? requestedView
      : null;

    if (view) {
      setDialog({
        view,
        next: url.searchParams.get("next") ?? undefined,
        error: url.searchParams.get("error") ?? undefined,
      });
      url.searchParams.delete("auth");
      url.searchParams.delete("next");
      url.searchParams.delete("error");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function interceptAuthLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const linkView: AuthDialogView | null = destination.pathname === "/login"
        ? "login"
        : destination.pathname === "/register"
          ? "register"
          : destination.pathname === "/forgot-password"
            ? "forgot-password"
            : null;
      if (!linkView) return;

      event.preventDefault();
      event.stopPropagation();
      setDialog({
        view: linkView,
        next: destination.searchParams.get("next") ?? undefined,
        error: destination.searchParams.get("error") ?? undefined,
      });
    }

    document.addEventListener("click", interceptAuthLink, true);
    return () => document.removeEventListener("click", interceptAuthLink, true);
  }, []);

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      {dialog && (
        <AuthModal
          label={labels[dialog.view]}
          onClose={value.close}
        >
          {dialog.view === "login" && <LoginPanel next={dialog.next} error={dialog.error} />}
          {dialog.view === "register" && <RegisterPanel />}
          {dialog.view === "forgot-password" && <ForgotPasswordPanel />}
        </AuthModal>
      )}
    </AuthDialogContext.Provider>
  );
}

export function AuthDialogTrigger({
  view,
  next,
  onOpen,
  className,
  title,
  children,
}: {
  view: AuthDialogView;
  next?: string;
  onOpen?: () => void;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const context = useContext(AuthDialogContext);
  if (!context) {
    const href = view === "register" ? "/register" : view === "forgot-password" ? "/forgot-password" : "/login";
    return <Link href={href} className={className} title={title}>{children}</Link>;
  }
  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={() => {
        onOpen?.();
        context.open(view, next);
      }}
    >
      {children}
    </button>
  );
}

export function AuthFlowLink({ view, href, className, children }: { view: AuthDialogView; href: string; className?: string; children: ReactNode }) {
  const context = useContext(AuthDialogContext);
  if (context?.dialog) {
    return <button type="button" className={className} onClick={() => context.open(view, context.dialog?.next)}>{children}</button>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}
