import { useState } from "react";
import { Link } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListCourses,
  useGetCoursePrice,
  useSubmitContact,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { usePurchase } from "@/hooks/use-purchase";
import { formatPln } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PlayCircle, CheckCircle2, Zap, Brain, Target, ArrowRight, BookOpen,
  Lightbulb, Activity, ChevronRight, ShieldCheck, HeartHandshake, Sparkles,
  PencilRuler, Send,
} from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(1, { message: "Imię i nazwisko są wymagane" }),
  email: z.string().email({ message: "Nieprawidłowy adres email" }),
  subject: z.string().min(1, { message: "Temat jest wymagany" }),
  message: z.string().min(10, { message: "Wiadomość musi mieć minimum 10 znaków" }),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Zgoda na kontakt jest wymagana" }),
  }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

function ContactForm() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
      consent: false as unknown as true,
    },
  });

  const mutation = useSubmitContact({
    mutation: {
      onSuccess: () => {
        setSent(true);
        form.reset();
        toast({
          title: "Wiadomość wysłana",
          description: "Dziękujemy! Odpowiemy najszybciej, jak to możliwe.",
        });
      },
      onError: (err) => {
        toast({
          title: "Nie udało się wysłać wiadomości",
          description:
            err instanceof Error
              ? err.message
              : "Spróbuj ponownie za chwilę.",
          variant: "destructive",
        });
      },
    },
  });

  const onSubmit = (values: ContactFormValues) => {
    mutation.mutate({ data: values });
  };

  if (sent) {
    return (
      <div className="bg-card rounded-3xl border border-border shadow-sm p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-2xl font-bold font-display">Dziękujemy za wiadomość</h3>
        <p className="text-muted-foreground">Odezwiemy się na podany adres email tak szybko, jak to możliwe.</p>
        <Button variant="outline" className="rounded-full" onClick={() => setSent(false)}>
          Wyślij kolejną wiadomość
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card rounded-3xl border border-border shadow-sm p-6 sm:p-8 space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="font-semibold text-foreground/80">Imię i nazwisko</Label>
          <Input id="contact-name" {...form.register("name")} className="h-12 rounded-xl bg-muted/50" placeholder="Jan Kowalski" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive font-medium">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="font-semibold text-foreground/80">Adres email</Label>
          <Input id="contact-email" type="email" {...form.register("email")} className="h-12 rounded-xl bg-muted/50" placeholder="jan@example.com" />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive font-medium">{form.formState.errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-subject" className="font-semibold text-foreground/80">Temat</Label>
        <Input id="contact-subject" {...form.register("subject")} className="h-12 rounded-xl bg-muted/50" placeholder="W czym możemy pomóc?" />
        {form.formState.errors.subject && (
          <p className="text-sm text-destructive font-medium">{form.formState.errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-message" className="font-semibold text-foreground/80">Wiadomość</Label>
        <Textarea id="contact-message" rows={5} {...form.register("message")} className="rounded-xl bg-muted/50 resize-none" placeholder="Napisz do nas, a my odpowiemy najszybciej, jak to możliwe." />
        {form.formState.errors.message && (
          <p className="text-sm text-destructive font-medium">{form.formState.errors.message.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id="contact-consent"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                className="mt-0.5"
              />
            )}
          />
          <Label htmlFor="contact-consent" className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
            Wyrażam zgodę na przetwarzanie moich danych w celu udzielenia odpowiedzi na zapytanie, zgodnie z{" "}
            <Link href="/polityka-prywatnosci" className="text-primary hover:underline font-medium">polityką prywatności</Link>.
          </Label>
        </div>
        {form.formState.errors.consent && (
          <p className="text-sm text-destructive font-medium">{form.formState.errors.consent.message}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full rounded-full h-14 text-base font-bold" disabled={mutation.isPending}>
        {mutation.isPending ? "Wysyłanie..." : "Wyślij wiadomość"}
        {!mutation.isPending && <Send className="w-4 h-4 ml-2" />}
      </Button>
    </form>
  );
}

export default function Home() {
  const { data: courses } = useListCourses();
  const { data: priceData } = useGetCoursePrice();
  const { user } = useAuth();
  const { startPurchase, isPending } = usePurchase();

  const primaryCourseId = courses && courses.length > 0 ? courses[0].id : null;
  const priceLabel = priceData ? formatPln(priceData.price, priceData.currency) : null;

  const handleBuy = () => {
    if (primaryCourseId != null) {
      void startPurchase(primaryCourseId);
    }
  };

  const faqs = [
    {
      q: "Dla kogo jest ta platforma?",
      a: "Dla uczniów klasy 7 szkoły podstawowej oraz ich rodziców. Materiał jest w pełni zgodny z polską podstawą programową z fizyki.",
    },
    {
      q: "Jak działa sprawdzanie zadań przez AI?",
      a: "Uczeń rozwiązuje zadanie na wirtualnej tablicy, a sztuczna inteligencja analizuje tok rozumowania i wskazuje, co jest poprawne, a nad czym warto jeszcze popracować.",
    },
    {
      q: "Jak długo trwa dostęp po zakupie?",
      a: "Dostęp do wszystkich materiałów jest aktywny przez 365 dni od momentu zakupu.",
    },
    {
      q: "Czy potrzebuję specjalnego sprzętu?",
      a: "Wystarczy komputer, tablet lub telefon z przeglądarką. Do wygodnego rozwiązywania zadań polecamy tablet lub komputer z myszką.",
    },
    {
      q: "Czy płatność jest bezpieczna?",
      a: "Tak. Płatności obsługiwane są przez zewnętrznego, zaufanego operatora płatności online. Nie przechowujemy danych Twojej karty.",
    },
  ];

  return (
    <div className="flex flex-col w-full overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center pt-8 pb-16 md:pt-0 overflow-hidden">
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
                {user ? (
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full text-base h-14 px-8 font-bold shadow-lg shadow-primary/25 rounded-full transition-transform hover:-translate-y-0.5">
                      Przejdź do nauki <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleBuy}
                    disabled={isPending || primaryCourseId == null}
                    className="w-full sm:w-auto text-base h-14 px-8 font-bold shadow-lg shadow-primary/25 rounded-full transition-transform hover:-translate-y-0.5"
                  >
                    {isPending ? "Przetwarzanie..." : "Kup dostęp"} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
                <a href="#metoda" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full text-base h-14 px-8 rounded-full border-border/60 bg-background/50 backdrop-blur-sm">
                    <PlayCircle className="w-5 h-5 mr-2 text-primary" /> Jak to działa?
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 pt-4 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Zgodność z podstawą programową</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Dostęp na 365 dni</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card aspect-[4/3] md:aspect-[3/2] flex items-center justify-center">
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

      {/* ── BENEFITS / TRUST STRIP ── */}
      <section className="py-12 px-4 border-y border-border bg-card">
        <div className="container mx-auto max-w-5xl grid sm:grid-cols-3 gap-8">
          {[
            { icon: <ShieldCheck className="w-6 h-6 text-primary" />, title: "Zgodność z programem", desc: "Materiał oparty na polskiej podstawie programowej dla klasy 7." },
            { icon: <Brain className="w-6 h-6 text-primary" />, title: "Wsparcie AI", desc: "Zadania sprawdzane na bieżąco z czytelną informacją zwrotną." },
            { icon: <HeartHandshake className="w-6 h-6 text-primary" />, title: "Spokojna nauka", desc: "Przyjazne tempo i jasna ścieżka bez presji i stresu." },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">{item.icon}</div>
              <div>
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
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
              { icon: <BookOpen className="w-6 h-6 text-amber-500" />, title: "Suche wzory", desc: "Zakuwanie definicji bez zrozumienia zjawisk prowadzi do szybkiego zapominania materiału.", bg: "bg-amber-500/10" },
              { icon: <Activity className="w-6 h-6 text-red-500" />, title: "Brak sprzężenia zwrotnego", desc: "Uczeń robi błędy w zadaniach domowych i dowiaduje się o nich dopiero za tydzień.", bg: "bg-red-500/10" },
              { icon: <Lightbulb className="w-6 h-6 text-blue-500" />, title: "Niezrozumienie podstaw", desc: "Zaległości nawarstwiają się z każdą lekcją, tworząc blokadę przed dalszą nauką.", bg: "bg-blue-500/10" },
            ].map((item, i) => (
              <div key={i} className="bg-card p-8 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${item.bg}`}>{item.icon}</div>
                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METHODOLOGY / 3 STEPS ── */}
      <section id="metoda" className="py-24 px-4 relative scroll-mt-20">
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
              { step: "1", icon: <PlayCircle className="w-6 h-6 text-white" />, title: "Zrozum (Wideo)", desc: "Krótkie, angażujące materiały wideo wyjaśniające zjawiska na życiowych przykładach.", color: "bg-blue-500" },
              { step: "2", icon: <Brain className="w-6 h-6 text-white" />, title: "Utrwal (Quiz)", desc: "Błyskawiczny quiz utrwalający definicje i pojęcia zaraz po obejrzeniu wideo.", color: "bg-violet-500" },
              { step: "3", icon: <Target className="w-6 h-6 text-white" />, title: "Zastosuj (Zadanie)", desc: "Rozwiązywanie zadań na wirtualnej tablicy, natychmiast sprawdzane przez AI.", color: "bg-primary" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center relative bg-card p-6 rounded-3xl border border-border shadow-sm">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform -translate-y-12 mb-[-1.5rem] ring-4 ring-background ${item.color}`}>
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
                <div key={course.id} className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between group hover:border-primary/50 transition-colors">
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

      {/* ── AI EXPLAINER ── */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6 order-2 lg:order-1">
            <span className="text-primary font-bold tracking-wider uppercase text-sm">Sztuczna inteligencja</span>
            <h2 className="text-3xl md:text-4xl font-bold">Jak AI pomaga w nauce?</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Uczeń rozwiązuje zadanie na wirtualnej tablicy — tak jak w zeszycie. Sztuczna inteligencja analizuje rozwiązanie i podpowiada, co jest dobrze, a co warto poprawić.
            </p>
            <ul className="space-y-4">
              {[
                { icon: <PencilRuler className="w-5 h-5 text-primary" />, title: "Rozwiązuj jak w zeszycie", desc: "Wirtualna tablica pozwala pisać równania i rysować odręcznie." },
                { icon: <Sparkles className="w-5 h-5 text-primary" />, title: "Natychmiastowa informacja zwrotna", desc: "Bez czekania na sprawdzenie — uczeń od razu wie, gdzie popełnił błąd." },
                { icon: <Brain className="w-5 h-5 text-primary" />, title: "Wsparcie, nie wyręczanie", desc: "AI prowadzi przez tok rozumowania, zamiast podawać gotową odpowiedź." },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">{item.icon}</div>
                  <div>
                    <h3 className="font-bold">{item.title}</h3>
                    <p className="text-muted-foreground text-sm mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2">
            <div className="bg-card rounded-3xl border border-border shadow-xl p-6 sm:p-8 space-y-5">
              <div className="rounded-2xl bg-muted/50 border border-border/50 aspect-video flex items-center justify-center">
                <PencilRuler className="w-16 h-16 text-primary/30" />
              </div>
              <div className="flex items-start gap-3 bg-success/10 border border-success/20 rounded-2xl p-4">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Dobre podejście!</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Poprawnie obliczyłeś prędkość. Pamiętaj o jednostce — wynik podaj w m/s.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARENT SECTION ── */}
      <section className="py-24 px-4 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-4xl text-center space-y-10">
          <div className="space-y-4">
            <span className="text-primary font-bold tracking-wider uppercase text-sm">Dla rodziców</span>
            <h2 className="text-3xl md:text-4xl font-bold">Spokój ducha dla rodzica</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Nie musisz być ekspertem z fizyki, aby wspierać dziecko w nauce. Platforma prowadzi je krok po kroku.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              { title: "Jasna struktura", desc: "Dziecko zawsze wie, co ma zrobić — wideo, quiz, zadanie." },
              { title: "Samodzielna nauka", desc: "Wsparcie AI sprawia, że dziecko może uczyć się we własnym tempie." },
              { title: "Bezpieczne środowisko", desc: "Platforma skupiona wyłącznie na nauce, bez rozpraszaczy." },
            ].map((item, i) => (
              <div key={i} className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-success mb-4" />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="cennik" className="py-24 px-4 scroll-mt-20">
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
                {priceLabel ? (
                  <span className="text-5xl sm:text-6xl font-black text-foreground">{priceLabel}</span>
                ) : (
                  <span className="h-14 w-40 bg-muted animate-pulse rounded-lg" />
                )}
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
                  "Zgodność z polską podstawą programową",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {user?.hasAccess ? (
                <Link href="/dashboard" className="block w-full">
                  <Button size="lg" className="w-full rounded-xl h-14 text-base font-bold shadow-md">
                    Masz już dostęp — ucz się dalej
                  </Button>
                </Link>
              ) : (
                <Button
                  size="lg"
                  onClick={handleBuy}
                  disabled={isPending || primaryCourseId == null}
                  className="w-full rounded-xl h-14 text-base font-bold shadow-md"
                >
                  {isPending ? "Przetwarzanie..." : "Kup dostęp teraz"}
                </Button>
              )}
              <p className="text-center text-xs text-muted-foreground mt-4">
                Szybka i bezpieczna płatność online.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Najczęściej zadawane pytania</h2>
            <p className="text-muted-foreground text-lg">Masz inne pytanie? Napisz do nas poniżej.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((item, i) => (
              <details key={i} className="group bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer font-bold text-foreground list-none">
                  {item.q}
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-6 -mt-1 text-muted-foreground leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="kontakt" className="py-24 px-4 scroll-mt-20">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-12 space-y-4">
            <span className="text-primary font-bold tracking-wider uppercase text-sm">Kontakt</span>
            <h2 className="text-3xl md:text-4xl font-bold">Masz pytania? Napisz do nas</h2>
            <p className="text-muted-foreground text-lg">Odpowiadamy najszybciej, jak to możliwe.</p>
          </div>
          <ContactForm />
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
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" variant="secondary" className="rounded-full px-8 h-14 text-base font-bold text-primary hover:bg-white transition-colors">
                  Przejdź do nauki
                </Button>
              </Link>
            ) : (
              <Link href="/register">
                <Button size="lg" variant="secondary" className="rounded-full px-8 h-14 text-base font-bold text-primary hover:bg-white transition-colors">
                  Załóż konto ucznia
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
