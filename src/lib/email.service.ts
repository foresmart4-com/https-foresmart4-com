import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY missing");
    return { success: false, error: "No API key" };
  }
  try {
    await resend.emails.send({
      from: "ForeSmart <noreply@foresmart4.com>",
      to,
      subject,
      html,
      text,
    });
    console.info(`[email] Sent to ${to}`);
    return { success: true };
  } catch (err) {
    console.error("[email] Failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
