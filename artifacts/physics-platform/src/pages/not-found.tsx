import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPinOff, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-5rem)] w-full flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg mx-auto rounded-3xl border-border shadow-xl text-center overflow-hidden">
        <CardContent className="pt-16 pb-16 px-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <MapPinOff className="h-10 w-10 text-primary" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-foreground mb-4">Błąd 404</h1>
          <p className="text-xl font-medium text-foreground mb-2">Zgubiłeś się w kosmosie?</p>
          <p className="text-muted-foreground mb-10 max-w-sm mx-auto">
            Strona, której szukasz, nie istnieje lub została przeniesiona pod inny adres.
          </p>
          
          <Link href="/">
            <Button size="lg" className="rounded-full px-8 h-14 font-bold shadow-md w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" /> Wróć na Ziemię (Strona Główna)
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
