import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListCourses } from "@workspace/api-client-react";

export default function Home() {
  const { data: courses } = useListCourses();

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-5xl text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Zrozum fizykę z pomocą <span className="text-primary">Sztucznej Inteligencji</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Kompleksowe kursy dla siódmoklasistów. Wideo, quizy i zadania sprawdzane na bieżąco przez cierpliwego wirtualnego nauczyciela.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8">Kup dostęp do kursu</Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
              Zobacz jak działa
            </Button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-secondary/50 py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-12">
          <h2 className="text-3xl font-bold">Fizyka nie musi być trudna</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="bg-card p-6 rounded-2xl shadow-sm space-y-4">
              <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center text-xl font-bold">1</div>
              <h3 className="font-semibold text-lg">Suche wzory</h3>
              <p className="text-muted-foreground">Podręczniki pełne są niezrozumiałych definicji, które trudno odnieść do prawdziwego życia.</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-sm space-y-4">
              <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center text-xl font-bold">2</div>
              <h3 className="font-semibold text-lg">Brak informacji zwrotnej</h3>
              <p className="text-muted-foreground">Rozwiązujesz zadanie i nie wiesz, gdzie zrobiłeś błąd. Czekasz do kolejnej lekcji.</p>
            </div>
            <div className="bg-card p-6 rounded-2xl shadow-sm space-y-4">
              <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center text-xl font-bold">3</div>
              <h3 className="font-semibold text-lg">Stres i zaległości</h3>
              <p className="text-muted-foreground">Jeden niezrozumiały temat prowadzi do kolejnych, nawarstwiając stres przed sprawdzianem.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-12">
          <h2 className="text-3xl font-bold">Nasze rozwiązanie: Metoda 3 kroków</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto">▶</div>
              <h3 className="font-bold text-xl">1. Zrozum (Wideo)</h3>
              <p className="text-muted-foreground">Krótkie, angażujące materiały wideo tłumaczące zjawiska fizyczne na przykładach.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto">?</div>
              <h3 className="font-bold text-xl">2. Utrwal (Quiz)</h3>
              <p className="text-muted-foreground">Szybki test wiedzy sprawdzający najważniejsze pojęcia z lekcji.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto">✎</div>
              <h3 className="font-bold text-xl">3. Zastosuj (Zadanie + AI)</h3>
              <p className="text-muted-foreground">Interaktywna tablica do rozwiązywania zadań, błyskawicznie sprawdzana przez AI.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Course Program */}
      <section className="bg-primary text-primary-foreground py-16 px-4">
        <div className="container mx-auto max-w-4xl space-y-8">
          <h2 className="text-3xl font-bold text-center">Program kursu</h2>
          <div className="grid gap-4">
            {courses?.slice(0, 3).map((course) => (
              <div key={course.id} className="bg-primary-foreground/10 p-6 rounded-xl backdrop-blur-sm border border-primary-foreground/20">
                <h3 className="text-xl font-semibold">{course.title}</h3>
                <p className="text-primary-foreground/80 mt-2">{course.description}</p>
              </div>
            ))}
            {(!courses || courses.length === 0) && (
              <div className="text-center text-primary-foreground/80 py-8">
                Trwa ładowanie programu kursu...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-lg text-center space-y-8">
          <h2 className="text-3xl font-bold">Inwestycja w przyszłość Twojego dziecka</h2>
          <div className="bg-card border-2 border-primary rounded-3xl p-8 shadow-xl relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold tracking-wide">
              NAJLEPSZY WYBÓR
            </div>
            <h3 className="text-2xl font-bold mt-4">Pełny dostęp roczny</h3>
            <div className="my-6 flex items-baseline justify-center gap-2">
              <span className="text-5xl font-extrabold">299</span>
              <span className="text-xl text-muted-foreground font-medium">PLN</span>
            </div>
            <ul className="text-left space-y-4 mb-8">
              <li className="flex items-center gap-3">
                <span className="text-success font-bold">✓</span> Dostęp do wszystkich materiałów wideo
              </li>
              <li className="flex items-center gap-3">
                <span className="text-success font-bold">✓</span> Nielimitowane sprawdzanie zadań przez AI
              </li>
              <li className="flex items-center gap-3">
                <span className="text-success font-bold">✓</span> Gwarancja satysfakcji
              </li>
            </ul>
            <Link href="/register">
              <Button size="lg" className="w-full text-lg">Zacznij naukę już dziś</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
