import "server-only";
import { env } from "@/config/env";

// Minimal Resend integration. EMAIL_FROM must be set (a verified sender on
// the Resend account) for this to actually send — otherwise callers should
// fall back to their own dev-mode behavior.
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html }),
  });
  return response.ok;
}
