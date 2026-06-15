import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { createPayment } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const INTENT_KEY = "purchaseIntent";

export function savePurchaseIntent(courseId: number) {
  localStorage.setItem(INTENT_KEY, String(courseId));
}

export function consumePurchaseIntent(): number | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;
  localStorage.removeItem(INTENT_KEY);
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

function successReturnUrl(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/payment/success`;
}

async function redirectToPayment(courseId: number, discountCode?: string | null) {
  const res = await createPayment({
    courseId,
    returnUrl: successReturnUrl(),
    discountCode: discountCode && discountCode.trim() ? discountCode.trim() : null,
  });
  window.location.href = res.redirectUrl;
}

export function usePurchase() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const startPurchase = async (courseId: number, discountCode?: string | null) => {
    if (!user) {
      savePurchaseIntent(courseId);
      setLocation("/register");
      return;
    }
    if (user.hasAccess) {
      setLocation("/dashboard");
      return;
    }
    setIsPending(true);
    try {
      await redirectToPayment(courseId, discountCode);
    } catch (err) {
      setIsPending(false);
      toast({
        title: "Nie udało się rozpocząć płatności",
        description:
          err instanceof Error
            ? err.message
            : "Spróbuj ponownie za chwilę lub skontaktuj się z nami.",
        variant: "destructive",
      });
    }
  };

  return { startPurchase, isPending };
}

export function PurchaseResume() {
  const { user, isLoading } = useAuth();
  const resumed = useRef(false);

  useEffect(() => {
    if (isLoading || !user || resumed.current) return;
    const courseId = consumePurchaseIntent();
    if (courseId == null) return;
    resumed.current = true;
    if (user.hasAccess) return;
    void redirectToPayment(courseId).catch(() => {
      resumed.current = false;
    });
  }, [user, isLoading]);

  return null;
}
