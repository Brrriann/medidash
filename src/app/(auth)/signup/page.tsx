import type { Metadata } from "next";
import { isMockMode } from "@/lib/supabase/env";
import { SignupForm } from "@/components/auth/SignupForm";
import { MockNotice } from "@/components/auth/MockNotice";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <>
      {isMockMode() && <MockNotice />}
      <SignupForm />
    </>
  );
}
