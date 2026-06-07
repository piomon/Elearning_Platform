import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useListCourses, useGetContinueProgress, useGetMyProgress } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, BookOpen, PenTool, LayoutDashboard } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: courses, isLoading: coursesLoading } = useListCourses();
  const { data: continueProgress } = useGetContinueProgress();
  const { data: myProgress } = useGetMyProgress();

  if (coursesLoading) {
    return <div className="p-8 text-center">Ładowanie...</div>;
  }

  const hasAccess = courses && courses.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cześć, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground mt-1">Gotowy na fizykę?</p>
        </div>
        
        {continueProgress?.topicId && (
          <Button 
            size="lg" 
            className="text-lg px-8 shadow-md"
            onClick={() => setLocation(`/topics/${continueProgress.topicId}`)}
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            Kontynuuj naukę
          </Button>
        )}
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <PenTool className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-medium">Wskazówka od nauczyciela</AlertTitle>
        <AlertDescription className="text-primary/80">
          Do wygodnego rozwiązywania zadań zalecamy korzystanie z tabletu lub komputera z myszką.
        </AlertDescription>
      </Alert>

      {!hasAccess ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">Nie masz jeszcze dostępu do kursów</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Aby rozpocząć naukę, poproś rodzica o zakup dostępu do platformy lub skontaktuj się z administratorem.
            </p>
            <Button className="mt-4" onClick={() => setLocation("/")}>Wróć na stronę główną</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" /> Twoje kursy
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => {
              // Calculate progress for this course
              const courseProgress = myProgress?.filter(p => p.courseId === course.id) || [];
              const completedTopics = courseProgress.filter(p => p.taskCheckedByAi).length; // simplistic definition of completion
              // We'd ideally know total topics, but we can just show a relative count or list it out
              
              return (
                <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer border-border hover:border-primary/50" onClick={() => setLocation(`/courses/${course.slug}`)}>
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Postęp</span>
                        <span className="text-primary">{courseProgress.length > 0 ? "W trakcie" : "Rozpocznij"}</span>
                      </div>
                      <Progress value={courseProgress.length > 0 ? 30 : 0} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
