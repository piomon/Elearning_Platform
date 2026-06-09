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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  PlayCircle, CheckCircle2, Zap, Brain, Target, ArrowRight, BookOpen,
  ShieldCheck, HeartHandshake, Sparkles,
  PencilRuler, Send, Star, Clock, Trophy, LineChart
} from "lucide-react";

import { BlobBackground } from "@/components/blob-background";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { AnimatedWrapper } from "@/components/animated-wrapper";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { FeatureCard } from "@/components/feature-card";
import { CourseModuleCard } from "@/components/course-module-card";

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
      <section className="relative min-h-[95vh] flex items-center pt-24 pb-16 md:pt-32 overflow-hidden">
        <BlobBackground variant="blue" className="opacity-80" />

        <div className="container mx-auto max-w-7xl px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
            
            <AnimatedWrapper direction="right" delay={0.1}>
              <div className="space-y-8 text-center lg:text-left">
                <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-background/80 backdrop-blur-md text-primary border border-primary/20 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                    AI sprawdza zadania
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-background/80 backdrop-blur-md text-violet-600 border border-violet-500/20 shadow-sm">
                    <Brain className="w-4 h-4" />
                    Quizy po każdej lekcji
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-background/80 backdrop-blur-md text-amber-600 border border-amber-500/20 shadow-sm">
                    <Clock className="w-4 h-4" />
                    365 dni dostępu
                  </div>
                </div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] text-foreground">
                  Fizyka w 7 klasie <br className="hidden sm:block"/>
                  <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">zrozumiała jak nigdy.</span>
                </h1>

                <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Koniec z zakuwaniem wzorów. Nowoczesna platforma edukacyjna, która uczy fizyki przez interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                  {user ? (
                    <Link href="/dashboard" className="w-full sm:w-auto">
                      <Button size="lg" className="w-full text-lg h-16 px-10 font-bold shadow-xl shadow-primary/30 rounded-full hover-lift">
                        Przejdź do nauki <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleBuy}
                      disabled={isPending || primaryCourseId == null}
                      className="w-full sm:w-auto text-lg h-16 px-10 font-bold shadow-xl shadow-primary/30 rounded-full hover-lift"
                    >
                      {isPending ? "Przetwarzanie..." : "Kup dostęp"} <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                  <a href="#metoda" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full text-lg h-16 px-10 font-bold rounded-full border-2 border-border/80 bg-background/50 backdrop-blur-md hover:bg-background/80 transition-all">
                      Zobacz jak działa
                    </Button>
                  </a>
                </div>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-6 text-sm font-medium text-muted-foreground/80">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                  <span>Zaufali nam rodzice i uczniowie</span>
                </div>
              </div>
            </AnimatedWrapper>

            <AnimatedWrapper direction="left" delay={0.3}>
              <div className="relative mx-auto w-full max-w-2xl lg:max-w-none perspective-1000">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-background/90 backdrop-blur-xl aspect-square sm:aspect-[4/3] flex flex-col p-4 sm:p-6 transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out">
                  {/* Browser-like header */}
                  <div className="flex items-center gap-2 mb-6 border-b border-border/50 pb-4">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-inner" />
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-inner" />
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-inner" />
                    <div className="mx-auto bg-muted/50 rounded-md h-6 w-1/3" />
                  </div>

                  {/* App Content */}
                  <div className="flex-1 grid grid-cols-12 gap-4">
                    {/* Sidebar mock */}
                    <div className="col-span-3 space-y-3 border-r border-border/50 pr-4 hidden sm:block">
                      <div className="h-8 w-full bg-primary/10 rounded-lg flex items-center px-3">
                        <div className="w-4 h-4 bg-primary/40 rounded-sm mr-2" />
                        <div className="h-2 w-16 bg-primary/40 rounded-full" />
                      </div>
                      <div className="h-8 w-full bg-muted/50 rounded-lg flex items-center px-3">
                        <div className="w-4 h-4 bg-muted-foreground/30 rounded-sm mr-2" />
                        <div className="h-2 w-20 bg-muted-foreground/30 rounded-full" />
                      </div>
                      <div className="h-8 w-full bg-muted/50 rounded-lg flex items-center px-3">
                        <div className="w-4 h-4 bg-muted-foreground/30 rounded-sm mr-2" />
                        <div className="h-2 w-12 bg-muted-foreground/30 rounded-full" />
                      </div>
                    </div>
                    
                    {/* Main area mock */}
                    <div className="col-span-12 sm:col-span-9 flex flex-col space-y-4">
                      {/* Video Player Mock */}
                      <div className="relative w-full rounded-2xl bg-secondary overflow-hidden aspect-video flex items-center justify-center border border-border/50 shadow-inner">
                        <img src="https://images.unsplash.com/photo-1636466497217-26c8c54151a6?auto=format&fit=crop&q=80&w=800" alt="Physics" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <PlayCircle className="w-16 h-16 text-white drop-shadow-lg relative z-10" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                          <div className="h-1.5 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full w-2/3 bg-primary rounded-full" />
                          </div>
                          <span className="text-white text-xs font-medium drop-shadow-md">04:20 / 06:15</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Progress card mock */}
                        <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm flex items-center gap-4">
                          <ProgressRing progress={67} size={48} strokeWidth={4}>
                            <span className="text-xs font-bold">67%</span>
                          </ProgressRing>
                          <div>
                            <div className="h-3 w-20 bg-foreground/80 rounded-full mb-2" />
                            <div className="h-2 w-16 bg-muted-foreground/50 rounded-full" />
                          </div>
                        </div>
                        {/* Quiz mock */}
                        <div className="bg-violet-500/10 rounded-2xl border border-violet-500/20 p-4 shadow-sm flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <Brain className="w-5 h-5 text-violet-600" />
                          </div>
                          <div>
                            <div className="h-3 w-16 bg-violet-600/80 rounded-full mb-2" />
                            <div className="h-2 w-12 bg-violet-600/50 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -right-8 -top-8 bg-card p-4 rounded-2xl shadow-xl border border-border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 hidden md:flex hover-lift z-20">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Zadanie domowe</p>
                    <p className="text-sm font-bold text-foreground">Świetnie rozwiązane!</p>
                  </div>
                </div>
                
                <div className="absolute -left-6 -bottom-6 bg-card p-4 rounded-2xl shadow-xl border border-border flex items-center gap-3 animate-in fade-in slide-in-from-top-8 duration-700 delay-700 hidden md:flex hover-lift z-20">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Nowe osiągnięcie</p>
                    <p className="text-sm font-bold text-foreground">Mistrz Kinematyki</p>
                  </div>
                </div>
              </div>
            </AnimatedWrapper>

          </div>
        </div>
      </section>

      {/* ── BENEFITS / TRUST STRIP ── */}
      <section className="py-12 border-y border-border bg-card/50 backdrop-blur-sm relative z-20">
        <div className="container mx-auto max-w-6xl px-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />, title: "Zgodność z programem", desc: "Zawsze na bieżąco z wymogami MEN." },
            { icon: <Target className="w-8 h-8 text-primary" />, title: "Prosty cel", desc: "Krok po kroku do lepszych ocen." },
            { icon: <Brain className="w-8 h-8 text-violet-500" />, title: "Mądre powtórki", desc: "Utrwalanie zamiast wkuwania." },
            { icon: <HeartHandshake className="w-8 h-8 text-amber-500" />, title: "Spokojna nauka", desc: "Bez stresu i presji czasu." },
          ].map((item, i) => (
            <AnimatedWrapper key={i} direction="up" delay={i * 0.1} className="flex items-start gap-4">
              <div className="shrink-0">{item.icon}</div>
              <div>
                <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            </AnimatedWrapper>
          ))}
        </div>
      </section>

      {/* ── METHODOLOGY / HOW IT WORKS ── */}
      <section id="metoda" className="py-24 px-4 relative scroll-mt-20 overflow-hidden bg-muted/20">
        <BlobBackground variant="mixed" className="opacity-40" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary mb-2">
              Sprawdzona metoda
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Jak działa nauka?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              Zaprojektowaliśmy cykl lekcji tak, aby budował pewność siebie i gwarantował zrozumienie każdego tematu.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <AnimatedWrapper direction="up" delay={0.1}>
              <FeatureCard 
                icon={<PlayCircle className="w-6 h-6" />}
                title="1. Obejrzyj lekcję"
                description="Krótkie, angażujące materiały wideo wyjaśniające zjawiska fizyczne na prostych, życiowych przykładach."
                colorClass="bg-blue-500 text-white shadow-blue-500/20"
              />
            </AnimatedWrapper>
            
            <AnimatedWrapper direction="up" delay={0.2}>
              <FeatureCard 
                icon={<Brain className="w-6 h-6" />}
                title="2. Rozwiąż quiz"
                description="Błyskawiczny test utrwalający najważniejsze pojęcia i wzory natychmiast po obejrzeniu wideo."
                colorClass="bg-violet-500 text-white shadow-violet-500/20"
              />
            </AnimatedWrapper>
            
            <AnimatedWrapper direction="up" delay={0.3}>
              <FeatureCard 
                icon={<PencilRuler className="w-6 h-6" />}
                title="3. Zadanie na tablicy"
                description="Samodzielne rozwiązywanie zadań obliczeniowych na interaktywnej tablicy, zupełnie jak w zeszycie."
                colorClass="bg-amber-500 text-white shadow-amber-500/20"
              />
            </AnimatedWrapper>

            <AnimatedWrapper direction="up" delay={0.4} className="lg:col-start-2">
              <FeatureCard 
                icon={<Sparkles className="w-6 h-6" />}
                title="4. AI sprawdzi i podpowie"
                description="Sztuczna inteligencja analizuje rozwiązanie i udziela wskazówek, nie wyręczając ucznia z myślenia."
                colorClass="bg-primary text-white shadow-primary/20"
              />
            </AnimatedWrapper>

            <AnimatedWrapper direction="up" delay={0.5}>
              <FeatureCard 
                icon={<ArrowRight className="w-6 h-6" />}
                title="5. Następna lekcja"
                description="Gdy materiał jest opanowany, uczeń płynnie przechodzi do kolejnego zagadnienia."
                colorClass="bg-emerald-500 text-white shadow-emerald-500/20"
              />
            </AnimatedWrapper>
          </div>
        </div>
      </section>

      {/* ── COURSE MODULES ── */}
      <section className="py-24 px-4 border-y border-border bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Program nauczania</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Kompleksowy kurs podzielony na przystępne moduły. Każdy dział to krok do pełnego zrozumienia fizyki.
            </p>
          </div>

          <div className="grid gap-6">
            <AnimatedWrapper direction="left" delay={0.1}>
              <CourseModuleCard 
                title="Kinematyka"
                description="Ruch prostoliniowy, prędkość, przyspieszenie. Naucz się opisywać ruch otaczających Cię ciał bez gubienia się w gąszczu wzorów."
                lessonCount={12}
                progress={0}
                gradientClass="from-blue-500/30 to-cyan-500/30"
              />
            </AnimatedWrapper>

            <AnimatedWrapper direction="left" delay={0.2}>
              <CourseModuleCard 
                title="Dynamika"
                description="Zasady dynamiki Newtona, siły w przyrodzie, pęd. Dowiedz się, dlaczego ciała się poruszają i co sprawia, że się zatrzymują."
                lessonCount={15}
                progress={0}
                gradientClass="from-violet-500/30 to-fuchsia-500/30"
              />
            </AnimatedWrapper>

            <AnimatedWrapper direction="left" delay={0.3}>
              <CourseModuleCard 
                title="Praca, Moc, Energia"
                description="Zasada zachowania energii, energia kinetyczna i potencjalna. Zrozum zasady, które rządzą wszechświatem i codziennym życiem."
                lessonCount={10}
                progress={0}
                gradientClass="from-amber-500/30 to-orange-500/30"
              />
            </AnimatedWrapper>
          </div>
          
          <div className="mt-12 text-center">
            <Button size="lg" variant="outline" className="rounded-full font-bold h-14 px-8 border-2" onClick={handleBuy} disabled={isPending || primaryCourseId == null}>
              Zobacz pełny program po zalogowaniu
            </Button>
          </div>
        </div>
      </section>

      {/* ── AI EXPLAINER ── */}
      <section className="py-24 px-4 bg-primary/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold bg-primary/20 text-primary">
              <Sparkles className="w-4 h-4" /> Nowość na platformie
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Prywatny korepetytor dostępny 24/7</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Koniec z frustracją przy zadaniach domowych. Nasza sztuczna inteligencja na bieżąco analizuje tok myślenia ucznia i naprowadza go na właściwe tory.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6 pt-4">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-success mb-4" />
                <h4 className="font-bold mb-2">Uczy, nie wyręcza</h4>
                <p className="text-sm text-muted-foreground">Podaje wskazówki i tłumaczy błędy, zamiast dawać gotowy wynik.</p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <LineChart className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">Śledzi postępy</h4>
                <p className="text-sm text-muted-foreground">Analizuje, z czym uczeń ma problem i dostosowuje porady.</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <AnimatedWrapper direction="right">
              <div className="relative">
                {/* Main AI Board Mockup */}
                <div className="bg-background rounded-[2rem] border border-border shadow-2xl p-6 md:p-8 relative z-10">
                  <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <PencilRuler className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-bold">Zadanie 3.</span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground" aria-hidden="true">Zakończ</span>
                  </div>
                  
                  {/* Fake Whiteboard */}
                  <div className="aspect-[4/3] sm:aspect-video rounded-xl border-2 border-dashed border-border bg-muted/20 relative flex items-center justify-center font-display text-2xl font-medium p-6">
                    <div className="opacity-60 space-y-4 w-full">
                      <div className="flex justify-between items-center w-full">
                        <span>v = ?</span>
                        <span>s = 120 km</span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                        <span></span>
                        <span>t = 2 h</span>
                      </div>
                      <div className="h-px w-full bg-foreground/20 my-4" />
                      <div className="text-center text-primary">
                        v = s / t = 120 / 2 = 60 km/h
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Feedback Overlay */}
                <div className="absolute -bottom-8 md:-bottom-12 -left-4 md:-left-8 right-8 md:right-auto bg-card rounded-2xl border border-border shadow-xl p-6 z-20 md:max-w-md animate-in slide-in-from-bottom-10 duration-700">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-1">
                      <Sparkles className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" /> Co dobrze:
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">Świetnie użyty wzór na prędkość i prawidłowe podstawienie danych.</p>
                      </div>
                      <div className="h-px w-full bg-border" />
                      <div>
                        <h4 className="font-bold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-amber-500" /> Wskazówka:
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">Wynik jest poprawny! Pamiętaj, aby zawsze wyraźnie oddzielać dane od szukanych na początku zadania.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedWrapper>
          </div>
        </div>
      </section>

      {/* ── FOR PARENTS ── */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-5xl text-center space-y-16">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Spokój ducha dla rodzica</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nie musisz być ekspertem z fizyki, aby wspierać swoje dziecko. Nasza platforma zadba o jakość i systematyczność edukacji.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Bezpieczne płatności"
              value="100%"
              description="Szyfrowane transakcje przez operatora"
              icon={<ShieldCheck className="w-6 h-6" />}
              colorClass="bg-emerald-500/10 text-emerald-600"
            />
            <StatCard 
              title="Zgodność z MEN"
              value="Klasa 7"
              description="Aktualna podstawa programowa"
              icon={<BookOpen className="w-6 h-6" />}
              colorClass="bg-blue-500/10 text-blue-600"
            />
            <StatCard 
              title="Jasne postępy"
              value="Panel"
              description="Dostęp do statystyk i wyników"
              icon={<LineChart className="w-6 h-6" />}
              colorClass="bg-violet-500/10 text-violet-600"
            />
            <StatCard 
              title="Gwarancja dostępu"
              value="365"
              description="Dni nielimitowanego dostępu"
              icon={<Clock className="w-6 h-6" />}
              colorClass="bg-amber-500/10 text-amber-600"
            />
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 px-4 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-xl text-center">
          <AnimatedWrapper direction="up">
            <div className="bg-card rounded-[3rem] border border-border shadow-2xl p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-violet-500 to-cyan-500" />
              
              <div className="mb-8">
                <h2 className="text-3xl font-black mb-2">Pełny Dostęp</h2>
                <p className="text-muted-foreground">Wszystko, czego potrzebuje uczeń klasy 7.</p>
              </div>

              <div className="flex justify-center items-baseline gap-2 mb-8">
                {priceLabel ? (
                  <span className="text-5xl md:text-6xl font-black tracking-tight">
                    {priceLabel}
                  </span>
                ) : (
                  <LoadingSkeleton className="h-14 w-40" />
                )}
                <span className="text-xl text-muted-foreground font-medium">/ rok</span>
              </div>

              <ul className="space-y-4 mb-10 text-left max-w-sm mx-auto">
                {[
                  "Nielimitowany dostęp przez 365 dni",
                  "Wszystkie moduły i lekcje wideo",
                  "Interaktywne quizy sprawdzające",
                  "Zadania z asystentem AI",
                  "Dostęp na komputerze i tablecie",
                  "Brak ukrytych opłat",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    <span className="font-medium text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                size="lg" 
                onClick={handleBuy}
                disabled={isPending || primaryCourseId == null}
                className="w-full text-lg h-16 rounded-full font-bold shadow-xl shadow-primary/20 hover-lift"
              >
                {isPending ? "Przetwarzanie..." : "Kup dostęp i zacznij naukę"} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-sm text-muted-foreground mt-4">Płacisz tylko raz, dostęp jest na cały rok.</p>
            </div>
          </AnimatedWrapper>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Często zadawane pytania</h2>
            <p className="text-muted-foreground text-lg">Masz wątpliwości? Oto odpowiedzi na najpopularniejsze pytania.</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="bg-card border border-border rounded-2xl px-6">
                <AccordionTrigger className="text-left font-bold text-lg hover:text-primary hover:no-underline py-6">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="kontakt" className="scroll-mt-20 py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-black tracking-tight">Zostały pytania?</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Jesteśmy tu, aby pomóc. Napisz do nas, jeśli potrzebujesz wsparcia technicznego lub masz pytania dotyczące zawartości kursu.
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Send className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Szybki kontakt</p>
                    <p className="font-bold">Odpowiadamy w ciągu 24h</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 bg-background border-t border-border text-center">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-primary fill-primary" />
            <span className="font-black text-xl tracking-tight">FizykaAI</span>
          </div>
          <p className="text-muted-foreground mb-6">Innowacyjna edukacja dla klasy 7.</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-medium mb-8">
            <Link href="/polityka-prywatnosci" className="hover:text-primary transition-colors">Polityka prywatności</Link>
            <Link href="/regulamin" className="hover:text-primary transition-colors">Regulamin</Link>
            <Link href="/login" className="hover:text-primary transition-colors">Logowanie</Link>
            <Link href="/register" className="hover:text-primary transition-colors">Rejestracja</Link>
          </div>
          <p className="text-sm text-muted-foreground opacity-60">© {new Date().getFullYear()} FizykaAI. Wszystkie prawa zastrzeżone.</p>
        </div>
      </footer>
    </div>
  );
}
