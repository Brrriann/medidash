import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { LoginForm } from "@/components/auth/LoginForm";
import { MockNotice } from "@/components/auth/MockNotice";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <>
      {isMockMode() && <MockNotice />}
      <LoginForm />
    </>
  );
}
