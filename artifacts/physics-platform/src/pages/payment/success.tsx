import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2, Clock } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import { useGetMyPayments } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const POLL_MS = 3000;
const MAX_POLLS = 20;

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
  const [pollCount, setPollCount] = useState(0);
  const celebrated = useRef(false);

  const isPaid = user?.hasAccess ?? false;
  const stillPolling = !isPaid && pollCount < MAX_POLLS;

  const { data: payments } = useGetMyPayments({
    query: {
      refetchInterval: stillPolling ? POLL_MS : false,
    } as any,
  });

  const hasCompletedPayment = (payments || []).some((p) => p.status === "completed");
  const confirmed = isPaid || hasCompletedPayment;

  useEffect(() => {
    if (!stillPolling) return;
    const id = setInterval(() => {
      setPollCount((c) => c + 1);
      refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [stillPolling, refresh]);

  useEffect(() => {
    if (confirmed && !celebrated.current) {
      celebrated.current = true;
      refresh();
      fireConfetti();
    }
  }, [confirmed, refresh]);

  if (confirmed) {
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
            Płatność została pomyślnie zrealizowana. Roczny dostęp do wszystkich materiałów edukacyjnych został właśnie aktywowany.
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

  if (stillPolling) {
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
          Nie otrzymaliśmy jeszcze potwierdzenia płatności. Jeśli środki zostały pobrane, dostęp aktywuje się automatycznie w ciągu kilku minut.
        </p>
        <div className="pt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" variant="outline" className="rounded-full h-14 px-8 font-bold" onClick={() => window.location.reload()}>
            Sprawdź ponownie
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
