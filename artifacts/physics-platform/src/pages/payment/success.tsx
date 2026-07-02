import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2, Clock, XCircle } from "lucide-react";
import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  verifyPayment,
  getMyPayments,
  mockCompletePayment,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const POLL_MS = 5000;
const MAX_POLLS = 12;

type Status = "pending" | "completed" | "failed";

function fireConfetti() {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
}

export default function PaymentSuccess() {
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState<Status>("pending");
  const [attempts, setAttempts] = useState(0);
  const [rechecking, setRechecking] = useState(false);

  const celebrated = useRef(false);
  const inFlight = useRef(false);
  const finished = useRef(false);
  const mockTriggered = useRef(false);

  // Resolve which local payment to reconcile. Real Paynow returns to
  // `?pid=<localId>` (appended server-side to the continueUrl); the dev mock
  // flow uses `?paymentId=<localId>&mock=true`. `pid` is used instead of
  // `paymentId` because Paynow appends its own `paymentId=<providerId>` param.
  const params = new URLSearchParams(window.location.search);
  const pidParam = Number(params.get("pid"));
  const mockParam = Number(params.get("paymentId"));
  const isMock =
    params.get("mock") === "true" && Number.isFinite(mockParam) && mockParam > 0;
  const knownPaymentId =
    Number.isFinite(pidParam) && pidParam > 0
      ? pidParam
      : isMock
        ? mockParam
        : null;

  // Reconcile the payment against the backend exactly once. The backend actively
  // pulls the status from Paynow (POST /payments/:id/verify) instead of waiting
  // for the webhook, so access activates even when the webhook never arrives.
  const checkOnce = useCallback(async () => {
    if (inFlight.current || finished.current) return;
    inFlight.current = true;
    try {
      // Dev/local mock: complete the payment once (no real provider). 404s in
      // production, where the route does not exist — safely ignored.
      if (isMock && !mockTriggered.current) {
        mockTriggered.current = true;
        try {
          await mockCompletePayment(mockParam);
        } catch {
          /* not available in production */
        }
      }

      // Determine which payment to verify. Fall back to the most recent
      // non-completed payment when the return URL carried no id.
      let id = knownPaymentId;
      if (id == null) {
        try {
          const mine = await getMyPayments();
          if (mine.some((p) => p.status === "completed")) {
            setStatus("completed");
            return;
          }
          const pending = [...mine]
            .reverse()
            .find((p) => p.status === "pending");
          if (pending) id = pending.id;
        } catch {
          /* transient — retry on the next tick */
        }
      }
      if (id == null) return;

      const res = await verifyPayment(id);
      if (res.status === "completed") setStatus("completed");
      else if (res.status === "failed") setStatus("failed");
      // "pending" — keep polling until confirmed or attempts run out.
    } catch {
      /* transient — retry on the next tick */
    } finally {
      inFlight.current = false;
    }
  }, [isMock, mockParam, knownPaymentId]);

  // If access is already active (e.g. the webhook landed first), short-circuit.
  useEffect(() => {
    if (user?.hasAccess) setStatus("completed");
  }, [user?.hasAccess]);

  // Poll: check now, then again every POLL_MS until a terminal status or the
  // attempt cap. verifyPayment/getMyPayments are stable module-level fetchers,
  // so no unstable mutation object ever enters the effect deps.
  useEffect(() => {
    if (status !== "pending" || attempts >= MAX_POLLS) return;
    void checkOnce();
    const t = setTimeout(() => setAttempts((a) => a + 1), POLL_MS);
    return () => clearTimeout(t);
  }, [status, attempts, checkOnce]);

  // On confirmation: refresh access (hasAccess) and celebrate once.
  useEffect(() => {
    if (status === "completed") {
      finished.current = true;
      refresh();
      if (!celebrated.current) {
        celebrated.current = true;
        fireConfetti();
      }
    } else if (status === "failed") {
      finished.current = true;
    }
  }, [status, refresh]);

  const manualRecheck = useCallback(async () => {
    if (rechecking) return;
    setRechecking(true);
    finished.current = false;
    inFlight.current = false;
    setAttempts(0);
    setStatus("pending");
    await checkOnce();
    setRechecking(false);
  }, [checkOnce, rechecking]);

  const timedOut = status === "pending" && attempts >= MAX_POLLS && !rechecking;

  if (status === "completed") {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-success/5">
        <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-success/20 shadow-xl shadow-success/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-success" />
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-success/20 text-success flex items-center justify-center animate-in zoom-in duration-500 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-foreground">Witamy na pokładzie!</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Płatność została pomyślnie zrealizowana. Dostęp do wszystkich materiałów edukacyjnych został właśnie aktywowany.
          </p>
          <div className="pt-8">
            <Link href="/dashboard" className="block w-full">
              <Button size="lg" className="w-full h-14 rounded-full text-base font-bold shadow-lg shadow-primary/25 group">
                Przejdź do mojej nauki <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-muted/30">
        <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-border shadow-xl">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shadow-inner">
              <XCircle className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-foreground">Płatność nie powiodła się</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Twoja płatność została odrzucona lub anulowana. Nie pobrano żadnych środków. Możesz spróbować ponownie.
          </p>
          <div className="pt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/#cennik">
              <Button size="lg" className="w-full rounded-full h-14 px-8 font-bold">
                Spróbuj ponownie
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="w-full rounded-full h-14 px-8 font-bold">
                Przejdź do kokpitu
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground pt-2">
            Problem z płatnością?{" "}
            <Link href="/#kontakt" className="text-primary hover:underline font-medium">Napisz do nas</Link>.
          </p>
        </div>
      </div>
    );
  }

  if (!timedOut) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-muted/30">
        <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-border shadow-xl">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Loader2 className="w-12 h-12 animate-spin" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-foreground">Potwierdzamy płatność...</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Trwa potwierdzanie Twojej płatności przez operatora. To może potrwać kilkanaście sekund — nie zamykaj tej strony.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-muted/30">
      <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-border shadow-xl">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shadow-inner">
            <Clock className="w-12 h-12" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-foreground">Płatność jest przetwarzana</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Nie otrzymaliśmy jeszcze potwierdzenia płatności. Jeśli środki zostały pobrane, dostęp aktywuje się w ciągu kilku minut. Możesz sprawdzić status ręcznie.
        </p>
        <div className="pt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-14 px-8 font-bold"
            onClick={() => void manualRecheck()}
            disabled={rechecking}
          >
            {rechecking ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" /> Sprawdzam...
              </>
            ) : (
              "Sprawdź status płatności"
            )}
          </Button>
          <Link href="/dashboard">
            <Button size="lg" className="w-full rounded-full h-14 px-8 font-bold">
              Przejdź do kokpitu
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground pt-2">
          Problem z płatnością?{" "}
          <Link href="/#kontakt" className="text-primary hover:underline font-medium">Napisz do nas</Link>.
        </p>
      </div>
    </div>
  );
}
