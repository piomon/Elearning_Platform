import { useState } from "react";
import { validateDiscount, type DiscountPreview } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPln } from "@/lib/format";
import { Loader2, Tag, X } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number | null;
  basePriceGrosz: number | null;
  currency: string;
  isPending: boolean;
  onConfirm: (courseId: number, discountCode: string | null) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  courseId,
  basePriceGrosz,
  currency,
  isPending,
  onConfirm,
}: CheckoutDialogProps) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<DiscountPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const reset = () => {
    setCode("");
    setApplied(null);
    setError(null);
    setChecking(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const apply = async () => {
    if (courseId == null || !code.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const res = await validateDiscount({ courseId, code: code.trim() });
      setApplied(res);
    } catch (err) {
      setApplied(null);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Nie udało się zastosować kodu rabatowego.",
      );
    } finally {
      setChecking(false);
    }
  };

  const removeCode = () => {
    setApplied(null);
    setError(null);
    setCode("");
  };

  const finalGrosz = applied ? applied.amountAfterGrosz : basePriceGrosz;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Podsumowanie zakupu</DialogTitle>
          <DialogDescription>
            Masz kod rabatowy? Wpisz go poniżej, aby obniżyć cenę przed płatnością.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="discount-code">Kod rabatowy (opcjonalnie)</Label>
            <div className="flex gap-2">
              <Input
                id="discount-code"
                placeholder="np. LATO2026"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                disabled={!!applied || checking || isPending}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !applied) {
                    e.preventDefault();
                    void apply();
                  }
                }}
              />
              {applied ? (
                <Button type="button" variant="outline" onClick={removeCode} disabled={isPending}>
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void apply()}
                  disabled={!code.trim() || checking || isPending}
                >
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zastosuj"}
                </Button>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {applied && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <Tag className="h-4 w-4" />
                Kod „{applied.code}" zastosowany — oszczędzasz{" "}
                {formatPln(applied.discountGrosz, currency)}.
              </p>
            )}
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/40 p-4">
            {applied && basePriceGrosz != null && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Cena</span>
                <span className="line-through">{formatPln(basePriceGrosz, currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium">Do zapłaty</span>
              <span className="text-2xl font-bold">
                {finalGrosz != null ? formatPln(finalGrosz, currency) : "—"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            className="w-full font-bold"
            disabled={courseId == null || isPending}
            onClick={() => {
              if (courseId != null) onConfirm(courseId, applied ? code.trim() : null);
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Przekierowanie do płatności…
              </>
            ) : (
              "Przejdź do płatności"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
