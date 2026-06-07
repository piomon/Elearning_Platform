import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export default function PaymentSuccess() {
  
  useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-success/5">
      <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-success/20 shadow-xl shadow-success/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-success" />
        
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-success/20 text-success flex items-center justify-center animate-in zoom-in duration-500 shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-foreground">Witamy pokładzie!</h1>
        
        <p className="text-lg text-muted-foreground leading-relaxed">
          Płatność została pomyślnie zrealizowana. Roczny dostęp do wszystkich materiałów edukacyjnych został właśnie aktywowany.
        </p>
        
        <div className="pt-8">
          <Link href="/dashboard" className="block w-full">
            <Button size="lg" className="w-full h-14 rounded-full text-base font-bold shadow-lg shadow-primary/25 group">
              Przejdź do Mojej Nauki <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
