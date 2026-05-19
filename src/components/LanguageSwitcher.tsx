import { Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "button" | "compact" | "pill";
  className?: string;
}

export function LanguageSwitcher({ variant = "button", className }: Props) {
  const { lang, setLang, t } = useI18n();
  const toggle = () => setLang(lang === "ar" ? "en" : "ar");
  const label = lang === "ar" ? "English" : "العربية";

  if (variant === "compact") {
    return (
      <button
        onClick={toggle}
        aria-label={t("common.languageSwitch")}
        className={cn("inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs hover:bg-muted/60", className)}
      >
        <Globe2 className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <div className={cn("inline-flex rounded-full border border-border p-0.5 text-xs", className)}>
        {(["ar", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn("rounded-full px-3 py-1 transition-colors", lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60")}
          >
            {l === "ar" ? "العربية" : "English"}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-sidebar-accent/60", className)}
    >
      <Globe2 className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
