import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useListCourses,
  useGetContinueProgress,
  useGetMyProgress,
  useGetProgressSummary,
  useGetCourse,
  useGetCoursePrice,
} from "@workspace/api-client-react";
import type { Course, Progress } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { BuyAccessButton } from "@/components/buy-access-button";
import { formatPln } from "@/lib/format";
import { discountPercent } from "@/lib/promo";
import { PlayCircle, BookOpen, PenTool, LayoutDashboard, Target, ArrowRight, Flame } from "lucide-react";

function CourseCard({ course, progress }: { course: Course; progress: Progress[] }) {
  const [, setLocation] = useLocation();
  const { data: detail } = useGetCourse(course.slug, { query: { enabled: !!course.slug } as any });

  const totalTopics =
    detail?.sections?.reduce((sum, s) => sum + (s.topicCount || 0), 0) || 0;
  const completedTopics = progress.filter(
    (p) => p.courseId === course.id && p.taskCheckedByAi,
  ).length;
  const startedTopics = progress.filter((p) => p.courseId === course.id).length;
  const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const started = startedTopics > 0;

  return (
    <Card
      className="group rounded-3xl border-border hover:border-primary/50 transition-all hover:shadow-xl cursor-pointer overflow-hidden flex flex-col"
      onClick={() => setLocation(`/courses/${course.slug}`)}
    >
      <div className="h-32 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
        <div className="absolute bottom-4 left-6 w-12 h-12 rounded-2xl bg-background shadow-sm flex items-center justify-center text-primary transform group-hover:scale-110 transition-transform">
          <Target className="w-6 h-6" />
        </div>
      </div>
      <CardHeader className="pt-6">
        <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">{course.title}</CardTitle>
        <CardDescription className="line-clamp-2 mt-2">{course.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto pb-6">
        <div className="space-y-3 bg-muted/50 p-4 rounded-2xl">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-muted-foreground">Postęp</span>
            <span className="text-primary">
              {totalTopics > 0 ? `${completedTopics}/${totalTopics} tematów` : started ? "W trakcie" : "Rozpocznij"}
            </span>
          </div>
          <ProgressBar value={percentage} className="h-2.5 bg-background" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: courses, isLoading: coursesLoading } = useListCourses();
  const { data: continueProgress } = useGetContinueProgress();
  const { data: myProgress } = useGetMyProgress();
  const { data: summary } = useGetProgressSummary();
  const { data: price } = useGetCoursePrice();

  const hasAccess = user?.hasAccess ?? false;

  const promoActive = price?.promoEnabled !== false;
  const priceLabel = price ? formatPln(price.price, price.currency) : null;
  const hasOldPrice = !!(price && price.oldPrice && price.oldPrice > price.price);
  const oldPriceLabel =
    hasOldPrice && price ? formatPln(price.oldPrice!, price.currency) : null;
  const discount =
    hasOldPrice && price ? discountPercent(price.oldPrice!, price.price) : 0;
  const showOldPrice = promoActive && hasOldPrice;
  const showDiscount = promoActive && discount > 0;

  if (coursesLoading) {
    return (
      <div className="container mx-auto px-4 py-12 space-y-8 max-w-5xl">
        <div className="h-12 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Rozpoczęte tematy", value: summary?.startedTopics ?? 0 },
    { label: "Ukończone tematy", value: summary?.completedTopics ?? 0 },
    { label: "Ukończone quizy", value: summary?.quizzesCompleted ?? 0 },
    { label: "Sprawdzone zadania", value: summary?.tasksChecked ?? 0 },
  ];

  return (
    <div className="container mx-auto px-4 py-10 space-y-10 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-card p-8 rounded-3xl border shadow-sm">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground font-display">
            Cześć, <span className="text-primary">{user?.firstName}</span>!
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Gotowy na kolejną dawkę wiedzy?</p>
        </div>

        {continueProgress?.topicId && (
          <Button
            size="lg"
            className="text-base font-bold px-8 rounded-full shadow-lg h-14 w-full md:w-auto"
            onClick={() => setLocation(`/topics/${continueProgress.topicId}`)}
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Wróć do nauki
          </Button>
        )}
      </div>

      {!hasAccess ? (
        <Card className="border-dashed border-2 bg-muted/30 rounded-3xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center p-10 sm:p-16 text-center space-y-6">
            <div className="w-20 h-20 bg-background rounded-full shadow-sm flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-display">Odblokuj pełny kurs fizyki dla klasy 7</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-lg">
                Uzyskaj dostęp do wszystkich lekcji wideo, quizów, zadań i asystenta AI. Dostęp aktywuje się automatycznie zaraz po opłaceniu.
              </p>
            </div>

            {priceLabel && (
              <div className="flex flex-wrap items-baseline justify-center gap-2">
                {showOldPrice && oldPriceLabel && (
                  <span className="text-xl font-bold text-muted-foreground/70 line-through decoration-2">
                    {oldPriceLabel}
                  </span>
                )}
                <span className="text-4xl font-black tracking-tight">{priceLabel}</span>
                <span className="text-muted-foreground font-medium">/ mies.</span>
                {showDiscount && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary via-violet-600 to-cyan-500 text-white px-2.5 py-1 text-xs font-black">
                    <Flame className="w-3 h-3" /> -{discount}%
                  </span>
                )}
              </div>
            )}

            <BuyAccessButton label="Kup dostęp" className="mt-2 px-10 h-14 text-lg" />
            <p className="text-sm text-muted-foreground">
              Masz kod rabatowy? Wpiszesz go w podsumowaniu zakupu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {continueProgress?.topicId && (
            <Card className="rounded-3xl border-primary/20 bg-primary/5 overflow-hidden">
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <PlayCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary uppercase tracking-wider">Kontynuuj naukę</p>
                    <h3 className="text-xl font-bold mt-1">{continueProgress.topicTitle || "Ostatni temat"}</h3>
                    {continueProgress.sectionTitle && (
                      <p className="text-muted-foreground text-sm mt-0.5">{continueProgress.sectionTitle}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  className="rounded-full font-bold px-8 h-12 w-full sm:w-auto shrink-0"
                  onClick={() => setLocation(`/topics/${continueProgress.topicId}`)}
                >
                  Otwórz temat <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-card border rounded-2xl p-5 text-center shadow-sm">
                <p className="text-3xl font-black text-primary">{s.value}</p>
                <p className="text-sm font-medium text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold font-display">Twoje kursy</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses?.map((course) => (
                <CourseCard key={course.id} course={course} progress={myProgress || []} />
              ))}
            </div>
          </div>

          <Alert className="bg-primary/5 border-primary/20 rounded-2xl">
            <PenTool className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-bold">Wskazówka od nauczyciela</AlertTitle>
            <AlertDescription className="text-primary/80 mt-1">
              Do wygodnego rozwiązywania zadań zalecamy korzystanie z tabletu lub komputera z myszką. Łatwiej się rysuje i pisze równania!
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
