import { createFileRoute, Navigate, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [li, setLi] = useState({ email: "", password: "" });
  const [su, setSu] = useState({ email: "", password: "", name: "" });

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
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t("login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div>
                  <Label>{t("email")}</Label>
                  <Input type="email" required value={li.email} onChange={(e) => setLi({ ...li, email: e.target.value })} />
                </div>
                <div>
                  <Label>{t("password")}</Label>
                  <Input type="password" required minLength={6} value={li.password} onChange={(e) => setLi({ ...li, password: e.target.value })} />
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
                  <Input type="email" required value={su.email} onChange={(e) => setSu({ ...su, email: e.target.value })} />
                </div>
                <div>
                  <Label>{t("password")}</Label>
                  <Input type="password" required minLength={6} value={su.password} onChange={(e) => setSu({ ...su, password: e.target.value })} />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={busy}>
                  {busy ? t("loading") : t("signup")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
