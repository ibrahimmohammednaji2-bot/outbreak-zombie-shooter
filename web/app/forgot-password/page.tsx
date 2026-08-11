import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Forgot your password" };

export default function Page() {
  return <AuthForm mode="forgot" />;
}
