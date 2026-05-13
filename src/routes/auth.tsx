import { createFileRoute, Navigate, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function PasswordInput({
  value,
  onChange,
  required = true,
  minLength = 6,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pe-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function AuthPage() {
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const { t, lang, dir } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"auth" | "forgot">("auth");
  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ email: "", password: "", name: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  if (!loading && user) return <Navigate to="/dashboard" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(li.email, li.password);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success(t("welcome")); navigate({ to: "/dashboard" }); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp(su.email, su.password, su.name);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success(lang === "ar" ? "تم إنشاء الحساب — تحقق من بريدك" : "Account created — check your email"); }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await resetPassword(forgotEmail);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(lang === "ar" ? "تم إرسال رابط استعادة كلمة المرور إلى بريدك" : "Password reset link sent to your email");
      setMode("auth");
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

        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs">
          🔒 {t("privateNotice")}
        </div>

        <div className="rounded-2xl gradient-card border border-border p-6 shadow-card">
          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <button
                type="button"
                onClick={() => setMode("auth")}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                {lang === "ar" ? "العودة" : "Back"}
              </button>
              <div>
                <h2 className="font-display text-xl font-bold">
                  {lang === "ar" ? "استعادة كلمة المرور" : "Reset password"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lang === "ar"
                    ? "أدخل بريدك وسنرسل لك رابطاً لتعيين كلمة مرور جديدة."
                    : "Enter your email and we'll send you a link to set a new password."}
                </p>
              </div>
              <div>
                <Label>{t("email")}</Label>
                <Input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={busy}>
                {busy ? t("loading") : (lang === "ar" ? "إرسال الرابط" : "Send reset link")}
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("login")}</TabsTrigger>
                <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div>
                    <Label>{t("email")}</Label>
                    <Input type="email" required autoComplete="email" value={li.email} onChange={(e) => setLi({ ...li, email: e.target.value })} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>{t("password")}</Label>
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(li.email); setMode("forgot"); }}
                        className="text-xs text-primary hover:underline"
                      >
                        {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                      </button>
                    </div>
                    <PasswordInput
                      value={li.password}
                      onChange={(v) => setLi({ ...li, password: v })}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={busy}>
                    {busy ? t("loading") : t("login")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div>
                    <Label>{t("displayName")}</Label>
                    <Input required value={su.name} onChange={(e) => setSu({ ...su, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("email")}</Label>
                    <Input type="email" required autoComplete="email" value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("password")}</Label>
                    <PasswordInput
                      value={su.password}
                      onChange={(v) => setSu({ ...su, password: v })}
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={busy}>
                    {busy ? t("loading") : t("signup")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
