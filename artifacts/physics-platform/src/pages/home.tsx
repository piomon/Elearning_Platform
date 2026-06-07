import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useListCourses } from "@workspace/api-client-react";
import { PlayCircle, CheckCircle, Zap, Brain, Target, Star, ArrowRight, ChevronRight } from "lucide-react";

export default function Home() {
  const { data: courses } = useListCourses();

  return (
    <div className="flex flex-col">

      {/* ── HERO ── */}
      <section className="hero-bg relative overflow-hidden min-h-[92vh] flex items-center">
        {/* decorative grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* floating physics equations */}
        <div className="absolute top-24 left-8 text-blue-500/10 font-mono text-4xl font-bold select-none hidden lg:block">F = ma</div>
        <div className="absolute bottom-32 left-16 text-violet-500/10 font-mono text-3xl font-bold select-none hidden lg:block">v = s/t</div>
        <div className="absolute top-40 right-12 text-cyan-500/10 font-mono text-3xl font-bold select-none hidden lg:block">Ek = ½mv²</div>
        <div className="absolute bottom-24 right-24 text-blue-400/10 font-mono text-2xl font-bold select-none hidden lg:block">Ep = mgh</div>

        <div className="container mx-auto max-w-5xl px-4 py-24 text-center relative z-10 space-y-8">
          {/* badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 text-blue-400"
            style={{ background: "rgba(59,130,246,0.08)" }}>
            <Zap className="w-3.5 h-3.5" />
            Platforma edukacyjna oparta na AI · Fizyka klasy 7
          </div>

          {/* headline */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="text-foreground">Opanuj fizykę</span>
            <br />
            <span className="gradient-text">szybciej niż ktokolwiek</span>
            <br />
            <span className="text-foreground">w klasie</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Materiały wideo, interaktywne quizy i zadania sprawdzane przez AI w czasie rzeczywistym. Stworzony dla siódmoklasistów, doceniany przez rodziców.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 py-6 font-bold text-white shadow-2xl"
                style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", boxShadow: "0 0 40px rgba(59,130,246,0.4)" }}
              >
                Zacznij za darmo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-base px-8 py-6 border-white/15 text-foreground hover:bg-white/5"
            >
              <PlayCircle className="w-4 h-4 mr-2 text-blue-400" /> Zobacz jak działa
            </Button>
          </div>

          {/* stats strip */}
          <div className="flex flex-wrap items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-foreground">9</span>
              <span>tematów lekcji</span>
            </div>
            <div className="w-px h-6 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-foreground">3</span>
              <span>działy kursu</span>
            </div>
            <div className="w-px h-6 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black gradient-text-blue">AI</span>
              <span>sprawdza zadania natychmiast</span>
            </div>
            <div className="w-px h-6 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {["bg-blue-500", "bg-violet-500", "bg-cyan-500"].map((c, i) => (
                  <div key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-background`} />
                ))}
              </div>
              <span>Setki uczniów już korzysta</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-3">
            <p className="text-sm font-semibold text-red-400 uppercase tracking-widest">Problem</p>
            <h2 className="text-3xl md:text-4xl font-bold">Tradycyjna nauka fizyki nie działa</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "Suche wzory i definicje",
                desc: "Podręczniki pełne abstrakcji bez odniesienia do prawdziwego życia. Uczeń zapamiętuje, nie rozumie.",
                color: "from-red-500/20 to-orange-500/10",
                border: "border-red-500/20",
              },
              {
                num: "02",
                title: "Brak informacji zwrotnej",
                desc: "Rozwiązujesz zadanie i nie wiesz czy dobrze. Czekasz dni na ocenę nauczyciela.",
                color: "from-orange-500/20 to-yellow-500/10",
                border: "border-orange-500/20",
              },
              {
                num: "03",
                title: "Nakładające się zaległości",
                desc: "Jeden niezrozumiały temat pociąga za sobą kolejne. Stres przed sprawdzianem rośnie.",
                color: "from-yellow-500/20 to-red-500/10",
                border: "border-yellow-500/20",
              },
            ].map((item) => (
              <div key={item.num} className={`relative p-6 rounded-2xl border ${item.border} overflow-hidden`}
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className={`absolute inset-0 opacity-30 bg-gradient-to-br ${item.color} pointer-events-none`} />
                <span className="text-5xl font-black text-white/5 absolute top-4 right-4 leading-none">{item.num}</span>
                <h3 className="font-bold text-lg mb-2 relative z-10">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION — 3 STEPS ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center mb-16 space-y-3">
            <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest">Rozwiązanie</p>
            <h2 className="text-3xl md:text-4xl font-bold">Metoda 3 kroków, która działa</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Każdy temat to kompletna ścieżka nauki prowadząca od zrozumienia do samodzielnego zastosowania.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <PlayCircle className="w-7 h-7" />,
                title: "Zrozum",
                sub: "Wideo",
                desc: "Krótkie, angażujące materiały wideo wyjaśniające zjawiska fizyczne na przykładach z życia codziennego.",
                gradient: "from-blue-600 to-blue-400",
                glow: "rgba(59,130,246,0.3)",
              },
              {
                step: "02",
                icon: <Brain className="w-7 h-7" />,
                title: "Utrwal",
                sub: "Quiz",
                desc: "Błyskawiczny quiz sprawdzający najważniejsze pojęcia z lekcji. Natychmiastowa odpowiedź co było dobrze.",
                gradient: "from-violet-600 to-violet-400",
                glow: "rgba(139,92,246,0.3)",
              },
              {
                step: "03",
                icon: <Target className="w-7 h-7" />,
                title: "Zastosuj",
                sub: "Zadanie + AI",
                desc: "Interaktywna tablica cyfrowa do rozwiązywania zadań. Sztuczna inteligencja sprawdza i tłumaczy błędy.",
                gradient: "from-cyan-600 to-emerald-400",
                glow: "rgba(52,211,153,0.3)",
              },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div
                  className="relative p-6 rounded-2xl border border-white/8 flex flex-col gap-4 h-full transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${item.gradient} shadow-lg`}
                      style={{ boxShadow: `0 0 24px ${item.glow}` }}
                    >
                      {item.icon}
                    </div>
                    <span className="text-4xl font-black text-white/4 leading-none">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{item.sub}</p>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/30">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSE PREVIEW ── */}
      {courses && courses.length > 0 && (
        <section className="py-24 px-4 border-t border-white/5">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-12 space-y-3">
              <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest">Program</p>
              <h2 className="text-3xl md:text-4xl font-bold">Co zawiera kurs</h2>
            </div>
            <div className="space-y-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="relative p-6 rounded-2xl border border-blue-500/15 overflow-hidden"
                  style={{ background: "rgba(59,130,246,0.05)" }}
                >
                  <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: "linear-gradient(to bottom, #3B82F6, #8B5CF6)" }} />
                  <div className="pl-4">
                    <h3 className="text-lg font-bold mb-1">{course.title}</h3>
                    <p className="text-muted-foreground text-sm">{course.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                { label: "Działy", val: "3" },
                { label: "Tematy lekcji", val: "9" },
                { label: "Pytań quizowych", val: "26+" },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-xl border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-3xl font-black gradient-text-blue">{s.val}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRICING ── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)" }}
        />
        <div className="container mx-auto max-w-md relative z-10">
          <div className="text-center mb-12 space-y-3">
            <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest">Cennik</p>
            <h2 className="text-3xl md:text-4xl font-bold">Inwestycja w przyszłość dziecka</h2>
          </div>

          <div
            className="relative p-8 rounded-3xl border"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "transparent",
              backgroundClip: "padding-box",
              boxShadow: "0 0 0 1px rgba(139,92,246,0.4), 0 0 60px rgba(139,92,246,0.15), 0 0 120px rgba(59,130,246,0.1)",
            }}
          >
            <div
              className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-bold tracking-widest text-white uppercase"
              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
            >
              Najlepszy wybór
            </div>

            <div className="text-center space-y-2 mt-4 mb-8">
              <h3 className="text-xl font-bold">Pełny dostęp roczny</h3>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-black gradient-text">299</span>
                <div className="text-muted-foreground">
                  <div className="text-lg font-bold">PLN</div>
                  <div className="text-xs">/rok</div>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">Jednorazowa opłata, pełny rok nauki</p>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                "Dostęp do wszystkich 9 tematów wideo",
                "Nielimitowane quizy z natychmiastową oceną",
                "Sprawdzanie zadań przez AI bez limitu",
                "Interaktywna tablica do rysowania zadań",
                "Śledzenie postępów ucznia",
                "30-dniowa gwarancja satysfakcji",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-foreground/90">{item}</span>
                </li>
              ))}
            </ul>

            <Link href="/register">
              <Button
                size="lg"
                className="w-full text-base font-bold py-6 text-white"
                style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}
              >
                Zacznij naukę już dziś <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Bezpieczna płatność przez Przelewy24
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {[
              { icon: <Star className="w-4 h-4 text-yellow-400" />, text: '"Moja córka w końcu zrozumiała I zasadę dynamiki. Polecam!" — Mama ucznia z Krakowa' },
              { icon: <Star className="w-4 h-4 text-yellow-400" />, text: '"Zadanie sprawdzone przez AI w 3 sekundy. Rewolucja w edukacji." — Tata ucznia z Warszawy' },
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-white/5 text-sm text-muted-foreground"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                {r.icon}
                <span className="italic">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="py-24 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="container mx-auto max-w-3xl text-center space-y-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-black">
            Gotowy na <span className="gradient-text">lepsze oceny</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Dołącz do uczniów, którzy już uczą się mądrzej — nie ciężej.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="text-base px-10 py-6 font-bold text-white mt-4"
              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", boxShadow: "0 0 50px rgba(59,130,246,0.4)" }}
            >
              Rozpocznij bezpłatnie <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
