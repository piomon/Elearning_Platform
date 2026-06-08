import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link href="/">
        <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground rounded-full">
          <ChevronLeft className="w-5 h-5 mr-1" /> Wróć na stronę główną
        </Button>
      </Link>

      <article className="prose-custom space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight font-display text-foreground">Polityka prywatności</h1>
          <p className="text-muted-foreground">Informacje o przetwarzaniu danych osobowych na platformie FizykaAI.</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">1. Administrator danych</h2>
          <p className="text-muted-foreground leading-relaxed">
            Administratorem danych osobowych przetwarzanych w ramach platformy FizykaAI jest operator platformy. Dane przetwarzane są zgodnie z obowiązującymi przepisami o ochronie danych osobowych (RODO).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">2. Zakres i cel przetwarzania</h2>
          <p className="text-muted-foreground leading-relaxed">
            Przetwarzamy dane podane podczas rejestracji (imię, nazwisko, adres email) oraz dane dotyczące postępów w nauce. Dane wykorzystywane są wyłącznie w celu świadczenia usługi edukacyjnej, obsługi konta oraz realizacji płatności.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">3. Formularz kontaktowy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dane przesłane za pośrednictwem formularza kontaktowego (imię i nazwisko, adres email, treść wiadomości) przetwarzane są wyłącznie w celu udzielenia odpowiedzi na zapytanie.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">4. Sztuczna inteligencja</h2>
          <p className="text-muted-foreground leading-relaxed">
            Zadania rozwiązywane przez ucznia mogą być przetwarzane przez zewnętrzne narzędzia sztucznej inteligencji w celu wygenerowania informacji zwrotnej. Dane przekazywane są w zakresie niezbędnym do realizacji tej funkcji.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">5. Prawa użytkownika</h2>
          <p className="text-muted-foreground leading-relaxed">
            Użytkownik ma prawo dostępu do swoich danych, ich sprostowania, usunięcia oraz ograniczenia przetwarzania. W celu realizacji tych praw prosimy o kontakt poprzez{" "}
            <Link href="/#kontakt" className="text-primary hover:underline font-medium">formularz kontaktowy</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">6. Bezpieczeństwo</h2>
          <p className="text-muted-foreground leading-relaxed">
            Stosujemy odpowiednie środki techniczne i organizacyjne, aby chronić dane przed nieuprawnionym dostępem. Hasła przechowywane są w formie zaszyfrowanej, a dane kart płatniczych nie są przechowywane na naszych serwerach.
          </p>
        </section>

        <p className="text-sm text-muted-foreground pt-4 border-t border-border">
          Niniejsza polityka prywatności ma charakter informacyjny i może zostać zaktualizowana.
        </p>
      </article>
    </div>
  );
}
