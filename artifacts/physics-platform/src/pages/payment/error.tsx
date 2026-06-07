import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentError() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <XCircle className="w-24 h-24 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold">Wystąpił błąd płatności</h1>
        <p className="text-lg text-muted-foreground">
          Niestety Twoja płatność nie mogła zostać zrealizowana. Twoje konto nie zostało obciążone.
        </p>
        <div className="pt-4 flex gap-4">
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full">Powrót do strony głównej</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
