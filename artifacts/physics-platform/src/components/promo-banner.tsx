import { useGetCoursePrice } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatPln } from "@/lib/format";
import { usePromoCountdown, discountPercent } from "@/lib/promo";
import { Flame } from "lucide-react";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function PromoBanner() {
  const { user } = useAuth();
  const { data: priceData } = useGetCoursePrice();
  const countdown = usePromoCountdown();

  const hasAccess = !!user && (user.hasAccess || user.role === "admin");
  if (hasAccess) return null;

  if (!priceData) return null;

  const priceLabel = formatPln(priceData.price, priceData.currency);
  const hasOldPrice =
    !!priceData.oldPrice && priceData.oldPrice > priceData.price;
  const oldPriceLabel = hasOldPrice
    ? formatPln(priceData.oldPrice!, priceData.currency)
    : null;
  const percent = hasOldPrice
    ? discountPercent(priceData.oldPrice!, priceData.price)
    : 0;

  return (
    <div className="relative z-[60] overflow-hidden bg-gradient-to-r from-primary via-violet-600 to-cyan-500 text-white">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center sm:gap-x-4">
          {percent > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black tracking-tight shadow-sm backdrop-blur-sm sm:text-sm">
              <Flame className="h-3.5 w-3.5 shrink-0" />
              -{percent}%
            </span>
          )}

          <span className="flex items-baseline gap-1.5 font-bold">
            <span className="hidden font-semibold text-white/90 sm:inline">
              Pełny dostęp
            </span>
            {oldPriceLabel && (
              <span className="text-sm font-semibold text-white/70 line-through decoration-2 sm:text-base">
                {oldPriceLabel}
              </span>
            )}
            <span className="text-base font-black tracking-tight sm:text-lg">
              {priceLabel}
            </span>
          </span>

          <span className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-white/90 sm:inline">
              Promocja kończy się z końcem września
            </span>
            <span className="flex items-center gap-1 font-mono text-xs font-bold tabular-nums sm:text-sm">
              <CountdownUnit value={countdown.days} label="dni" />
              <span className="opacity-60">:</span>
              <CountdownUnit value={pad(countdown.hours)} label="godz" />
              <span className="opacity-60">:</span>
              <CountdownUnit value={pad(countdown.minutes)} label="min" />
              <span className="opacity-60">:</span>
              <CountdownUnit value={pad(countdown.seconds)} label="sek" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="rounded bg-white/15 px-1.5 py-0.5">{value}</span>
      <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wider text-white/70 sm:text-[9px]">
        {label}
      </span>
    </span>
  );
}
