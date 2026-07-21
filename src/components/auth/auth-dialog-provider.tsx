"use client";

import { createContext, Suspense, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthModal } from "./auth-modal";
import {
  ConfirmEmailPanel,
  ForgotPasswordPanel,
  LoginPanel,
  RegisterPanel,
  ResetPasswordPanel,
  VerifyEmailPanel,
} from "./auth-panels";

export type AuthDialogView = "login" | "register" | "forgot-password" | "verify-email" | "confirm-email" | "reset-password";

type DialogState = {
  view: AuthDialogView;
  next?: string;
  error?: string;
  email?: string;
  tokenHash?: string;
  otpType?: string;
} | null;
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
  "verify-email": "Verify your Mazora Network email",
  "confirm-email": "Confirm your Mazora Network email",
  "reset-password": "Choose a new Mazora Network password",
};

/**
 * Reads the `?auth=` query param reactively. A plain mount-only effect
 * (empty deps, reading window.location once) misses the common case where a
 * server action's redirect() (e.g. registerAction -> /verify-email ->
 * /?auth=verify-email) lands here via a client-side router transition rather
 * than a full page reload — AuthDialogProvider stays mounted across that
 * transition, so a one-time effect never re-checks the new URL and the modal
 * silently fails to open. useSearchParams() is subscribed to the router's
 * navigation state, so it re-fires on every navigation, soft or hard.
 */
function AuthDialogUrlSync({ onOpen }: { onOpen: (state: NonNullable<DialogState>) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestedView = searchParams.get("auth");
    const view =
      requestedView === "login" ||
      requestedView === "register" ||
      requestedView === "forgot-password" ||
      requestedView === "verify-email" ||
      requestedView === "confirm-email" ||
      requestedView === "reset-password"
        ? requestedView
        : null;
    if (!view) return;

    onOpen({
      view,
      next: searchParams.get("next") ?? undefined,
      error: searchParams.get("error") ?? undefined,
      email: searchParams.get("email") ?? undefined,
      tokenHash: searchParams.get("token_hash") ?? undefined,
      otpType: searchParams.get("type") ?? undefined,
    });

    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("next");
    url.searchParams.delete("error");
    url.searchParams.delete("email");
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const value = useMemo<AuthDialogContextValue>(
    () => ({ dialog, open: (view, next) => setDialog({ view, next }), close: () => setDialog(null) }),
    [dialog],
  );

  useEffect(() => {
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
            : destination.pathname === "/verify-email"
              ? "verify-email"
              : destination.pathname === "/confirm-email"
                ? "confirm-email"
                : destination.pathname === "/reset-password"
                  ? "reset-password"
                  : null;
      if (!linkView) return;

      event.preventDefault();
      event.stopPropagation();
      setDialog({
        view: linkView,
        next: destination.searchParams.get("next") ?? undefined,
        error: destination.searchParams.get("error") ?? undefined,
        email: destination.searchParams.get("email") ?? undefined,
        tokenHash: destination.searchParams.get("token_hash") ?? undefined,
        otpType: destination.searchParams.get("type") ?? undefined,
      });
    }

    document.addEventListener("click", interceptAuthLink, true);
    return () => document.removeEventListener("click", interceptAuthLink, true);
  }, []);

  return (
    <AuthDialogContext.Provider value={value}>
      <Suspense fallback={null}>
        <AuthDialogUrlSync onOpen={setDialog} />
      </Suspense>
      {children}
      {dialog && (
        <AuthModal
          label={labels[dialog.view]}
          onClose={value.close}
        >
          {dialog.view === "login" && <LoginPanel next={dialog.next} error={dialog.error} />}
          {dialog.view === "register" && <RegisterPanel />}
          {dialog.view === "forgot-password" && <ForgotPasswordPanel />}
          {dialog.view === "verify-email" && <VerifyEmailPanel email={dialog.email} />}
          {dialog.view === "confirm-email" && <ConfirmEmailPanel tokenHash={dialog.tokenHash} type={dialog.otpType} />}
          {dialog.view === "reset-password" && <ResetPasswordPanel />}
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
    const href =
      view === "register"
        ? "/register"
        : view === "forgot-password"
          ? "/forgot-password"
          : view === "verify-email"
            ? "/verify-email"
            : view === "confirm-email"
              ? "/confirm-email"
              : view === "reset-password"
                ? "/reset-password"
                : "/login";
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
