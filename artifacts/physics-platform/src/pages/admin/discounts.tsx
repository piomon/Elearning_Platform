import { useState } from "react";
import {
  useListDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useDeleteDiscount,
  useToggleDiscount,
  useListDiscountUses,
  useListAdminCourses,
} from "@workspace/api-client-react";
import type { DiscountCode, DiscountInput } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Pencil, Trash2, Power, History, Tag, Percent } from "lucide-react";

type FormState = {
  code: string;
  type: "percent" | "amount";
  value: string;
  courseId: string;
  validFrom: string;
  validTo: string;
  maxUses: string;
  maxUsesPerUser: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  code: "",
  type: "percent",
  value: "",
  courseId: "",
  validFrom: "",
  validTo: "",
  maxUses: "",
  maxUsesPerUser: "",
  isActive: true,
};

function groszToZl(g: number): string {
  return (g / 100).toFixed(2);
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pl-PL");
}

export default function AdminDiscounts() {
  const { toast } = useToast();
  const { data: discounts, isLoading, refetch } = useListDiscounts();
  const { data: courses } = useListAdminCourses();
  const createMut = useCreateDiscount();
  const updateMut = useUpdateDiscount();
  const deleteMut = useDeleteDiscount();
  const toggleMut = useToggleDiscount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [usesFor, setUsesFor] = useState<DiscountCode | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (d: DiscountCode) => {
    setEditing(d);
    setForm({
      code: d.code,
      type: d.type,
      value: d.type === "amount" ? groszToZl(d.value) : String(d.value),
      courseId: d.courseId != null ? String(d.courseId) : "",
      validFrom: isoToLocalInput(d.validFrom),
      validTo: isoToLocalInput(d.validTo),
      maxUses: d.maxUses != null ? String(d.maxUses) : "",
      maxUsesPerUser: d.maxUsesPerUser != null ? String(d.maxUsesPerUser) : "",
      isActive: d.isActive,
    });
    setDialogOpen(true);
  };

  const buildPayload = (): DiscountInput | null => {
    const code = form.code.trim().toUpperCase();
    if (code.length < 3) {
      toast({ title: "Błąd", description: "Kod musi mieć co najmniej 3 znaki.", variant: "destructive" });
      return null;
    }
    const rawValue = parseFloat(form.value.replace(",", "."));
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      toast({ title: "Błąd", description: "Podaj poprawną wartość rabatu.", variant: "destructive" });
      return null;
    }
    const value = form.type === "amount" ? Math.round(rawValue * 100) : Math.round(rawValue);
    return {
      code,
      type: form.type,
      value,
      courseId: form.courseId ? Number(form.courseId) : null,
      validFrom: localInputToIso(form.validFrom),
      validTo: localInputToIso(form.validTo),
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      maxUsesPerUser: form.maxUsesPerUser ? Number(form.maxUsesPerUser) : null,
      isActive: form.isActive,
    };
  };

  const save = () => {
    const data = buildPayload();
    if (!data) return;
    const onSuccess = () => {
      toast({ title: editing ? "Zaktualizowano kod" : "Utworzono kod" });
      setDialogOpen(false);
      refetch();
    };
    const onError = (e: any) =>
      toast({ title: "Błąd", description: e?.data?.error ?? "Nie udało się zapisać.", variant: "destructive" });
    if (editing) {
      updateMut.mutate({ id: editing.id, data }, { onSuccess, onError });
    } else {
      createMut.mutate({ data }, { onSuccess, onError });
    }
  };

  const toggle = (d: DiscountCode) => {
    toggleMut.mutate(
      { id: d.id },
      {
        onSuccess: () => {
          toast({ title: d.isActive ? "Kod wyłączony" : "Kod włączony" });
          refetch();
        },
        onError: () => toast({ title: "Błąd", variant: "destructive" }),
      },
    );
  };

  const remove = (d: DiscountCode) => {
    if (!confirm(`Usunąć kod ${d.code}? Tej operacji nie można cofnąć.`)) return;
    deleteMut.mutate(
      { id: d.id },
      {
        onSuccess: () => {
          toast({ title: "Kod usunięty" });
          refetch();
        },
        onError: (e: any) =>
          toast({ title: "Błąd", description: e?.data?.error ?? "Nie udało się usunąć kodu.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Kody rabatowe</h1>
            <p className="text-muted-foreground mt-1">Promocyjne kody zniżkowe stosowane przy zakupie</p>
          </div>
        </div>
        <Button className="rounded-xl" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />Nowy kod
        </Button>
      </div>

      {isLoading ? (
        <div className="h-96 bg-muted animate-pulse rounded-3xl" />
      ) : !discounts || discounts.length === 0 ? (
        <Card className="rounded-3xl border-border shadow-sm bg-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Brak kodów rabatowych. Utwórz pierwszy kod, aby rozpocząć.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Rabat</TableHead>
                    <TableHead>Kurs</TableHead>
                    <TableHead>Ważność</TableHead>
                    <TableHead>Użycia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono font-bold">{d.code}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {d.type === "percent" ? <Percent className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
                          {d.type === "percent" ? `${d.value}%` : `${groszToZl(d.value)} zł`}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.courseTitle ?? "Wszystkie"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(d.validFrom)} – {formatDate(d.validTo)}
                      </TableCell>
                      <TableCell>
                        {d.usedCount}
                        {d.maxUses != null ? ` / ${d.maxUses}` : ""}
                      </TableCell>
                      <TableCell>
                        {d.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">Aktywny</Badge>
                        ) : (
                          <Badge variant="secondary">Wyłączony</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Historia użyć" onClick={() => setUsesFor(d)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={d.isActive ? "Wyłącz" : "Włącz"} onClick={() => toggle(d)}>
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edytuj" onClick={() => openEdit(d)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={d.usedCount > 0 ? "Nie można usunąć użytego kodu" : "Usuń"}
                          disabled={d.usedCount > 0}
                          onClick={() => remove(d)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edytuj kod rabatowy" : "Nowy kod rabatowy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Kod</Label>
              <Input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="np. LATO2026"
                className="rounded-xl font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Typ rabatu</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v as "percent" | "amount")}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Procentowy (%)</SelectItem>
                    <SelectItem value="amount">Kwotowy (zł)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.type === "percent" ? "Wartość (%)" : "Wartość (zł)"}</Label>
                <Input
                  type="number"
                  step={form.type === "percent" ? "1" : "0.01"}
                  min="0"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kurs (opcjonalnie)</Label>
              <Select
                value={form.courseId || "all"}
                onValueChange={(v) => set("courseId", v === "all" ? "" : v)}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kursy</SelectItem>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ważny od</Label>
                <Input type="datetime-local" value={form.validFrom} onChange={(e) => set("validFrom", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Ważny do</Label>
                <Input type="datetime-local" value={form.validTo} onChange={(e) => set("validTo", e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limit użyć (łącznie)</Label>
                <Input type="number" min="1" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="bez limitu" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Limit na użytkownika</Label>
                <Input type="number" min="1" value={form.maxUsesPerUser} onChange={(e) => set("maxUsesPerUser", e.target.value)} placeholder="bez limitu" className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
              <Label>Kod aktywny</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Anuluj</Button>
            <Button className="rounded-xl" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Zapisz zmiany" : "Utwórz kod"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DiscountUsesDialog discount={usesFor} onClose={() => setUsesFor(null)} />
    </div>
  );
}

function DiscountUsesDialog({ discount, onClose }: { discount: DiscountCode | null; onClose: () => void }) {
  const { data, isLoading } = useListDiscountUses(discount?.id ?? 0, {
    query: { enabled: !!discount },
  } as never);
  return (
    <Dialog open={!!discount} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historia użyć — {discount?.code}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="h-40 bg-muted animate-pulse rounded-2xl" />
        ) : !data || data.uses.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Ten kod nie był jeszcze użyty.</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Przed</TableHead>
                  <TableHead>Rabat</TableHead>
                  <TableHead>Po</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.uses.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email ?? `#${u.userId}`}</TableCell>
                    <TableCell>{groszToZl(u.amountBeforeGrosz)} zł</TableCell>
                    <TableCell className="text-emerald-600">−{groszToZl(u.discountGrosz)} zł</TableCell>
                    <TableCell className="font-semibold">{groszToZl(u.amountAfterGrosz)} zł</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(u.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
