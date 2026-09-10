import type { Metadata } from "next";

import { GuestGate } from "@/features/auth/components/auth-gate";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Kirish",
  description: "Doctor Ali qabulxona paneliga kirish.",
};

export default function LoginPage() {
  return (
    <GuestGate>
      <LoginForm />
    </GuestGate>
  );
}
