import { useRoute, useLocation, Link } from "wouter";
import { useGetCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ArrowRight, BookOpen } from "lucide-react";

export default function CourseOverview() {
  const [match, params] = useRoute("/courses/:slug");
  const [, setLocation] = useLocation();

  const slug = params?.slug || "";
  
  const { data: course, isLoading, error } = useGetCourse(slug, {
    query: { enabled: !!slug } as any,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-full mb-8" />
        <div className="h-12 w-3/4 bg-muted animate-pulse rounded-xl" />
        <div className="h-6 w-full bg-muted animate-pulse rounded-lg" />
        <div className="space-y-4 mt-12">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-md">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-2xl font-bold font-display mb-2">Nie znaleziono kursu</h2>
        <p className="text-muted-foreground mb-8">Kurs, którego szukasz, mógł zostać usunięty lub nie masz do niego dostępu.</p>
        <Button size="lg" className="rounded-full px-8" onClick={() => setLocation("/dashboard")}>Wróć do kokpitu</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
      <div>
        <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground rounded-full" onClick={() => setLocation("/dashboard")}>
          <ChevronLeft className="w-5 h-5 mr-1" /> Wróć do kokpitu
        </Button>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground font-display mb-4">{course.title}</h1>
        <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">{course.description}</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold font-display">Działy w tym kursie</h2>
        </div>
        
        <div className="grid gap-4">
          {course.sections && course.sections.length > 0 ? (
            course.sections.map((section, idx) => (
              <Card 
                key={section.id} 
                className="group border-border hover:border-primary/50 cursor-pointer transition-all hover:shadow-md rounded-3xl overflow-hidden bg-card"
                onClick={() => setLocation(`/sections/${section.id}/topics`)}
              >
                <CardContent className="p-5 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-5 sm:gap-6">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-secondary group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center font-black text-xl transition-colors">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold group-hover:text-primary transition-colors">{section.title}</h3>
                      <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        {section.topicCount || 0} tematów w dziale
                      </p>
                    </div>
                  </div>
                  <div className="w-10 h-10 shrink-0 rounded-full bg-muted/50 group-hover:bg-primary text-muted-foreground group-hover:text-primary-foreground flex items-center justify-center transition-all group-hover:shadow-md hidden sm:flex">
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed">
              <p className="text-muted-foreground font-medium text-lg">Ten kurs nie ma jeszcze żadnych działów.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
