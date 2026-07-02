import { useListCourses } from "@workspace/api-client-react";
import { usePurchase } from "@/hooks/use-purchase";
import { ArrowRight } from "lucide-react";

/**
 * Primary "buy access" call-to-action. Resolves the primary course and routes
 * through {@link usePurchase} so logged-out users are sent to registration
 * (with a saved intent) and users without access go straight to checkout.
 */
export function BuyAccessButton() {
  const { data: courses } = useListCourses();
  const { startPurchase, isPending } = usePurchase();
  const primaryCourseId = courses && courses.length > 0 ? courses[0].id : null;

  return (
    <button
      onClick={() => {
        if (primaryCourseId != null) void startPurchase(primaryCourseId);
      }}
      disabled={isPending || primaryCourseId == null}
      className="inline-flex items-center justify-center rounded-full h-12 px-8 text-base font-bold bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {isPending ? "Przetwarzanie..." : "Kup dostęp"}
      {!isPending && <ArrowRight className="w-5 h-5 ml-2" />}
    </button>
  );
}
