import { useState } from "react";
import { useListCourses, useGetCoursePrice } from "@workspace/api-client-react";
import { usePurchase } from "@/hooks/use-purchase";
import { useAuth } from "@/hooks/use-auth";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuyAccessButtonProps {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  fullWidth?: boolean;
}

/**
 * Primary "buy access" call-to-action. Resolves the primary course and routes
 * through {@link usePurchase}:
 *  - logged-out users are sent to registration (with a saved intent),
 *  - a logged-in buyer without access sees the checkout dialog (with the
 *    discount-code field) so promo codes are always one tap away,
 *  - users who already have access are routed to the dashboard.
 * Self-contained (owns its checkout dialog) so it can be dropped in anywhere.
 */
export function BuyAccessButton({
  label = "Kup dostęp",
  className,
  size = "lg",
  fullWidth,
}: BuyAccessButtonProps) {
  const { user } = useAuth();
  const { data: courses } = useListCourses();
  const { data: price } = useGetCoursePrice();
  const { startPurchase, isPending } = usePurchase();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const primaryCourseId = courses && courses.length > 0 ? courses[0].id : null;

  const handleBuy = () => {
    if (primaryCourseId == null) return;
    // Logged-out or already-purchased users are routed away by startPurchase
    // (to register / dashboard); only a logged-in buyer who still needs access
    // gets the discount checkout dialog.
    if (!user || user.hasAccess) {
      void startPurchase(primaryCourseId);
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <>
      <Button
        size={size}
        onClick={handleBuy}
        disabled={isPending || primaryCourseId == null}
        className={cn(
          "rounded-full font-bold shadow-md",
          fullWidth && "w-full",
          className,
        )}
      >
        {isPending ? "Przetwarzanie..." : label}
        {!isPending && <ArrowRight className="w-5 h-5 ml-2" />}
      </Button>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        courseId={primaryCourseId}
        basePriceGrosz={price?.price ?? null}
        currency={price?.currency ?? "PLN"}
        isPending={isPending}
        onConfirm={(courseId, discountCode) => {
          void startPurchase(courseId, discountCode);
        }}
      />
    </>
  );
}
