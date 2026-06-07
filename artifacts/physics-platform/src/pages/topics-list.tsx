import { useRoute, useLocation } from "wouter";
import { useListTopics, useGetMyProgress } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, PlayCircle, HelpCircle, PenTool, CheckCircle2, Circle } from "lucide-react";

export default function TopicsList() {
  const [match, params] = useRoute("/sections/:sectionId/topics");
  const [, setLocation] = useLocation();

  const sectionId = params?.sectionId ? parseInt(params.sectionId, 10) : 0;
  
  const { data: topics, isLoading } = useListTopics(sectionId, {
    query: { enabled: !!sectionId } as any,
  });

  const { data: progress } = useGetMyProgress();

  if (isLoading) {
    return <div className="p-8 text-center">Ładowanie...</div>;
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl font-bold">Brak tematów w tym dziale</h2>
        <Button variant="outline" onClick={() => setLocation("/dashboard")}>Wróć do kokpitu</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <Button variant="ghost" className="mb-2 -ml-4 text-muted-foreground" onClick={() => window.history.back()}>
        <ChevronLeft className="w-4 h-4 mr-1" /> Wróć
      </Button>
      
      <h1 className="text-3xl font-bold tracking-tight">Tematy w dziale</h1>

      <div className="space-y-4 mt-6">
        {topics.map((topic, idx) => {
          const topicProgress = progress?.find(p => p.topicId === topic.id);
          const isCompleted = topicProgress?.taskCheckedByAi;
          const isInProgress = topicProgress && !isCompleted;
          
          return (
            <Card 
              key={topic.id} 
              className={`hover:border-primary/50 cursor-pointer transition-all ${isCompleted ? 'bg-success/5 border-success/20' : ''}`}
              onClick={() => setLocation(`/topics/${topic.id}`)}
            >
              <CardContent className="p-4 sm:p-6 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-success" />
                    ) : isInProgress ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">
                      <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                      {topic.title}
                    </h3>
                    {topic.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{topic.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs font-medium text-muted-foreground">
                      <span className={`flex items-center gap-1 ${topicProgress?.videoCompleted ? 'text-success' : topic.hasVideo ? 'text-primary' : ''}`}>
                        <PlayCircle className="w-3.5 h-3.5" /> Wideo
                      </span>
                      <span className={`flex items-center gap-1 ${topicProgress?.quizCompleted ? 'text-success' : topic.hasQuiz ? 'text-primary' : ''}`}>
                        <HelpCircle className="w-3.5 h-3.5" /> Quiz
                      </span>
                      <span className={`flex items-center gap-1 ${topicProgress?.taskCheckedByAi ? 'text-success' : topic.hasTasks ? 'text-primary' : ''}`}>
                        <PenTool className="w-3.5 h-3.5" /> Zadanie
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant={isCompleted ? "outline" : "default"} className="w-full sm:w-auto shrink-0">
                  {isCompleted ? "Powtórz" : isInProgress ? "Kontynuuj" : "Rozpocznij"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
