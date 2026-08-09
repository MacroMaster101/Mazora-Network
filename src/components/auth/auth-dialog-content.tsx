"use client";

import { AuthModal } from "./auth-modal";
import {
  ConfirmEmailPanel,
  ForgotPasswordPanel,
  LoginPanel,
  RegisterPanel,
  ResetPasswordPanel,
  VerifyEmailPanel,
} from "./auth-panels";
import type { AuthDialogView } from "./auth-dialog-provider";
import "@/styles/overlays.generated.css";

const labels: Record<AuthDialogView, string> = {
  login: "Log in to Mazora Network",
  register: "Create a Mazora Network account",
  "forgot-password": "Recover your Mazora Network account",
  "verify-email": "Verify your Mazora Network email",
  "confirm-email": "Confirm your Mazora Network email",
  "reset-password": "Choose a new Mazora Network password",
};

export function AuthDialogContent({
  dialog,
  onClose,
}: {
  dialog: {
    view: AuthDialogView;
    next?: string;
    error?: string;
    email?: string;
    tokenHash?: string;
    otpType?: string;
  };
  onClose: () => void;
}) {
  return (
    <AuthModal label={labels[dialog.view]} onClose={onClose}>
      {dialog.view === "login" && <LoginPanel next={dialog.next} error={dialog.error} />}
      {dialog.view === "register" && <RegisterPanel />}
      {dialog.view === "forgot-password" && <ForgotPasswordPanel />}
      {dialog.view === "verify-email" && <VerifyEmailPanel email={dialog.email} />}
      {dialog.view === "confirm-email" && <ConfirmEmailPanel tokenHash={dialog.tokenHash} type={dialog.otpType} />}
      {dialog.view === "reset-password" && <ResetPasswordPanel />}
    </AuthModal>
  );
}
