import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft } from "lucide-react";

export default function PaymentError() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-destructive/5">
      <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-destructive/20 shadow-xl shadow-destructive/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-destructive" />
        
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-destructive/10 text-destructive flex items-center justify-center animate-in zoom-in duration-500">
            <XCircle className="w-12 h-12" />
          </div>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-foreground">Płatność odrzucona</h1>
        
        <p className="text-lg text-muted-foreground leading-relaxed">
          Niestety transakcja nie mogła zostać zrealizowana. Twoje konto bankowe nie zostało obciążone. Spróbuj ponownie lub wybierz inną metodę płatności.
        </p>
        
        <div className="pt-8">
          <Link href="/" className="block w-full">
            <Button variant="outline" size="lg" className="w-full h-14 rounded-full text-base font-bold border-border/60 hover:bg-muted group">
              <ArrowLeft className="mr-2 w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Wróć do strony głównej
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
