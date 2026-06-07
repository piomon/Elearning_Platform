import { useListAdminCourses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Edit, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminCourses() {
  const { data, isLoading } = useListAdminCourses();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Zarządzanie Kursami</h1>
            <p className="text-muted-foreground mt-1">Struktura i treść materiałów</p>
          </div>
        </div>
        <Button className="rounded-full shadow-md font-bold px-6">
          Dodaj nowy kurs
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {data?.map(course => (
            <Card key={course.id} className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
              <CardContent className="p-0">
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold font-display">{course.title}</h3>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                        ${course.isPublished ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {course.isPublished ? 'Opublikowany' : 'Szkic'}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed max-w-3xl">{course.description}</p>
                    <div className="flex gap-4 mt-6 text-sm font-medium text-muted-foreground">
                      <span>Slug: <span className="bg-muted px-2 py-0.5 rounded ml-1">{course.slug}</span></span>
                    </div>
                  </div>
                  
                  <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                    <Button variant="outline" className="flex-1 sm:flex-none rounded-xl border-border/60 justify-start">
                      <Edit className="w-4 h-4 mr-2" /> Edytuj
                    </Button>
                    <Button variant="outline" className="flex-1 sm:flex-none rounded-xl border-border/60 justify-start">
                      <Settings className="w-4 h-4 mr-2" /> Działy i Tematy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.length === 0 && (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/60">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-bold mb-2">Brak kursów</p>
              <p className="text-muted-foreground">Kliknij "Dodaj nowy kurs" aby rozpocząć.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
