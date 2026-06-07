import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useGetTopic, 
  useGetMyProgress, 
  useUpsertProgress, 
  useSubmitQuizAttempt,
  useCheckTask
} from "@workspace/api-client-react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronLeft, CheckCircle2, ChevronRight, PenTool, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TopicDetail() {
  const [match, params] = useRoute("/topics/:topicId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const topicId = params?.topicId ? parseInt(params.topicId, 10) : 0;
  
  const [step, setStep] = useState<"video" | "quiz" | "task">("video");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  
  // Excalidraw
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  
  const { data: topic, isLoading } = useGetTopic(topicId, {
    query: { enabled: !!topicId } as any,
  });

  const { data: allProgress, refetch: refetchProgress } = useGetMyProgress();
  const progressMutation = useUpsertProgress();
  const submitQuizMutation = useSubmitQuizAttempt();
  const checkTaskMutation = useCheckTask();

  const currentProgress = allProgress?.find(p => p.topicId === topicId);

  // Initialize step based on progress
  useEffect(() => {
    if (currentProgress) {
      if (currentProgress.currentElementType === "task" || (currentProgress.videoCompleted && currentProgress.quizCompleted)) {
        setStep("task");
      } else if (currentProgress.currentElementType === "quiz" || currentProgress.videoCompleted) {
        setStep("quiz");
      } else {
        setStep("video");
      }
    }
  }, [currentProgress]);

  if (isLoading || !topic) {
    return <div className="p-8 text-center">Ładowanie tematu...</div>;
  }

  const handleVideoComplete = () => {
    progressMutation.mutate({
      data: {
        courseId: 1, // We'd ideally get this from the topic
        topicId: topic.id,
        currentElementType: "quiz",
        videoCompleted: true
      }
    }, {
      onSuccess: () => {
        refetchProgress();
        setStep("quiz");
      }
    });
  };

  const handleQuizSubmit = () => {
    if (!topic.quiz) return;
    
    // Convert answers
    const answers = Object.entries(selectedAnswers).map(([questionId, answerId]) => ({
      questionId: parseInt(questionId, 10),
      selectedAnswerId: answerId
    }));

    submitQuizMutation.mutate({
      quizId: topic.quiz.id,
      data: { answers }
    }, {
      onSuccess: (result) => {
        setQuizResult(result);
        if (result.percentage >= 50) { // arbitrary pass threshold
          progressMutation.mutate({
            data: {
              courseId: 1,
              topicId: topic.id,
              currentElementType: "task",
              quizCompleted: true
            }
          });
        }
      }
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          // Remove the data URI prefix (e.g., "data:image/png;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleCheckTask = async () => {
    if (!excalidrawAPI || !topic.tasks || topic.tasks.length === 0) return;
    
    try {
      const elements = excalidrawAPI.getSceneElements();
      if (!elements || elements.length === 0) {
        toast({ title: "Błąd", description: "Tablica jest pusta. Rozwiąż zadanie przed sprawdzeniem.", variant: "destructive" });
        return;
      }

      const blob = await exportToBlob({
        elements,
        mimeType: "image/png",
        appState: { exportBackground: true },
        files: excalidrawAPI.getFiles()
      });

      const base64 = await blobToBase64(blob);

      checkTaskMutation.mutate({
        data: {
          taskId: topic.tasks[0].id,
          imageBase64: base64
        }
      }, {
        onSuccess: (result) => {
          setAiFeedback(result.feedback);
          progressMutation.mutate({
            data: {
              courseId: 1,
              topicId: topic.id,
              currentElementType: "task",
              taskCheckedByAi: true
            }
          });
        },
        onError: () => {
          toast({ title: "Błąd", description: "Wystąpił problem podczas sprawdzania zadania.", variant: "destructive" });
        }
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Błąd", description: "Nie udało się pobrać obrazu z tablicy.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium mb-6">
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => window.history.back()}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Wróć
        </Button>
        <span>•</span>
        <button className={`hover:text-primary ${step === "video" ? "text-primary font-bold" : ""}`} onClick={() => setStep("video")}>1. Zrozum (Wideo)</button>
        <span>•</span>
        <button className={`hover:text-primary ${step === "quiz" ? "text-primary font-bold" : ""}`} onClick={() => setStep("quiz")}>2. Utrwal (Quiz)</button>
        <span>•</span>
        <button className={`hover:text-primary ${step === "task" ? "text-primary font-bold" : ""}`} onClick={() => setStep("task")}>3. Zastosuj (Zadanie)</button>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-8">{topic.title}</h1>

      {step === "video" && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>Obejrzyj materiał</CardTitle>
            <CardDescription>Skup się i postaraj zrozumieć koncepcję. Zawsze możesz tu wrócić.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {topic.video ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                {topic.video.bunnyVideoId ? (
                  <iframe 
                    src={`https://iframe.mediadelivery.net/embed/${topic.video.bunnyVideoId}`} 
                    allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" 
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : topic.video.videoUrl ? (
                  <iframe 
                    src={topic.video.videoUrl} 
                    allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" 
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/50">
                    Brak wideo do wyświetlenia
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
                <span className="text-muted-foreground font-medium">Ten temat nie ma przypisanego wideo.</span>
              </div>
            )}
            
            <div className="flex justify-end">
              <Button size="lg" className="w-full sm:w-auto" onClick={handleVideoComplete}>
                {currentProgress?.videoCompleted ? "Obejrzane, przejdź dalej" : "Oznacz film jako obejrzany"} <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "quiz" && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{topic.quiz ? topic.quiz.title : "Quiz sprawdzający"}</CardTitle>
            <CardDescription>Sprawdźmy, co zapamiętałeś z materiału wideo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {!topic.quiz ? (
              <div className="p-8 text-center bg-muted/50 rounded-lg">
                Brak quizu dla tego tematu.
              </div>
            ) : (
              <div className="space-y-8">
                {topic.quiz.questions.map((q, idx) => {
                  const resultForQ = quizResult?.answers.find((a: any) => a.questionId === q.id);
                  const isCorrect = resultForQ?.isCorrect;
                  const showFeedback = quizResult !== null;

                  return (
                    <div key={q.id} className="space-y-4">
                      <h3 className="font-medium text-lg">{idx + 1}. {q.questionText}</h3>
                      <div className="grid gap-3">
                        {q.answers.map(a => {
                          const isSelected = selectedAnswers[q.id] === a.id;
                          const isActuallyCorrect = showFeedback && resultForQ?.correctAnswerId === a.id;
                          
                          let btnClass = "justify-start h-auto py-3 px-4 border-2 font-normal";
                          if (showFeedback) {
                            if (isActuallyCorrect) {
                              btnClass += " border-success bg-success/10 text-success-foreground";
                            } else if (isSelected && !isCorrect) {
                              btnClass += " border-destructive bg-destructive/10 text-destructive-foreground";
                            } else {
                              btnClass += " opacity-50";
                            }
                          } else {
                            if (isSelected) {
                              btnClass += " border-primary bg-primary/5";
                            } else {
                              btnClass += " border-muted bg-transparent hover:bg-muted";
                            }
                          }

                          return (
                            <Button
                              key={a.id}
                              variant="outline"
                              className={btnClass}
                              onClick={() => !showFeedback && setSelectedAnswers(prev => ({ ...prev, [q.id]: a.id }))}
                              disabled={showFeedback}
                            >
                              <span className="w-8 shrink-0 font-bold">{a.answerLabel}.</span>
                              <span className="text-left whitespace-normal">{a.answerText}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {quizResult && (
                  <Alert className={quizResult.percentage >= 50 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}>
                    <AlertTitle className="font-bold flex items-center gap-2">
                      {quizResult.percentage >= 50 ? <CheckCircle2 className="w-5 h-5 text-success" /> : null}
                      Twój wynik: {quizResult.score} / {quizResult.totalQuestions} ({Math.round(quizResult.percentage)}%)
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      {quizResult.percentage >= 50 
                        ? "Świetnie! Znasz już podstawy. Przejdźmy do zadania." 
                        : "Spróbuj jeszcze raz. Warto wrócić do wideo, by przypomnieć sobie materiał."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep("video")}><ChevronLeft className="mr-2 w-4 h-4" /> Wideo</Button>
              {!quizResult ? (
                <Button 
                  size="lg" 
                  onClick={handleQuizSubmit}
                  disabled={submitQuizMutation.isPending || !topic.quiz || Object.keys(selectedAnswers).length < topic.quiz.questions.length}
                >
                  {submitQuizMutation.isPending ? "Sprawdzanie..." : "Sprawdź odpowiedzi"}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setQuizResult(null); setSelectedAnswers({}); }}>
                    <RefreshCw className="mr-2 w-4 h-4" /> Rozwiąż ponownie
                  </Button>
                  {quizResult.percentage >= 50 && (
                    <Button size="lg" onClick={() => setStep("task")}>
                      Przejdź do zadania <ChevronRight className="ml-2 w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "task" && (
        <Card className="border-primary/20 shadow-md overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>{topic.tasks?.[0]?.title || "Zadanie otwarte"}</CardTitle>
            <CardDescription className="text-base text-foreground mt-2">
              {topic.tasks?.[0]?.description || "Rozwiąż zadanie na poniższej tablicy."}
            </CardDescription>
            <Alert className="mt-4 bg-primary/5 border-primary/20">
              <PenTool className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs">
                <span className="hidden sm:inline">Narysuj rozwiązanie korzystając z narzędzi na tablicy.</span>
                <span className="sm:hidden text-primary font-medium">Do wygodnego rozwiązywania zadań zalecamy tablet lub komputer.</span>
              </AlertDescription>
            </Alert>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] w-full relative">
              <Excalidraw 
                excalidrawAPI={(api) => setExcalidrawAPI(api)} 
                langCode="pl-PL"
                viewModeEnabled={checkTaskMutation.isPending}
              />
            </div>
            
            <div className="p-6 bg-card border-t">
              {aiFeedback && (
                <div className="mb-6 p-6 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <span className="text-xl">🤖</span> Wynik sprawdzenia przez AI
                  </div>
                  <div className="prose prose-sm max-w-none text-foreground">
                    {aiFeedback.split('\n').map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-4 uppercase tracking-wider">AI pomaga w nauce, ale może się pomylić.</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep("quiz")}><ChevronLeft className="mr-2 w-4 h-4" /> Quiz</Button>
                <Button 
                  size="lg" 
                  onClick={handleCheckTask}
                  disabled={checkTaskMutation.isPending}
                  className="px-8 font-bold"
                >
                  {checkTaskMutation.isPending ? "Analizowanie przez AI..." : "Sprawdź zadanie z AI ✨"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
