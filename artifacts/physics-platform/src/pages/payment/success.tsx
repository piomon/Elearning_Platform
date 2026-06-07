import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <CheckCircle2 className="w-24 h-24 text-success" />
        </div>
        <h1 className="text-4xl font-bold">Dziękujemy za zakup!</h1>
        <p className="text-lg text-muted-foreground">
          Twój dostęp do kursów został pomyślnie aktywowany. Możesz teraz rozpocząć naukę.
        </p>
        <div className="pt-4">
          <Link href="/dashboard">
            <Button size="lg" className="w-full text-lg">Przejdź do kokpitu</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
