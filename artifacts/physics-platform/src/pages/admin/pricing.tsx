import { useEffect, useState } from "react";
import { useGetAdminPricing, useUpdatePricing } from "@workspace/api-client-react";
import type { PricingSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Tag, Save, AlertTriangle, Info } from "lucide-react";

type PricingForm = {
  price: string;
  oldPrice: string;
  currency: string;
  promoEnabled: boolean;
  promoLabel: string;
  promoStartsAt: string;
  promoEndsAt: string;
  ctaText: string;
};

const EMPTY: PricingForm = {
  price: "",
  oldPrice: "",
  currency: "PLN",
  promoEnabled: false,
  promoLabel: "",
  promoStartsAt: "",
  promoEndsAt: "",
  ctaText: "",
};

function groszToZl(grosz: number | null | undefined): string {
  if (grosz == null) return "";
  return (grosz / 100).toFixed(2);
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
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fromSettings(s: PricingSettings): PricingForm {
  return {
    price: groszToZl(s.priceGrosz),
    oldPrice: groszToZl(s.oldPriceGrosz),
    currency: s.currency ?? "PLN",
    promoEnabled: s.promoEnabled ?? false,
    promoLabel: s.promoLabel ?? "",
    promoStartsAt: isoToLocalInput(s.promoStartsAt),
    promoEndsAt: isoToLocalInput(s.promoEndsAt),
    ctaText: s.ctaText ?? "",
  };
}

export default function AdminPricing() {
  const { data, isLoading } = useGetAdminPricing();
  const { toast } = useToast();
  const updatePricing = useUpdatePricing();
  const [form, setForm] = useState<PricingForm>(EMPTY);

  useEffect(() => {
    if (data) setForm(fromSettings(data));
  }, [data]);

  const set = <K extends keyof PricingForm>(key: K, value: PricingForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const priceGrosz = Math.round(parseFloat(form.price.replace(",", ".")) * 100);
  const hasOldPrice = form.oldPrice.trim() !== "";
  const oldPriceGrosz = hasOldPrice ? Math.round(parseFloat(form.oldPrice.replace(",", ".")) * 100) : undefined;

  const priceError = !Number.isFinite(priceGrosz) || priceGrosz <= 0
    ? "Cena musi być liczbą większą od zera."
    : null;
  const oldPriceError = hasOldPrice && (!Number.isFinite(oldPriceGrosz!) || oldPriceGrosz! < 0)
    ? "Stara cena musi być poprawną liczbą."
    : hasOldPrice && Number.isFinite(priceGrosz) && oldPriceGrosz! < priceGrosz
      ? "Stara cena musi być większa lub równa cenie aktualnej."
      : null;

  const canSave = !priceError && !oldPriceError;

  const promoEndsPast = form.promoEnabled && !!form.promoEndsAt && (() => {
    const d = new Date(form.promoEndsAt);
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  })();

  const save = () => {
    if (!canSave) return;
    updatePricing.mutate(
      {
        data: {
          priceGrosz,
          oldPriceGrosz,
          currency: form.currency || "PLN",
          promoEnabled: form.promoEnabled,
          promoLabel: form.promoLabel,
          promoStartsAt: localInputToIso(form.promoStartsAt),
          promoEndsAt: localInputToIso(form.promoEndsAt),
          ctaText: form.ctaText,
        },
      },
      {
        onSuccess: () => toast({ title: "Zapisano cennik" }),
        onError: () => toast({ title: "Błąd", description: "Nie udało się zapisać cennika.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Tag className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Cennik i promocja</h1>
          <p className="text-muted-foreground mt-1">Cena kursu oraz ustawienia promocji</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 bg-muted animate-pulse rounded-3xl" />
      ) : (
        <Card className="rounded-3xl border-border shadow-sm bg-card">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 flex gap-3 text-sm">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Ta cena jest jedynym źródłem prawdy — dokładnie tę kwotę zapłaci uczeń w Paynow.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cena (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  className="rounded-xl"
                />
                {priceError && <p className="text-xs text-destructive">{priceError}</p>}
              </div>
              <div className="space-y-2">
                <Label>Stara cena (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.oldPrice}
                  onChange={(e) => set("oldPrice", e.target.value)}
                  placeholder="opcjonalnie"
                  className="rounded-xl"
                />
                {oldPriceError && <p className="text-xs text-destructive">{oldPriceError}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Waluta</Label>
                <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Tekst przycisku CTA</Label>
                <Input value={form.ctaText} onChange={(e) => set("ctaText", e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
              <div>
                <Label>Promocja włączona</Label>
                <p className="text-xs text-muted-foreground">Wyświetla etykietę i starą cenę</p>
              </div>
              <Switch checked={form.promoEnabled} onCheckedChange={(v) => set("promoEnabled", v)} />
            </div>

            {promoEndsPast && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Data zakończenia promocji już minęła.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Etykieta promocji</Label>
              <Input value={form.promoLabel} onChange={(e) => set("promoLabel", e.target.value)} className="rounded-xl" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data rozpoczęcia promocji</Label>
                <Input
                  type="datetime-local"
                  value={form.promoStartsAt}
                  onChange={(e) => set("promoStartsAt", e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Data zakończenia promocji</Label>
                <Input
                  type="datetime-local"
                  value={form.promoEndsAt}
                  onChange={(e) => set("promoEndsAt", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button className="rounded-xl" onClick={save} disabled={!canSave || updatePricing.isPending}>
                <Save className="w-4 h-4 mr-2" />Zapisz cennik
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
