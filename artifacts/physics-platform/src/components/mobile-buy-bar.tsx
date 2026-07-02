import { useGetCoursePrice } from "@workspace/api-client-react";
import { BuyAccessButton } from "@/components/buy-access-button";
import { formatPln } from "@/lib/format";
import { discountPercent } from "@/lib/promo";
import { Flame } from "lucide-react";

/**
 * App-style sticky bottom purchase bar shown on mobile to every visitor who
 * does NOT yet have access (logged-out prospects and logged-in buyers alike).
 * It is the single mobile bottom bar for such users — {@link MobileNav}
 * (the learning nav) only renders once access is granted — so the buy CTA and
 * price are always visible without scrolling, and there is no dead "Nauka"
 * link to loop through. Rendered globally from the Layout.
 */
export function MobileBuyBar() {
  const { data: price } = useGetCoursePrice();

  const promoActive = price?.promoEnabled !== false;
  const priceLabel = price ? formatPln(price.price, price.currency) : null;
  const hasOldPrice = !!(price && price.oldPrice && price.oldPrice > price.price);
  const oldPriceLabel =
    hasOldPrice && price ? formatPln(price.oldPrice!, price.currency) : null;
  const discount =
    hasOldPrice && price ? discountPercent(price.oldPrice!, price.price) : 0;
  const showOldPrice = promoActive && hasOldPrice;
  const showDiscount = promoActive && discount > 0;

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight shrink-0">
          {priceLabel ? (
            <span className="flex items-baseline gap-1.5">
              {showOldPrice && oldPriceLabel && (
                <span className="text-xs font-bold text-muted-foreground/70 line-through">
                  {oldPriceLabel}
                </span>
              )}
              <span className="text-lg font-black tracking-tight">
                {priceLabel}
                <span className="text-xs font-bold text-muted-foreground"> / mies.</span>
              </span>
              {showDiscount && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-primary via-violet-600 to-cyan-500 text-white px-1.5 py-0.5 text-[10px] font-black">
                  <Flame className="w-2.5 h-2.5" /> -{discount}%
                </span>
              )}
            </span>
          ) : (
            <>
              <span className="text-base font-bold tracking-tight">fizyka7</span>
              <span className="text-[11px] text-muted-foreground font-medium">Klasa 7</span>
            </>
          )}
        </div>
        <BuyAccessButton
          label="Kup dostęp"
          className="flex-1 h-12 text-base shadow-lg shadow-primary/25"
        />
      </div>
    </div>
  );
}
