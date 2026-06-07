import { useRoute, useLocation } from "wouter";
import { useListTopics, useGetMyProgress } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, PlayCircle, HelpCircle, PenTool, CheckCircle2, Circle, ArrowRight } from "lucide-react";

export default function TopicsList() {
  const [match, params] = useRoute("/sections/:sectionId/topics");
  const [, setLocation] = useLocation();

  const sectionId = params?.sectionId ? parseInt(params.sectionId, 10) : 0;
  
  const { data: topics, isLoading } = useListTopics(sectionId, {
    query: { enabled: !!sectionId } as any,
  });

  const { data: progress } = useGetMyProgress();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-full mb-8" />
        <div className="h-12 w-1/2 bg-muted animate-pulse rounded-xl mb-12" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-md">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <HelpCircle className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-2xl font-bold font-display mb-2">Brak tematów</h2>
        <p className="text-muted-foreground mb-8">Ten dział nie zawiera jeszcze żadnych tematów lekcyjnych.</p>
        <Button size="lg" className="rounded-full px-8" onClick={() => window.history.back()}>Wróć</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
      <Button variant="ghost" className="mb-2 -ml-4 text-muted-foreground hover:text-foreground rounded-full" onClick={() => window.history.back()}>
        <ChevronLeft className="w-5 h-5 mr-1" /> Wróć do działów
      </Button>
      
      <div className="space-y-2 mb-10">
        <span className="text-primary font-bold tracking-wider uppercase text-sm">Wybierz temat</span>
        <h1 className="text-4xl font-black tracking-tight font-display">Tematy w tym dziale</h1>
      </div>

      <div className="space-y-4 relative">
        {/* Connection line for visual flow */}
        <div className="absolute left-[28px] sm:left-[36px] top-[40px] bottom-[40px] w-0.5 bg-border -z-10" />

        {topics.map((topic, idx) => {
          const topicProgress = progress?.find(p => p.topicId === topic.id);
          const isCompleted = topicProgress?.taskCheckedByAi;
          const isInProgress = topicProgress && !isCompleted;
          
          return (
            <Card 
              key={topic.id} 
              className={`group hover:border-primary/50 cursor-pointer transition-all hover:shadow-md rounded-3xl overflow-hidden z-10 
                ${isCompleted ? 'bg-success/5 border-success/20' : 'bg-card'}`}
              onClick={() => setLocation(`/topics/${topic.id}`)}
            >
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 relative">
                
                {/* Progress Icon Indicator */}
                <div className="flex items-center justify-center shrink-0 bg-card rounded-full p-1 relative z-10 sm:self-center self-start">
                  {isCompleted ? (
                    <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center shadow-inner">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                  ) : isInProgress ? (
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                      <div className="w-6 h-6 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary text-muted-foreground flex items-center justify-center font-bold text-lg border-2 border-border shadow-inner">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-2 sm:pb-0">
                  <h3 className="text-lg sm:text-xl font-bold group-hover:text-primary transition-colors leading-tight">
                    {topic.title}
                  </h3>
                  {topic.description && (
                    <p className="text-muted-foreground text-sm mt-1.5 line-clamp-1">{topic.description}</p>
                  )}
                  
                  {/* Step indicators */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${topicProgress?.videoCompleted ? 'bg-success/15 text-success' : topic.hasVideo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <PlayCircle className="w-3.5 h-3.5" /> Wideo
                    </span>
                    <span className="text-border hidden sm:block">-</span>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${topicProgress?.quizCompleted ? 'bg-success/15 text-success' : topic.hasQuiz ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <HelpCircle className="w-3.5 h-3.5" /> Quiz
                    </span>
                    <span className="text-border hidden sm:block">-</span>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${topicProgress?.taskCheckedByAi ? 'bg-success/15 text-success' : topic.hasTasks ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <PenTool className="w-3.5 h-3.5" /> Zadanie
                    </span>
                  </div>
                </div>

                <Button 
                  variant={isCompleted ? "outline" : "default"} 
                  className={`w-full sm:w-auto shrink-0 rounded-full font-bold px-6 h-12 ${isCompleted ? 'border-success/30 text-success hover:bg-success/10 hover:text-success' : ''}`}
                >
                  {isCompleted ? "Powtórz" : isInProgress ? "Kontynuuj" : "Rozpocznij"}
                  {!isCompleted && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
