import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  useEffect(() => {
    // Supabase recovery link sets a session via URL hash. Wait for it to hydrate.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setValid(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValid(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== pwd2) {
      toast.error(lang === "ar" ? "كلمتا المرور غير متطابقتين" : "Passwords don't match");
      return;
    }
    if (pwd.length < 6) {
      toast.error(lang === "ar" ? "كلمة المرور قصيرة جداً" : "Password too short");
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(pwd);
    setBusy(false);
    if (error) toast.error(error);
    else {
      setDone(true);
      toast.success(lang === "ar" ? "تم تحديث كلمة المرور" : "Password updated");
      setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">{t("appName")}</span>
        </Link>

        <div className="rounded-2xl gradient-card border border-border p-6 shadow-card">
          <h1 className="mb-2 font-display text-2xl font-bold">
            {lang === "ar" ? "تعيين كلمة مرور جديدة" : "Set a new password"}
          </h1>

          {!ready ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-sm">
                {lang === "ar" ? "تم! جاري تحويلك..." : "Done! Redirecting..."}
              </p>
            </div>
          ) : !valid ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === "ar"
                  ? "الرابط غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً."
                  : "Link is invalid or expired. Please request a new one."}
              </p>
              <Button asChild className="w-full" variant="outline">
                <Link to="/auth">{lang === "ar" ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{lang === "ar" ? "كلمة المرور الجديدة" : "New password"}</Label>
                <div className="relative">
                  <Input
                    type={show ? "text" : "password"}
                    required
                    minLength={6}
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    autoComplete="new-password"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={show ? (lang === "ar" ? "إخفاء كلمة المرور" : "Hide password") : (lang === "ar" ? "إظهار كلمة المرور" : "Show password")}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>{lang === "ar" ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
                <Input
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={busy}>
                {busy ? t("loading") : (lang === "ar" ? "تحديث كلمة المرور" : "Update password")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
