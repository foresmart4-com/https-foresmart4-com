import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

const EventType = z.enum([
  "signup",
  "signup_failed",
  "signin",
  "signin_failed",
  "signout",
  "password_reset_request",
  "password_update",
]);

const Input = z.object({
  event_type: EventType,
  status: z.enum(["ok", "error"]).default("ok"),
  user_id: z.string().uuid().nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  error_message: z.string().max(500).nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const logAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    try {
      const ip =
        getRequestHeader("cf-connecting-ip") ||
        getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
      const ua = getRequestHeader("user-agent") ?? null;

      await supabaseAdmin.from("auth_events").insert({
        event_type: data.event_type,
        status: data.status,
        user_id: data.user_id ?? null,
        email: data.email ?? null,
        error_message: data.error_message ?? null,
        ip_address: ip,
        user_agent: ua,
        metadata: data.metadata ?? {},
      });
      return { ok: true };
    } catch (err) {
      // never let logging break auth flows
      console.error("logAuthEvent failed", err);
      return { ok: false };
    }
  });
