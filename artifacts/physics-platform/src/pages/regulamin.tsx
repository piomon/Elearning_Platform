import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function Regulamin() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link href="/">
        <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground rounded-full">
          <ChevronLeft className="w-5 h-5 mr-1" /> Wróć na stronę główną
        </Button>
      </Link>

      <article className="prose-custom space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight font-display text-foreground">Regulamin</h1>
          <p className="text-muted-foreground">Zasady korzystania z platformy edukacyjnej fizyka7.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">1. Postanowienia ogólne</h2>
          <p className="text-muted-foreground leading-relaxed">
            Niniejszy regulamin określa zasady korzystania z platformy edukacyjnej fizyka7, przeznaczonej do nauki fizyki na poziomie klasy 7 szkoły podstawowej.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">2. Konto użytkownika</h2>
          <p className="text-muted-foreground leading-relaxed">
            Korzystanie z pełnej funkcjonalności platformy wymaga założenia konta. Użytkownik zobowiązuje się do podania prawdziwych danych oraz zachowania poufności danych logowania. Rejestracja konta ucznia przez osobę niepełnoletnią wymaga zgody rodzica lub opiekuna prawnego.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">3. Dostęp do materiałów i płatności</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dostęp do treści edukacyjnych jest płatny. Płatność realizowana jest przez zewnętrznego operatora płatności (BLIK / Paynow), a dostęp do materiałów odblokowywany jest automatycznie po potwierdzeniu płatności. Platforma nie przechowuje danych płatniczych użytkownika.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">4. Zasady korzystania</h2>
          <p className="text-muted-foreground leading-relaxed">
            Materiały udostępniane w ramach platformy przeznaczone są wyłącznie do użytku własnego użytkownika. Zabronione jest ich kopiowanie, rozpowszechnianie oraz udostępnianie osobom trzecim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">5. Sprawdzanie zadań przez AI</h2>
          <p className="text-muted-foreground leading-relaxed">
            Platforma wykorzystuje narzędzia sztucznej inteligencji do analizy zadań rozwiązywanych przez ucznia. Informacja zwrotna ma charakter pomocniczy i edukacyjny oraz nie zastępuje oceny nauczyciela.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">6. Reklamacje i kontakt</h2>
          <p className="text-muted-foreground leading-relaxed">
            Wszelkie pytania oraz reklamacje dotyczące działania platformy można zgłaszać poprzez{" "}
            <Link href="/#kontakt" className="text-primary hover:underline font-medium">formularz kontaktowy</Link>.
          </p>
        </section>

        <p className="text-sm text-muted-foreground pt-4 border-t border-border">
          Niniejszy regulamin ma charakter informacyjny i może zostać zaktualizowany. Prosimy o okresowe zapoznawanie się z jego treścią.
        </p>
      </article>
    </div>
  );
}
