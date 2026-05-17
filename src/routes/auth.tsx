import { createFileRoute, Navigate, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingUp, Eye, EyeOff, ArrowLeft, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MarketTicker } from "@/components/MarketTicker";
import { InterestForm } from "@/components/InterestForm";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to ForeSmart — Private Access" },
      { name: "description", content: "Sign in or request access to ForeSmart, the private AI-powered market intelligence platform for stocks, crypto, FX, metals and oil." },
      { property: "og:title", content: "Sign in to ForeSmart" },
      { property: "og:description", content: "Sign in or request access to the private ForeSmart platform." },
      { property: "og:url", content: "https://foresmart4.store/auth" },
    ],
    links: [{ rel: "canonical", href: "https://foresmart4.store/auth" }],
  }),
  component: AuthPage,
});

function PasswordInput({ value, onChange, required = true, minLength = 6, autoComplete }: {
  value: string; onChange: (v: string) => void; required?: boolean; minLength?: number; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} required={required} minLength={minLength} autoComplete={autoComplete}
        value={value} onChange={(e) => onChange(e.target.value)} className="pe-10 bg-background/60 border-border/60" />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        tabIndex={-1} aria-label={show ? "Hide password" : "Show password"}>
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
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await signIn(li.email, li.password);
    setBusy(false);
    if (error) toast.error(error); else { toast.success(t("welcome")); navigate({ to: "/dashboard" }); }
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await signUp(su.email, su.password, su.name);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success(lang === "ar" ? "تم إنشاء الحساب — تحقق من بريدك" : "Account created — check your email");
  };
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await resetPassword(forgotEmail);
    setBusy(false);
    if (error) toast.error(error);
    else { toast.success(lang === "ar" ? "تم إرسال رابط استعادة كلمة المرور إلى بريدك" : "Password reset link sent"); setMode("auth"); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06080f] text-foreground" dir={dir}>
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -end-32 h-[420px] w-[420px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute bottom-0 -start-32 h-[420px] w-[420px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
      </div>

      <MarketTicker className="relative z-10" />

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-44px)] w-full max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
        {/* Left — brand & pitch */}
        <section className="hidden flex-col gap-6 lg:flex">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary shadow-glow">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-display text-3xl font-bold tracking-tight">{t("appName")}</span>
          </Link>
          <h2 className="font-display text-4xl font-bold leading-tight">
            <span className="text-gradient">
              {lang === "ar" ? "منصة استثمار ذكية بقرار أفضل" : "Smarter markets, sharper decisions"}
            </span>
          </h2>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            {lang === "ar"
              ? "تنبيهات AI لحظية، تحليل أسواق عالمية، محاكاة تداول، وإدارة محفظة احترافية في مكان واحد."
              : "Real-time AI alerts, global market analysis, paper trading and pro portfolio tooling — all in one place."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t_ar: "وصول خاص بالدعوة", t_en: "Invite-only access" },
              { icon: Sparkles,    t_ar: "ذكاء اصطناعي مخصص", t_en: "Tailored AI insights" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3 backdrop-blur">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary"><f.icon className="h-4 w-4" /></span>
                <span className="text-sm font-medium">{lang === "ar" ? f.t_ar : f.t_en}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Right — auth card */}
        <section className="w-full">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="mb-6 flex items-center justify-center gap-2 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-2xl font-bold">{t("appName")}</span>
            </Link>

            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs">
              🔒 {lang === "ar"
                ? "موقع خاص — التسجيل بدعوة وموافقة المالك"
                : "Private platform — registration by invite and owner approval"}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur-xl">
              {mode === "forgot" ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <button type="button" onClick={() => setMode("auth")}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
                    {lang === "ar" ? "العودة" : "Back"}
                  </button>
                  <div>
                    <h2 className="font-display text-xl font-bold">{lang === "ar" ? "استعادة كلمة المرور" : "Reset password"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lang === "ar" ? "أدخل بريدك وسنرسل لك رابطاً لتعيين كلمة مرور جديدة." : "Enter your email and we'll send you a reset link."}
                    </p>
                  </div>
                  <div>
                    <Label>{t("email")}</Label>
                    <Input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="bg-background/60" />
                  </div>
                  <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow" disabled={busy}>
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
                        <Input type="email" required autoComplete="email" value={li.email} onChange={(e) => setLi({ ...li, email: e.target.value })} className="bg-background/60" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>{t("password")}</Label>
                          <button type="button" onClick={() => { setForgotEmail(li.email); setMode("forgot"); }} className="text-xs text-primary hover:underline">
                            {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot password?"}
                          </button>
                        </div>
                        <PasswordInput value={li.password} onChange={(v) => setLi({ ...li, password: v })} autoComplete="current-password" />
                      </div>
                      <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow" disabled={busy}>
                        {busy ? t("loading") : t("login")}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4 pt-4">
                      <div>
                        <Label>{t("displayName")}</Label>
                        <Input required value={su.name} onChange={(e) => setSu({ ...su, name: e.target.value })} className="bg-background/60" />
                      </div>
                      <div>
                        <Label>{t("email")}</Label>
                        <Input type="email" required autoComplete="email" value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} className="bg-background/60" />
                      </div>
                      <div>
                        <Label>{t("password")}</Label>
                        <PasswordInput value={su.password} onChange={(v) => setSu({ ...su, password: v })} autoComplete="new-password" />
                      </div>
                      <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow" disabled={busy}>
                        {busy ? t("loading") : t("signup")}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {/* Request Invite */}
            <div className="mt-4 rounded-xl border border-border/40 bg-card/40 p-3 text-center text-sm backdrop-blur">
              {lang === "ar" ? "ليس لديك دعوة؟ " : "Don't have an invite? "}
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <button className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                    <Mail className="h-4 w-4" />
                    {lang === "ar" ? "طلب دعوة" : "Request invite"}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{lang === "ar" ? "طلب دعوة للانضمام" : "Request an invite"}</DialogTitle>
                  </DialogHeader>
                  <InterestForm onSuccess={() => setInviteOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
