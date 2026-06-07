import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListCourses } from "@workspace/api-client-react";
import { PlayCircle, CheckCircle2, Zap, Brain, Target, Star, ArrowRight, BookOpen, Lightbulb, Activity, ChevronRight } from "lucide-react";

export default function Home() {
  const { data: courses } = useListCourses();

  return (
    <div className="flex flex-col w-full overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center pt-8 pb-16 md:pt-0 overflow-hidden">
        {/* Soft background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50 dark:opacity-20" />
        
        <div className="container mx-auto max-w-6xl px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            <div className="space-y-8 text-center lg:text-left pt-12 lg:pt-0">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mx-auto lg:mx-0">
                <Zap className="w-3.5 h-3.5" />
                Inteligentna platforma edukacyjna
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-foreground">
                Fizyka w 7 klasie <br className="hidden sm:block"/>
                <span className="text-primary">nie musi być trudna.</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                Materiały wideo, interaktywne quizy i zadania sprawdzane przez AI. 
                Pomóż swojemu dziecku zrozumieć fizykę w przyjaznym, spokojnym środowisku.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full text-base h-14 px-8 font-bold shadow-lg shadow-primary/25 rounded-full transition-transform hover:-translate-y-0.5"
                  >
                    Rozpocznij darmową próbę <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base h-14 px-8 rounded-full border-border/60 bg-background/50 backdrop-blur-sm"
                >
                  <PlayCircle className="w-5 h-5 mr-2 text-primary" /> Jak to działa?
                </Button>
              </div>
              
              <div className="flex items-center justify-center lg:justify-start gap-4 pt-4 text-sm font-medium text-muted-foreground">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Uczeń" className="w-full h-full object-cover opacity-80" />
                    </div>
                  ))}
                </div>
                <span>Dołączyło już ponad <strong className="text-foreground">500</strong> uczniów</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card aspect-[4/3] md:aspect-[3/2] flex items-center justify-center">
                {/* Simulated App UI Preview */}
                <div className="absolute inset-0 bg-secondary/30" />
                <div className="w-full h-full flex flex-col p-4 sm:p-6 relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  
                  <div className="flex-1 rounded-xl bg-background border border-border/50 shadow-sm p-4 sm:p-6 flex flex-col space-y-4">
                    <div className="h-4 w-1/3 bg-muted rounded-full" />
                    <div className="h-8 w-2/3 bg-foreground/10 rounded-lg" />
                    <div className="flex-1 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-primary/40" />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div className="h-10 w-24 bg-muted rounded-lg" />
                      <div className="h-10 w-32 bg-primary rounded-lg" />
                    </div>
                  </div>
                </div>
                
                {/* Floating elements */}
                <div className="absolute -right-4 -bottom-4 bg-background p-4 rounded-2xl shadow-xl border border-border/50 flex items-center gap-3 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                  <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Status zadania</p>
                    <p className="text-sm font-bold text-foreground">Świetnie rozwiązane!</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PAIN POINTS / PROBLEM ── */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Dlaczego fizyka bywa trudna?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Tradycyjny model nauczania nie zawsze sprawdza się w przypadku nauk ścisłych.</p>
          </div>
          
          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: <BookOpen className="w-6 h-6 text-amber-500" />,
                title: "Suche wzory",
                desc: "Zakuwanie definicji bez zrozumienia zjawisk prowadzi do szybkiego zapominania materiału.",
                bg: "bg-amber-500/10"
              },
              {
                icon: <Activity className="w-6 h-6 text-red-500" />,
                title: "Brak sprzężenia zwrotnego",
                desc: "Uczeń robi błędy w zadaniach domowych i dowiaduje się o nich dopiero za tydzień.",
                bg: "bg-red-500/10"
              },
              {
                icon: <Lightbulb className="w-6 h-6 text-blue-500" />,
                title: "Niezrozumienie podstaw",
                desc: "Zaległości nawarstwiają się z każdą lekcją, tworząc blokadę przed dalszą nauką.",
                bg: "bg-blue-500/10"
              }
            ].map((item, i) => (
              <div key={i} className="bg-card p-8 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${item.bg}`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METHODOLOGY / 3 STEPS ── */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-20 space-y-4">
            <span className="text-primary font-bold tracking-wider uppercase text-sm">Nasza Metoda</span>
            <h2 className="text-3xl md:text-4xl font-bold">Prosty, przewidywalny proces nauki</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Podzieliliśmy każdy temat na trzy jasne kroki. Uczeń zawsze wie, co ma robić.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border -z-10" />
            
            {[
              {
                step: "1",
                icon: <PlayCircle className="w-6 h-6 text-white" />,
                title: "Zrozum (Wideo)",
                desc: "Krótkie, angażujące materiały wideo wyjaśniające zjawiska na życiowych przykładach.",
                color: "bg-blue-500"
              },
              {
                step: "2",
                icon: <Brain className="w-6 h-6 text-white" />,
                title: "Utrwal (Quiz)",
                desc: "Błyskawiczny quiz utrwalający definicje i pojęcia zaraz po obejrzeniu wideo.",
                color: "bg-violet-500"
              },
              {
                step: "3",
                icon: <Target className="w-6 h-6 text-white" />,
                title: "Zastosuj (Zadanie)",
                desc: "Rozwiązywanie zadań na wirtualnej tablicy, natychmiast sprawdzane przez AI.",
                color: "bg-primary"
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center relative bg-card p-6 rounded-3xl border border-border shadow-sm">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform -translate-y-12 mb-[-1.5rem] ring-4 ring-background ${item.color}`}>
                  {item.icon}
                </div>
                <div className="w-full pt-4">
                  <span className="text-sm font-bold text-muted-foreground mb-1 block">Krok {item.step}</span>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSE CONTENT ── */}
      {courses && courses.length > 0 && (
        <section className="py-24 px-4 bg-muted/30 border-y border-border">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Program zgodny z podstawą programową</h2>
              <p className="text-muted-foreground text-lg">Przygotowuje do sprawdzianów i buduje trwałą wiedzę.</p>
            </div>
            
            <div className="grid gap-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between group hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{course.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{course.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRICING ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-lg">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Zainwestuj w wiedzę dziecka</h2>
            <p className="text-muted-foreground text-lg">Prosty cennik. Brak ukrytych kosztów.</p>
          </div>

          <div className="bg-card rounded-3xl border-2 border-primary/20 shadow-xl overflow-hidden relative">
            <div className="bg-primary/5 px-8 py-6 text-center border-b border-border">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary mb-4 uppercase tracking-wider">
                Pełny dostęp roczny
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-6xl font-black text-foreground">299</span>
                <span className="text-xl font-bold text-muted-foreground">PLN</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Dostęp przez 365 dni od zakupu</p>
            </div>
            
            <div className="p-8">
              <ul className="space-y-4 mb-8">
                {[
                  "Dostęp do wszystkich tematów klasy 7",
                  "Wideo tłumaczące zagadnienia",
                  "Nielimitowane quizy sprawdzające",
                  "Sztuczna Inteligencja sprawdzająca zadania",
                  "Wirtualna tablica edukacyjna",
                  "Zgodność z polską podstawą programową"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              
              <Link href="/register" className="block w-full">
                <Button size="lg" className="w-full rounded-xl h-14 text-base font-bold shadow-md">
                  Kup dostęp teraz
                </Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground mt-4">
                Szybka i bezpieczna płatność online.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Gotowy na spokojniejszą naukę?</h2>
          <p className="text-primary-foreground/80 text-lg">
            Dołącz do platformy, która zamienia stres przed sprawdzianem w przyjemność z rozumienia fizyki.
          </p>
          <div className="pt-4">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="rounded-full px-8 h-14 text-base font-bold text-primary hover:bg-white transition-colors">
                Zarejestruj konto ucznia
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
    </div>
  );
}
