import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Briefcase, Plus, Pencil, Trash2, Settings, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/portfolios")({
  component: () => <ErrorBoundary fallbackTitle="تعذر تحميل المحافظ"><PortfoliosPage /></ErrorBoundary>,
  head: () => ({
    meta: [
      { title: "المحافظ — ForeSmart" },
      { name: "description", content: "إدارة محافظ الأصول الاستثمارية." },
    ],
  }),
});

interface LocalPortfolio {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

const STORAGE_KEY = "foresmart_portfolios";

function loadPortfolios(): LocalPortfolio[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function savePortfolios(p: LocalPortfolio[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<LocalPortfolio[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [symbolInput, setSymbolInput] = useState("");

  useEffect(() => { setPortfolios(loadPortfolios()); }, []);
  const save = (next: LocalPortfolio[]) => { setPortfolios(next); savePortfolios(next); };

  const createPortfolio = () => {
    if (!nameInput.trim()) { toast.error("يرجى إدخال اسم المحفظة"); return; }
    const p: LocalPortfolio = { id: `P-${Date.now()}`, name: nameInput.trim(), symbols: [], createdAt: new Date().toISOString() };
    save([p, ...portfolios]);
    setNameInput("");
    setCreateOpen(false);
    toast.success("تم إنشاء المحفظة");
  };

  const renamePortfolio = (id: string, name: string) => {
    save(portfolios.map((p) => p.id === id ? { ...p, name } : p));
    toast.success("تم تحديث الاسم");
  };

  const addSymbol = (id: string) => {
    if (!symbolInput.trim()) return;
    const sym = symbolInput.trim().toUpperCase();
    save(portfolios.map((p) => p.id === id ? { ...p, symbols: p.symbols.includes(sym) ? p.symbols : [...p.symbols, sym] } : p));
    setSymbolInput("");
    toast.success(`تم إضافة ${sym}`);
  };

  const removeSymbol = (id: string, sym: string) => {
    save(portfolios.map((p) => p.id === id ? { ...p, symbols: p.symbols.filter((s) => s !== sym) } : p));
    toast.success(`تم حذف ${sym}`);
  };

  const deletePortfolio = (id: string) => {
    save(portfolios.filter((p) => p.id !== id));
    setEditId(null);
    toast.success("تم حذف المحفظة");
  };

  const editing = editId ? portfolios.find((p) => p.id === editId) : null;

  return (
    <div dir="rtl" className="container mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> المحافظ</h1>
          <p className="text-xs text-muted-foreground mt-1">إدارة محافظ الأصول — أسهم، كريبتو، معادن، سلع، فوركس. لا يوجد تداول حقيقي.</p>
        </div>
        <Button onClick={() => { setNameInput(""); setCreateOpen(true); }}><Plus className="h-4 w-4 ml-1" /> محفظة جديدة</Button>
      </div>

      {portfolios.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">لا توجد محافظ بعد. أنشئ محفظة لتتبع أصولك.</p>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> إنشاء أول محفظة</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {portfolios.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm">{p.name}</CardTitle>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditId(p.id); setNameInput(p.name); setSymbolInput(""); }}>
                  <Settings className="h-3.5 w-3.5" /> ضبط
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.symbols.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد أصول بعد — اضغط ضبط لإضافة أصول.</p>
                  ) : (
                    p.symbols.map((s) => <Badge key={s} variant="outline" className="font-mono text-xs">{s}</Badge>)
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{p.symbols.length} أصل</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>محفظة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">اسم المحفظة</Label><Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="مثال: محفظة التكنولوجيا" /></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>إلغاء</Button><Button className="flex-1" onClick={createPortfolio}>إنشاء</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(o) => { if (!o) setEditId(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>ضبط المحفظة</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">تعديل الاسم</Label>
                <div className="flex gap-2">
                  <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
                  <Button size="sm" onClick={() => renamePortfolio(editing.id, nameInput)}><Save className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">إضافة أصل (رمز)</Label>
                <div className="flex gap-2">
                  <Input placeholder="AAPL, BTC, 2222.SR, XAU..." value={symbolInput} onChange={(e) => setSymbolInput(e.target.value)} />
                  <Button size="sm" onClick={() => addSymbol(editing.id)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">أسهم أمريكية، سعودية، صناديق، كريبتو، معادن، سلع، فوركس</p>
              </div>
              <div>
                <Label className="text-xs">الأصول الحالية</Label>
                {editing.symbols.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">لا توجد أصول.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {editing.symbols.map((s) => (
                      <Badge key={s} variant="outline" className="gap-1 font-mono text-xs">
                        {s}
                        <button onClick={() => removeSymbol(editing.id, s)} className="hover:text-rose-500"><Trash2 className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditId(null)}>إغلاق</Button>
                <Button variant="destructive" size="sm" onClick={() => deletePortfolio(editing.id)}><Trash2 className="h-3.5 w-3.5 ml-1" /> حذف المحفظة</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
