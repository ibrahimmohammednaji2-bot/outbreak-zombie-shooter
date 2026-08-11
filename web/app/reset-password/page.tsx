import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Set a new password" };

export default function Page() {
  return <AuthForm mode="reset" />;
}
