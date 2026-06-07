import { useRoute, useLocation, Link } from "wouter";
import { useGetCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react";

export default function CourseOverview() {
  const [match, params] = useRoute("/courses/:slug");
  const [, setLocation] = useLocation();

  const slug = params?.slug || "";
  
  const { data: course, isLoading, error } = useGetCourse(slug, {
    query: { enabled: !!slug } as any,
  });

  if (isLoading) {
    return <div className="p-8 text-center">Ładowanie...</div>;
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-4">Nie znaleziono kursu</h2>
        <Button variant="outline" onClick={() => setLocation("/dashboard")}>Wróć do kokpitu</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div>
        <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground" onClick={() => setLocation("/dashboard")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Wróć do kokpitu
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{course.title}</h1>
        <p className="text-lg text-muted-foreground mt-2">{course.description}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Działy</h2>
        
        <div className="space-y-4">
          {course.sections && course.sections.length > 0 ? (
            course.sections.map((section, idx) => (
              <Card 
                key={section.id} 
                className="group hover:border-primary/50 cursor-pointer transition-colors"
                onClick={() => setLocation(`/sections/${section.id}/topics`)}
              >
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-medium">{section.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {section.topicCount || 0} tematów
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-primary-foreground rounded-full transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">Ten kurs nie ma jeszcze żadnych działów.</p>
          )}
        </div>
      </div>
    </div>
  );
}
