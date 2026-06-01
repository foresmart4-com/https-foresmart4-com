import { createFileRoute } from "@tanstack/react-router";
import { sendEmail } from "@/lib/email.service";

export const Route = createFileRoute("/api/public/test-email")({
  server: {
    handlers: {
      GET: async () => {
        const result = await sendEmail({
          to: "Ayyaf08@hotmail.com",
          subject: "ForeSmart — اختبار البريد",
          html: `
            <div dir="rtl" style="font-family:Arial;padding:20px;background:#0a0a0a;color:#fff;">
              <h2 style="color:#d4a017;">✅ البريد يعمل</h2>
              <p>تم الإرسال من ForeSmart بنجاح</p>
              <p>${new Date().toLocaleString("ar-SA")}</p>
            </div>
          `,
        });
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
