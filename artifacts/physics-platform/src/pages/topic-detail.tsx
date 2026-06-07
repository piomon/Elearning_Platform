import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronLeft, CheckCircle2, ChevronRight, PenTool, RefreshCw, PlayCircle, HelpCircle, AlertCircle, Bot } from "lucide-react";
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
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
        <div className="h-8 w-32 bg-muted animate-pulse rounded-full mb-8" />
        <div className="h-12 w-3/4 bg-muted animate-pulse rounded-xl mb-12" />
        <div className="flex gap-4 mb-8">
          {[1,2,3].map(i => <div key={i} className="h-12 flex-1 bg-muted animate-pulse rounded-full" />)}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-3xl" />
      </div>
    );
  }

  const handleVideoComplete = () => {
    progressMutation.mutate({
      data: {
        courseId: 1, // We'd ideally get this from the topic, mocked for now
        topicId: topic.id,
        currentElementType: "quiz",
        videoCompleted: true
      }
    }, {
      onSuccess: () => {
        refetchProgress();
        setStep("quiz");
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
        if (result.percentage >= 50) { 
          progressMutation.mutate({
            data: {
              courseId: 1,
              topicId: topic.id,
              currentElementType: "task",
              quizCompleted: true
            }
          }, {
            onSuccess: () => refetchProgress()
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
        toast({ title: "Pusta tablica", description: "Zanim sprawdzisz zadanie, narysuj rozwiązanie na tablicy.", variant: "destructive" });
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
          }, {
            onSuccess: () => refetchProgress()
          });
        },
        onError: () => {
          toast({ title: "Wystąpił błąd", description: "Nie udało się sprawdzić zadania. Spróbuj ponownie za chwilę.", variant: "destructive" });
        }
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Wystąpił błąd", description: "Nie udało się pobrać obrazu z tablicy.", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <div>
        <Button variant="ghost" className="mb-4 -ml-4 text-muted-foreground rounded-full hover:text-foreground" onClick={() => window.history.back()}>
          <ChevronLeft className="w-5 h-5 mr-1" /> Wróć do tematów
        </Button>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-display mb-2">{topic.title}</h1>
      </div>

      {/* Stepper Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 bg-card p-2 rounded-2xl border shadow-sm">
        {[
          { id: "video", label: "Wideo", desc: "Zrozum zjawisko", icon: <PlayCircle className="w-5 h-5" />, isCompleted: currentProgress?.videoCompleted },
          { id: "quiz", label: "Quiz", desc: "Utrwal pojęcia", icon: <HelpCircle className="w-5 h-5" />, isCompleted: currentProgress?.quizCompleted },
          { id: "task", label: "Zadanie", desc: "Zastosuj wiedzę", icon: <PenTool className="w-5 h-5" />, isCompleted: currentProgress?.taskCheckedByAi }
        ].map((s, i, arr) => {
          const isActive = step === s.id;
          const isAvailable = i === 0 || arr[i-1].isCompleted;
          
          return (
            <button
              key={s.id}
              disabled={!isAvailable && !isActive}
              onClick={() => setStep(s.id as any)}
              className={`flex-1 flex items-center gap-3 p-3 rounded-xl transition-all text-left
                ${isActive 
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background" 
                  : isAvailable 
                    ? "hover:bg-muted text-foreground" 
                    : "opacity-50 cursor-not-allowed text-muted-foreground"
                }
              `}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-primary-foreground/20' : s.isCompleted ? 'bg-success/20 text-success' : 'bg-muted'}`}>
                {s.isCompleted && !isActive ? <CheckCircle2 className="w-5 h-5" /> : s.icon}
              </div>
              <div>
                <div className="font-bold text-sm">{s.label}</div>
                <div className={`text-xs ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {step === "video" && (
          <Card className="border-border shadow-lg rounded-3xl overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Obejrzyj materiał</CardTitle>
                  <CardDescription className="text-base mt-1">Skup się i postaraj zrozumieć koncepcję. Zawsze możesz tu wrócić.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {topic.video ? (
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative shadow-inner ring-1 ring-border/50">
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
                    <div className="absolute inset-0 flex items-center justify-center text-white/50 font-medium">
                      Wideo jest niedostępne.
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed">
                  <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <span className="text-muted-foreground font-medium">Ten temat nie ma przypisanego wideo.</span>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full font-bold text-base" onClick={handleVideoComplete}>
                  {currentProgress?.videoCompleted ? "Obejrzane, przejdź do quizu" : "Zrozumiałem, przejdź do quizu"} <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "quiz" && (
          <Card className="border-border shadow-lg rounded-3xl overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{topic.quiz ? topic.quiz.title : "Quiz sprawdzający"}</CardTitle>
                  <CardDescription className="text-base mt-1">Sprawdźmy, co zapamiętałeś z materiału wideo.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {!topic.quiz ? (
                <div className="p-12 text-center bg-muted/30 rounded-2xl border-2 border-dashed">
                  <p className="text-lg text-muted-foreground font-medium">Brak quizu dla tego tematu.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {topic.quiz.questions.map((q, idx) => {
                    const resultForQ = quizResult?.answers.find((a: any) => a.questionId === q.id);
                    const isCorrect = resultForQ?.isCorrect;
                    const showFeedback = quizResult !== null;

                    return (
                      <div key={q.id} className="space-y-4">
                        <h3 className="font-bold text-xl flex gap-3">
                          <span className="text-primary">{idx + 1}.</span> 
                          <span>{q.questionText}</span>
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-3 pl-0 sm:pl-7">
                          {q.answers.map(a => {
                            const isSelected = selectedAnswers[q.id] === a.id;
                            const isActuallyCorrect = showFeedback && resultForQ?.correctAnswerId === a.id;
                            
                            let btnClass = "justify-start h-auto py-4 px-5 rounded-2xl border-2 transition-all font-medium text-left items-start";
                            if (showFeedback) {
                              if (isActuallyCorrect) {
                                btnClass += " border-success bg-success/10 text-foreground";
                              } else if (isSelected && !isCorrect) {
                                btnClass += " border-destructive bg-destructive/10 text-foreground";
                              } else {
                                btnClass += " opacity-40 border-muted bg-transparent";
                              }
                            } else {
                              if (isSelected) {
                                btnClass += " border-primary bg-primary/5 text-primary shadow-sm";
                              } else {
                                btnClass += " border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground";
                              }
                            }

                            return (
                              <button
                                key={a.id}
                                className={btnClass}
                                onClick={() => !showFeedback && setSelectedAnswers(prev => ({ ...prev, [q.id]: a.id }))}
                                disabled={showFeedback}
                              >
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-3 text-sm font-bold
                                  ${showFeedback && isActuallyCorrect ? 'bg-success text-success-foreground' : 
                                    showFeedback && isSelected && !isCorrect ? 'bg-destructive text-destructive-foreground' :
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                >
                                  {a.answerLabel}
                                </span>
                                <span className="pt-1">{a.answerText}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {quizResult && (
                    <Alert className={`rounded-2xl border-2 ${quizResult.percentage >= 50 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${quizResult.percentage >= 50 ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                          {quizResult.percentage >= 50 ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        </div>
                        <div>
                          <AlertTitle className="text-xl font-bold mb-1">
                            Twój wynik: {quizResult.score} / {quizResult.totalQuestions} ({Math.round(quizResult.percentage)}%)
                          </AlertTitle>
                          <AlertDescription className="text-base text-foreground/80">
                            {quizResult.percentage >= 50 
                              ? "Świetnie Ci poszło! Znasz już podstawy teoretyczne. Możesz przejść do rozwiązywania zadania." 
                              : "Ups, to nie był najlepszy wynik. Zanim przejdziesz dalej, warto obejrzeć wideo jeszcze raz."}
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t gap-4">
                    <Button variant="ghost" onClick={() => setStep("video")} className="rounded-full w-full sm:w-auto text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="mr-2 w-4 h-4" /> Powrót do wideo
                    </Button>
                    {!quizResult ? (
                      <Button 
                        size="lg" 
                        className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-bold shadow-md"
                        onClick={handleQuizSubmit}
                        disabled={submitQuizMutation.isPending || !topic.quiz || Object.keys(selectedAnswers).length < topic.quiz.questions.length}
                      >
                        {submitQuizMutation.isPending ? "Sprawdzanie..." : "Sprawdź moje odpowiedzi"}
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button variant="outline" className="rounded-full h-14 px-6" onClick={() => { setQuizResult(null); setSelectedAnswers({}); }}>
                          <RefreshCw className="mr-2 w-4 h-4" /> Rozwiąż ponownie
                        </Button>
                        {quizResult.percentage >= 50 && (
                          <Button size="lg" className="rounded-full h-14 px-8 font-bold shadow-md" onClick={() => setStep("task")}>
                            Przejdź do zadania <ChevronRight className="ml-2 w-5 h-5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "task" && (
          <Card className="border-border shadow-lg rounded-3xl overflow-hidden flex flex-col bg-card animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{topic.tasks?.[0]?.title || "Zadanie do rozwiązania"}</CardTitle>
                  <CardDescription className="text-base mt-1 text-foreground">
                    {topic.tasks?.[0]?.description || "Rozwiąż zadanie korzystając z wirtualnej tablicy."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col">
              <div className="h-[600px] w-full relative bg-[#F8F9FA] dark:bg-[#121212]">
                <Excalidraw 
                  excalidrawAPI={(api) => setExcalidrawAPI(api)} 
                  langCode="pl-PL"
                  viewModeEnabled={checkTaskMutation.isPending}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                />
              </div>
              
              <div className="p-6 sm:p-8 bg-card border-t relative z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                {aiFeedback && (
                  <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-primary mb-2">Informacja zwrotna od AI</h4>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
                          {aiFeedback.split('\n').map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground mt-4 uppercase tracking-wider">Uwaga: AI może sporadycznie popełniać błędy.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <Button variant="ghost" onClick={() => setStep("quiz")} className="rounded-full w-full sm:w-auto text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="mr-2 w-4 h-4" /> Powrót do quizu
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={handleCheckTask}
                    disabled={checkTaskMutation.isPending}
                    className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-bold shadow-lg shadow-primary/20"
                  >
                    {checkTaskMutation.isPending ? "Sztuczna Inteligencja analizuje..." : "Sprawdź zadanie z AI ✨"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
