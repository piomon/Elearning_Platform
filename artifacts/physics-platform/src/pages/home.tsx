import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListCourses,
  useGetCoursePrice,
  useGetLandingContent,
  useGetFaqContent,
  useSubmitContact,
  usePreviewLanding,
  type LandingSection,
} from "@workspace/api-client-react";
import { PreviewBanner } from "@/components/preview-banner";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { useAuth } from "@/hooks/use-auth";
import { usePurchase } from "@/hooks/use-purchase";
import { formatPln } from "@/lib/format";
import { usePromoCountdown, discountPercent } from "@/lib/promo";
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
  PencilRuler, Send, Star, LineChart,
  User, Mail, Tag, MessageSquare, MessageCircle, Flame
} from "lucide-react";

import { BlobBackground } from "@/components/blob-background";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { AnimatedWrapper } from "@/components/animated-wrapper";
import { HeroShowcase } from "@/components/hero-showcase";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { FeatureCard } from "@/components/feature-card";
import { CourseModuleCard } from "@/components/course-module-card";
import { SeoHead } from "@/components/seo-head";

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
      <div className="relative overflow-hidden bg-card rounded-[2rem] border border-border shadow-xl p-10 sm:p-12 text-center space-y-5 animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-primary/5 pointer-events-none" />
        <div className="relative w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto ring-8 ring-success/5">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h3 className="relative text-2xl sm:text-3xl font-black tracking-tight">Dziękujemy za wiadomość</h3>
        <p className="relative text-muted-foreground max-w-sm mx-auto leading-relaxed">Odezwiemy się na podany adres email tak szybko, jak to możliwe — zwykle w ciągu 24 godzin.</p>
        <Button variant="outline" size="lg" className="relative rounded-full h-12 px-6 font-semibold" onClick={() => setSent(false)}>
          Wyślij kolejną wiadomość
        </Button>
      </div>
    );
  }

  const fieldWrap = "relative";
  const iconCls = "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70 pointer-events-none transition-colors";
  const inputCls = "h-14 rounded-2xl bg-muted/40 border-border/70 pl-12 text-base focus-visible:bg-background transition-colors";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative overflow-hidden bg-card rounded-[2rem] border border-border shadow-xl p-6 sm:p-9 space-y-6">
      <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight leading-tight">Napisz do nas</h3>
          <p className="text-sm text-muted-foreground">Wypełnij formularz, a my się odezwiemy.</p>
        </div>
      </div>

      <div className="relative grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="font-semibold text-foreground/80 text-sm">Imię i nazwisko</Label>
          <div className={fieldWrap}>
            <User className={iconCls} />
            <Input id="contact-name" {...form.register("name")} className={inputCls} placeholder="Jan Kowalski" />
          </div>
          {form.formState.errors.name && (
            <p className="text-sm text-destructive font-medium">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="font-semibold text-foreground/80 text-sm">Adres email</Label>
          <div className={fieldWrap}>
            <Mail className={iconCls} />
            <Input id="contact-email" type="email" {...form.register("email")} className={inputCls} placeholder="jan@example.com" />
          </div>
          {form.formState.errors.email && (
            <p className="text-sm text-destructive font-medium">{form.formState.errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="relative space-y-2">
        <Label htmlFor="contact-subject" className="font-semibold text-foreground/80 text-sm">Temat</Label>
        <div className={fieldWrap}>
          <Tag className={iconCls} />
          <Input id="contact-subject" {...form.register("subject")} className={inputCls} placeholder="W czym możemy pomóc?" />
        </div>
        {form.formState.errors.subject && (
          <p className="text-sm text-destructive font-medium">{form.formState.errors.subject.message}</p>
        )}
      </div>

      <div className="relative space-y-2">
        <Label htmlFor="contact-message" className="font-semibold text-foreground/80 text-sm">Wiadomość</Label>
        <div className={fieldWrap}>
          <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-muted-foreground/70 pointer-events-none" />
          <Textarea id="contact-message" rows={5} {...form.register("message")} className="rounded-2xl bg-muted/40 border-border/70 pl-12 pt-3.5 text-base resize-none focus-visible:bg-background transition-colors" placeholder="Napisz do nas, a my odpowiemy najszybciej, jak to możliwe." />
        </div>
        {form.formState.errors.message && (
          <p className="text-sm text-destructive font-medium">{form.formState.errors.message.message}</p>
        )}
      </div>

      <div className="relative space-y-2">
        <div className="flex items-start gap-3 rounded-2xl bg-muted/30 border border-border/60 p-4">
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

      <Button type="submit" size="lg" className="relative w-full rounded-full h-16 text-base font-bold shadow-lg shadow-primary/25 hover-lift" disabled={mutation.isPending}>
        {mutation.isPending ? "Wysyłanie..." : "Wyślij wiadomość"}
        {!mutation.isPending && <Send className="w-5 h-5 ml-2" />}
      </Button>
    </form>
  );
}

function CountdownBox({ value, label }: { value: number | string; label: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
        {value}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Landing content: typed fallbacks (mirror the seeded copy) + helpers.
   The home page is data-driven from the landing CMS but always degrades to the
   copy below when a field/section is missing, so the page never renders empty.
   ────────────────────────────────────────────────────────────────────────── */

interface HeroContent {
  badges: string[];
  titleLine1: string;
  titleLine2: string;
  paragraph1: string;
  paragraph2: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ratingText: string;
}
interface BenefitsContent {
  items: { title: string; desc: string }[];
}
interface MethodologyContent {
  eyebrow: string;
  heading: string;
  subheading: string;
  steps: { title: string; description: string }[];
}
interface ModulesContent {
  heading: string;
  subheading: string;
  ctaText: string;
}
interface AiContent {
  eyebrow: string;
  heading: string;
  paragraph: string;
  card1Title: string;
  card1Desc: string;
  card2Title: string;
  card2Desc: string;
}
interface ParentsContent {
  heading: string;
  subheading: string;
}
interface PricingContent {
  heading: string;
  subheading: string;
  features: string[];
  note: string;
}
interface FaqContent {
  heading: string;
  subheading: string;
}
interface ContactContent {
  heading: string;
  paragraph: string;
  quickContactLabel: string;
  quickContactValue: string;
}

const HERO_FALLBACK: HeroContent = {
  badges: ["AI sprawdza zadania", "Quizy po każdej lekcji", "Interaktywna tablica"],
  titleLine1: "Fizyka w 7 klasie",
  titleLine2: "zrozumiała jak nigdy.",
  paragraph1:
    "Fizyka w 7 klasie to nowość i spore wyzwanie. Chcesz, żeby Twoje dziecko od razu polubiło ten przedmiot, zamiast stresować się na pierwszych lekcjach? Wybierzcie innowacyjny kurs na start!",
  paragraph2:
    "Zamieniliśmy nudny podręcznik w niezwykłą przygodę. Nowoczesna platforma edukacyjna, która uczy fizyki przez interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
  ctaPrimary: "Kup dostęp",
  ctaSecondary: "Zobacz jak działa",
  ratingText: "Zaufali nam rodzice i uczniowie",
};

const BENEFITS_FALLBACK: BenefitsContent = {
  items: [
    { title: "Program dla klasy 7", desc: "Materiały wspierają naukę fizyki w klasie 7." },
    { title: "Prosty cel", desc: "Krok po kroku do lepszych ocen." },
    { title: "Mądre powtórki", desc: "Utrwalanie zamiast wkuwania." },
    { title: "Spokojna nauka", desc: "Bez stresu i presji czasu." },
  ],
};

const METHODOLOGY_FALLBACK: MethodologyContent = {
  eyebrow: "Sprawdzona metoda",
  heading: "Jak działa nauka?",
  subheading:
    "Zaprojektowaliśmy cykl lekcji tak, aby budował pewność siebie i gwarantował zrozumienie każdego tematu.",
  steps: [
    { title: "1. Obejrzyj lekcję", description: "Krótkie, angażujące materiały wideo wyjaśniające zjawiska fizyczne na prostych, życiowych przykładach." },
    { title: "2. Rozwiąż quiz", description: "Błyskawiczny test utrwalający najważniejsze pojęcia i wzory natychmiast po obejrzeniu wideo." },
    { title: "3. Zadanie na tablicy", description: "Samodzielne rozwiązywanie zadań obliczeniowych na interaktywnej tablicy, zupełnie jak w zeszycie." },
    { title: "4. AI sprawdzi i podpowie", description: "Sztuczna inteligencja analizuje rozwiązanie i udziela wskazówek, nie wyręczając ucznia z myślenia." },
    { title: "5. Następna lekcja", description: "Gdy materiał jest opanowany, uczeń płynnie przechodzi do kolejnego zagadnienia." },
  ],
};

const MODULES_FALLBACK: ModulesContent = {
  heading: "Program nauczania",
  subheading:
    "Kompleksowy kurs podzielony na przystępne moduły. Każdy dział to krok do pełnego zrozumienia fizyki.",
  ctaText: "Zobacz pełny program po zalogowaniu",
};

const AI_FALLBACK: AiContent = {
  eyebrow: "Nowość na platformie",
  heading: "Prywatny korepetytor dostępny 24/7",
  paragraph:
    "Koniec z frustracją przy zadaniach domowych. Nasza sztuczna inteligencja na bieżąco analizuje tok myślenia ucznia i naprowadza go na właściwe tory.",
  card1Title: "Uczy, nie wyręcza",
  card1Desc: "Podaje wskazówki i tłumaczy błędy, zamiast dawać gotowy wynik.",
  card2Title: "Śledzi postępy",
  card2Desc: "Analizuje, z czym uczeń ma problem i dostosowuje porady.",
};

const PARENTS_FALLBACK: ParentsContent = {
  heading: "Spokój ducha dla rodzica",
  subheading:
    "Nie musisz być ekspertem z fizyki, aby wspierać swoje dziecko. Nasza platforma zadba o jakość i systematyczność edukacji.",
};

const PRICING_FALLBACK: PricingContent = {
  heading: "Pełny Dostęp",
  subheading: "Wszystko, czego potrzebuje uczeń klasy 7.",
  features: [
    "Pełny dostęp do kursu fizyki klasy 7",
    "Wszystkie moduły i lekcje wideo",
    "Interaktywne quizy sprawdzające",
    "Zadania z asystentem AI",
    "Dostęp na komputerze i tablecie",
    "Brak ukrytych opłat",
  ],
  note: "Płatność przez BLIK / Paynow. Po potwierdzeniu płatności dostęp zostanie odblokowany automatycznie.",
};

const FAQ_SECTION_FALLBACK: FaqContent = {
  heading: "Często zadawane pytania",
  subheading: "Masz wątpliwości? Oto odpowiedzi na najpopularniejsze pytania.",
};

const CONTACT_FALLBACK: ContactContent = {
  heading: "Zostały pytania?",
  paragraph:
    "Jesteśmy tu, aby pomóc. Napisz do nas, jeśli potrzebujesz wsparcia technicznego lub masz pytania dotyczące zawartości kursu.",
  quickContactLabel: "Szybki kontakt",
  quickContactValue: "Odpowiadamy w ciągu 24h",
};

const FAQ_ITEMS_FALLBACK = [
  {
    q: "Dla kogo jest ta platforma?",
    a: "Dla uczniów klasy 7 szkoły podstawowej oraz ich rodziców, którzy chcą spokojnie i skutecznie ogarnąć fizykę.",
  },
  {
    q: "Jak działa sprawdzanie zadań przez AI?",
    a: "Uczeń rozwiązuje zadanie na wirtualnej tablicy, a sztuczna inteligencja analizuje tok rozumowania i wskazuje, co jest poprawne, a nad czym warto jeszcze popracować.",
  },
  {
    q: "Jak uzyskuję dostęp po zakupie?",
    a: "Po potwierdzeniu płatności dostęp do wszystkich materiałów kursu odblokowuje się automatycznie — uczysz się we własnym tempie.",
  },
  {
    q: "Czy potrzebuję specjalnego sprzętu?",
    a: "Do wygodnej nauki rekomendujemy komputer lub tablet. Tablica i zadania działają najlepiej na większym ekranie.",
  },
];

const DEFAULT_SECTION_ORDER = [
  "hero", "benefits", "methodology", "modules", "ai", "parents", "pricing", "faq", "contact",
] as const;

/** Merge a section's stored content over the typed fallback (shallow). */
function pickContent<T extends object>(
  section: LandingSection | undefined,
  fallback: T,
): T {
  const c = section?.content;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    return { ...fallback, ...(c as Partial<T>) } as T;
  }
  return fallback;
}

const HERO_BADGE_STYLES = [
  { icon: Sparkles, cls: "text-primary border-primary/20" },
  { icon: Brain, cls: "text-violet-600 border-violet-500/20" },
  { icon: PencilRuler, cls: "text-amber-600 border-amber-500/20" },
];

const BENEFIT_STYLES = [
  { icon: ShieldCheck, cls: "text-emerald-500" },
  { icon: Target, cls: "text-primary" },
  { icon: Brain, cls: "text-violet-500" },
  { icon: HeartHandshake, cls: "text-amber-500" },
];

const STEP_STYLES = [
  { icon: PlayCircle, color: "bg-blue-500 text-white shadow-blue-500/20" },
  { icon: Brain, color: "bg-violet-500 text-white shadow-violet-500/20" },
  { icon: PencilRuler, color: "bg-amber-500 text-white shadow-amber-500/20" },
  { icon: Sparkles, color: "bg-primary text-white shadow-primary/20" },
  { icon: ArrowRight, color: "bg-emerald-500 text-white shadow-emerald-500/20" },
];

export default function Home() {
  const search = useSearch();
  const { user } = useAuth();
  const isPreview = new URLSearchParams(search).get("preview") === "1" && user?.role === "admin";

  const { data: courses } = useListCourses();
  const { data: pricePublic } = useGetCoursePrice({ query: { enabled: !isPreview } } as never);
  const { data: landingPublic } = useGetLandingContent({ query: { enabled: !isPreview } } as never);
  const { data: faqPublic } = useGetFaqContent({ query: { enabled: !isPreview } } as never);
  const { data: previewData } = usePreviewLanding({ query: { enabled: isPreview } } as never);

  const preview = (previewData ?? {}) as {
    sections?: LandingSection[];
    faq?: { question: string; answer: string }[];
    pricing?: typeof pricePublic;
  };
  const priceData = isPreview ? preview.pricing : pricePublic;
  const landingData = isPreview ? preview.sections : landingPublic;
  const faqData = isPreview ? preview.faq : faqPublic;

  const { startPurchase, isPending } = usePurchase();

  // Promo is driven by the pricing singleton (single source of truth). When no
  // explicit end date is set, the countdown falls back to the evergreen one.
  const promoActive = priceData?.promoEnabled !== false;
  const promoLabel = priceData?.promoLabel || "Promocja na start";
  const countdown = usePromoCountdown(priceData?.promoEndsAt);

  const primaryCourseId = courses && courses.length > 0 ? courses[0].id : null;
  const priceLabel = priceData ? formatPln(priceData.price, priceData.currency) : null;
  const hasOldPrice = !!(priceData && priceData.oldPrice && priceData.oldPrice > priceData.price);
  const oldPriceLabel =
    hasOldPrice && priceData
      ? formatPln(priceData.oldPrice!, priceData.currency)
      : null;
  const discount =
    hasOldPrice && priceData
      ? discountPercent(priceData.oldPrice!, priceData.price)
      : 0;

  const showOldPrice = promoActive && hasOldPrice;
  const showDiscount = promoActive && discount > 0;
  const showCountdown = promoActive && countdown.total > 0;
  const ctaText = priceData?.ctaText || "Kup dostęp i zacznij naukę";
  const promoEndsLabel = priceData?.promoEndsAt
    ? `Promocja kończy się: ${new Date(priceData.promoEndsAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`
    : "Promocja kończy się z końcem września";

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleBuy = () => {
    if (primaryCourseId == null) return;
    // Logged-out or already-purchased users are routed away by startPurchase
    // (to register / dashboard); only show the discount checkout to a logged-in
    // buyer who still needs access.
    if (!user || user.hasAccess) {
      void startPurchase(primaryCourseId);
      return;
    }
    setCheckoutOpen(true);
  };

  // Index landing sections by key + compute render order honoring sortOrder /
  // isEnabled. While loading (no data), render every section in the default
  // order so the page looks identical to the static version.
  const byKey = useMemo(
    () => new Map((landingData ?? []).map((s) => [s.key, s])),
    [landingData],
  );

  const ordered = useMemo(() => {
    const known = new Set<string>(DEFAULT_SECTION_ORDER);
    if (!landingData || landingData.length === 0) {
      return DEFAULT_SECTION_ORDER.map((key) => ({ key, isEnabled: true }));
    }
    const fromDb = landingData
      .filter((s) => known.has(s.key))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ key: s.key, isEnabled: s.isEnabled }));
    const present = new Set(fromDb.map((s) => s.key));
    const missing = DEFAULT_SECTION_ORDER.filter((k) => !present.has(k)).map(
      (key) => ({ key, isEnabled: true }),
    );
    return [...fromDb, ...missing];
  }, [landingData]);

  const hero = pickContent(byKey.get("hero"), HERO_FALLBACK);
  const benefits = pickContent(byKey.get("benefits"), BENEFITS_FALLBACK);
  const methodology = pickContent(byKey.get("methodology"), METHODOLOGY_FALLBACK);
  const modules = pickContent(byKey.get("modules"), MODULES_FALLBACK);
  const ai = pickContent(byKey.get("ai"), AI_FALLBACK);
  const parents = pickContent(byKey.get("parents"), PARENTS_FALLBACK);
  const pricing = pickContent(byKey.get("pricing"), PRICING_FALLBACK);
  const faqSection = pickContent(byKey.get("faq"), FAQ_SECTION_FALLBACK);
  const contact = pickContent(byKey.get("contact"), CONTACT_FALLBACK);

  const faqItems =
    faqData && faqData.length > 0
      ? faqData.map((f) => ({ q: f.question, a: f.answer }))
      : FAQ_ITEMS_FALLBACK;

  const renderers: Record<string, () => ReactNode> = {
    hero: () => (
      <section key="hero" className="relative min-h-[95vh] flex items-center pt-24 pb-16 md:pt-32 overflow-hidden">
        <BlobBackground variant="blue" className="opacity-80" />

        <div className="container mx-auto max-w-7xl px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">

            <AnimatedWrapper direction="right" delay={0.1}>
              <div className="space-y-8 text-center lg:text-left">
                <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  {hero.badges.map((badge, i) => {
                    const st = HERO_BADGE_STYLES[i % HERO_BADGE_STYLES.length];
                    const Icon = st.icon;
                    return (
                      <div key={i} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-background/80 backdrop-blur-md border shadow-sm ${st.cls}`}>
                        <Icon className="w-4 h-4" />
                        {badge}
                      </div>
                    );
                  })}
                </div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.1] text-foreground">
                  {hero.titleLine1} <br className="hidden sm:block"/>
                  <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyan-400">{hero.titleLine2}</span>
                </h1>

                <div className="space-y-4 max-w-2xl mx-auto lg:mx-0">
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {hero.paragraph1}
                  </p>
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {hero.paragraph2}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                  {user?.hasAccess ? (
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
                      {isPending ? "Przetwarzanie..." : hero.ctaPrimary} <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                  <a href="#metoda" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full text-lg h-16 px-10 font-bold rounded-full border-2 border-border/80 bg-background/50 backdrop-blur-md hover:bg-background/80 transition-all">
                      {hero.ctaSecondary}
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
                  <span>{hero.ratingText}</span>
                </div>
              </div>
            </AnimatedWrapper>

            <AnimatedWrapper direction="left" delay={0.3}>
              <HeroShowcase />
            </AnimatedWrapper>

          </div>
        </div>
      </section>
    ),

    benefits: () => (
      <section key="benefits" className="py-12 border-y border-border bg-card/50 backdrop-blur-sm relative z-20">
        <div className="container mx-auto max-w-6xl px-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.items.map((item, i) => {
            const st = BENEFIT_STYLES[i % BENEFIT_STYLES.length];
            const Icon = st.icon;
            return (
              <AnimatedWrapper key={i} direction="up" delay={i * 0.1} className="flex items-start gap-4">
                <div className="shrink-0"><Icon className={`w-8 h-8 ${st.cls}`} /></div>
                <div>
                  <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedWrapper>
            );
          })}
        </div>
      </section>
    ),

    methodology: () => (
      <section key="methodology" id="metoda" className="py-24 px-4 relative scroll-mt-20 overflow-hidden bg-muted/20">
        <BlobBackground variant="mixed" className="opacity-40" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold bg-primary/10 text-primary mb-2">
              {methodology.eyebrow}
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{methodology.heading}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
              {methodology.subheading}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {methodology.steps.map((step, i) => {
              const st = STEP_STYLES[i % STEP_STYLES.length];
              const Icon = st.icon;
              return (
                <AnimatedWrapper key={i} direction="up" delay={(i + 1) * 0.1} className={i === 3 ? "lg:col-start-2" : undefined}>
                  <FeatureCard
                    icon={<Icon className="w-6 h-6" />}
                    title={step.title}
                    description={step.description}
                    colorClass={st.color}
                  />
                </AnimatedWrapper>
              );
            })}
          </div>
        </div>
      </section>
    ),

    modules: () => (
      <section key="modules" className="py-24 px-4 border-y border-border bg-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{modules.heading}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {modules.subheading}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
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
          </div>

          <div className="mt-12 text-center">
            <Button size="lg" variant="outline" className="rounded-full font-bold h-14 px-8 border-2" onClick={handleBuy} disabled={isPending || primaryCourseId == null}>
              {modules.ctaText}
            </Button>
          </div>
        </div>
      </section>
    ),

    ai: () => (
      <section key="ai" className="py-24 px-4 bg-primary/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />

        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="space-y-8 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold bg-primary/20 text-primary">
              <Sparkles className="w-4 h-4" /> {ai.eyebrow}
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{ai.heading}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {ai.paragraph}
            </p>

            <div className="grid sm:grid-cols-2 gap-6 pt-4">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-success mb-4" />
                <h4 className="font-bold mb-2">{ai.card1Title}</h4>
                <p className="text-sm text-muted-foreground">{ai.card1Desc}</p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <LineChart className="w-8 h-8 text-primary mb-4" />
                <h4 className="font-bold mb-2">{ai.card2Title}</h4>
                <p className="text-sm text-muted-foreground">{ai.card2Desc}</p>
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
    ),

    parents: () => (
      <section key="parents" className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-5xl text-center space-y-16">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">{parents.heading}</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {parents.subheading}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Bezpieczne płatności"
              value="BLIK"
              description="Szybka płatność BLIK / Paynow"
              icon={<ShieldCheck className="w-6 h-6" />}
              colorClass="bg-emerald-500/10 text-emerald-600"
            />
            <StatCard
              title="Program dla klasy 7"
              value="Fizyka"
              description="Materiały do nauki w klasie 7"
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
              title="Cena miesięczna"
              value={priceLabel ?? "35 zł"}
              description="Bez ukrytych opłat"
              icon={<Tag className="w-6 h-6" />}
              colorClass="bg-amber-500/10 text-amber-600"
            />
          </div>
        </div>
      </section>
    ),

    pricing: () => (
      <section key="pricing" className="py-24 px-4 bg-muted/30 border-y border-border">
        <div className="container mx-auto max-w-xl text-center">
          <AnimatedWrapper direction="up">
            <div className="bg-card rounded-[3rem] border border-border shadow-2xl p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-violet-500 to-cyan-500" />

              <div className="mb-8">
                <h2 className="text-3xl font-black mb-2">{pricing.heading}</h2>
                <p className="text-muted-foreground">{pricing.subheading}</p>
              </div>

              <div className="flex flex-col items-center gap-3 mb-8">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {promoActive && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-bold">
                      {promoLabel}
                    </span>
                  )}
                  {showDiscount && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary via-violet-600 to-cyan-500 text-white px-4 py-1.5 text-sm font-black shadow-sm">
                      <Flame className="w-3.5 h-3.5" /> -{discount}%
                    </span>
                  )}
                </div>
                <div className="flex justify-center items-baseline gap-3">
                  {priceLabel ? (
                    <>
                      {showOldPrice && oldPriceLabel && (
                        <span className="text-2xl md:text-3xl font-bold text-muted-foreground/70 line-through decoration-2">
                          {oldPriceLabel}
                        </span>
                      )}
                      <span className="text-5xl md:text-6xl font-black tracking-tight">
                        {priceLabel}
                      </span>
                    </>
                  ) : (
                    <LoadingSkeleton className="h-14 w-40" />
                  )}
                  <span className="text-xl text-muted-foreground font-medium">/ mies.</span>
                </div>

                {showCountdown && (
                  <div className="mt-2 w-full max-w-sm rounded-2xl border border-border bg-muted/40 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {promoEndsLabel}
                    </p>
                    <div className="flex items-center justify-center gap-2 font-mono tabular-nums">
                      <CountdownBox value={countdown.days} label="dni" />
                      <span className="text-2xl font-black text-muted-foreground/50">:</span>
                      <CountdownBox value={String(countdown.hours).padStart(2, "0")} label="godz" />
                      <span className="text-2xl font-black text-muted-foreground/50">:</span>
                      <CountdownBox value={String(countdown.minutes).padStart(2, "0")} label="min" />
                      <span className="text-2xl font-black text-muted-foreground/50">:</span>
                      <CountdownBox value={String(countdown.seconds).padStart(2, "0")} label="sek" />
                    </div>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 text-left max-w-sm mx-auto">
                {pricing.features.map((feature, i) => (
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
                {isPending ? "Przetwarzanie..." : ctaText} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-sm text-muted-foreground mt-4">{pricing.note}</p>
            </div>
          </AnimatedWrapper>
        </div>
      </section>
    ),

    faq: () => (
      <section key="faq" className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">{faqSection.heading}</h2>
            <p className="text-muted-foreground text-lg">{faqSection.subheading}</p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqItems.map((faq, i) => (
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
    ),

    contact: () => (
      <section key="contact" id="kontakt" className="scroll-mt-20 py-24 px-4 bg-muted/30 border-t border-border">
        <div className="container mx-auto max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-black tracking-tight">{contact.heading}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {contact.paragraph}
              </p>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Send className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{contact.quickContactLabel}</p>
                    <p className="font-bold">{contact.quickContactValue}</p>
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
    ),
  };

  return (
    <div className={`flex flex-col w-full overflow-hidden ${user?.hasAccess ? "" : "pb-24 sm:pb-0"}`}>
      <SeoHead />
      {isPreview && <PreviewBanner label="Podgląd strony głównej jak u ucznia — uwzględnia ukryte sekcje." />}

      {ordered.map(({ key, isEnabled }) => {
        if (!isEnabled) return null;
        const render = renderers[key];
        return render ? render() : null;
      })}

      {/* ── MOBILE APP-STYLE STICKY CTA ── */}
      {!user?.hasAccess && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3">
            <div className="flex flex-col leading-tight">
              {priceLabel ? (
                <>
                  <span className="flex items-baseline gap-1.5">
                    {showOldPrice && oldPriceLabel && (
                      <span className="text-xs font-bold text-muted-foreground/70 line-through">{oldPriceLabel}</span>
                    )}
                    <span className="text-lg font-black tracking-tight">
                      {priceLabel}<span className="text-xs font-bold text-muted-foreground"> / mies.</span>
                    </span>
                    {showDiscount && (
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-primary via-violet-600 to-cyan-500 text-white px-1.5 py-0.5 text-[10px] font-black">
                        -{discount}%
                      </span>
                    )}
                  </span>
                  {showCountdown && (
                    <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                      Promo: {countdown.days}d {String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-base font-bold tracking-tight">fizyka7</span>
                  <span className="text-[11px] text-muted-foreground font-medium">Klasa 7</span>
                </>
              )}
            </div>
            <Button
              onClick={handleBuy}
              disabled={isPending || primaryCourseId == null}
              className="flex-1 h-12 rounded-full text-base font-bold shadow-lg shadow-primary/25"
            >
              {isPending ? "Przetwarzanie..." : "Kup dostęp"}
              {!isPending && <ArrowRight className="w-5 h-5 ml-1.5" />}
            </Button>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <footer className="py-12 bg-background border-t border-border text-center">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-primary fill-primary" />
            <span className="font-black text-xl tracking-tight">fizyka7</span>
          </div>
          <p className="text-muted-foreground mb-6">Innowacyjna edukacja dla klasy 7.</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground font-medium mb-8">
            <Link href="/polityka-prywatnosci" className="hover:text-primary transition-colors">Polityka prywatności</Link>
            <Link href="/regulamin" className="hover:text-primary transition-colors">Regulamin</Link>
            <Link href="/login" className="hover:text-primary transition-colors">Logowanie</Link>
            <Link href="/register" className="hover:text-primary transition-colors">Rejestracja</Link>
          </div>
          <p className="text-sm text-muted-foreground opacity-60">© {new Date().getFullYear()} fizyka7. Wszystkie prawa zastrzeżone.</p>
        </div>
      </footer>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        courseId={primaryCourseId}
        basePriceGrosz={priceData?.price ?? null}
        currency={priceData?.currency ?? "PLN"}
        isPending={isPending}
        onConfirm={(courseId, discountCode) => {
          void startPurchase(courseId, discountCode);
        }}
      />
    </div>
  );
}
