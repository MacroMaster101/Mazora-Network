import type { Metadata } from "next";
import { AuthCard, DemoAuthNote } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <AuthCard title="Join the network" subtitle="Create your free Mazora account.">
        <RegisterForm />
      </AuthCard>
      <DemoAuthNote />
    </>
  );
}
