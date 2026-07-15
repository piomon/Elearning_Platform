import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import confetti from "canvas-confetti";
import { useRoute, useLocation } from "wouter";
import {
  useGetTopic,
  useGetMyProgress,
  useUpsertVideoProgress,
  useSubmitQuizAttempt,
  useStartQuizAttempt,
  useLessonChat,
  useGetAiProgress,
  useListTopics,
} from "@workspace/api-client-react";
import type { Video, LessonImage } from "@workspace/api-client-react";

// Chat bubbles are UI state: error bubbles carry a flag so they can be styled
// distinctly, offer a retry button and stay OUT of the history sent to the AI.
type LocalChatMessage = { role: "user" | "assistant"; content: string; isError?: boolean };
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  HelpCircle,
  AlertCircle,
  Bot,
  Loader2,
  Send,
  NotebookPen,
  ListChecks,
  ImageIcon,
  Lock,
  RotateCcw,
  Clock,
  Eye,
  EyeOff,
  Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { BuyAccessButton } from "@/components/buy-access-button";

const LessonWhiteboard = lazy(
  () => import("@/components/lesson-whiteboard/lesson-whiteboard"),
);
const TaskCardsBoard = lazy(
  () => import("@/components/lesson-whiteboard/task-cards-board"),
);

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type ProgressReport = {
  videoId: number;
  watchedSeconds: number;
};

// Big 16:9 lesson video. Tracks real watch position via the player.js protocol
// (Bunny Stream iframes are player.js-compatible) and reports it to the server,
// which alone decides completion. We never tell the server "watched" directly.
function LessonVideoPlayer({
  video,
  onReport,
}: {
  video: Video & { embedUrl?: string | null };
  onReport: (report: ProgressReport) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const lastSentRef = useRef(0);
  const latestRef = useRef({ seconds: 0, duration: 0 });
  const onReportRef = useRef(onReport);

  // Keep the latest onReport in a ref so the message-listener effect below can
  // stay subscribed across renders without depending on onReport's identity.
  // onReport changes on every render (it closes over a TanStack Query mutation
  // object that is recreated each render); if the effect depended on it, every
  // render would re-run the effect and fire its cleanup report, looping until
  // React's max update depth is exceeded.
  useEffect(() => {
    onReportRef.current = onReport;
  });

  useEffect(() => {
    setLoaded(false);
    latestRef.current = { seconds: 0, duration: 0 };
    lastSentRef.current = 0;
  }, [video.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const post = (method: string, value: string) => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ context: "player.js", version: "0.0.4", method, value }),
        "*",
      );
    };

    const subscribe = () => {
      post("addEventListener", "timeupdate");
      post("addEventListener", "ended");
    };

    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!msg || msg.context !== "player.js") return;

      if (msg.event === "ready") {
        subscribe();
      } else if (msg.event === "timeupdate" && msg.value) {
        const seconds = Number(msg.value.seconds) || 0;
        const duration = Number(msg.value.duration) || 0;
        latestRef.current = { seconds, duration };
        const now = Date.now();
        if (now - lastSentRef.current > 15000 && seconds > 0) {
          lastSentRef.current = now;
          onReportRef.current({
            videoId: video.id,
            watchedSeconds: seconds,
          });
        }
      } else if (msg.event === "ended") {
        const { seconds, duration } = latestRef.current;
        onReportRef.current({
          videoId: video.id,
          watchedSeconds: duration || seconds,
        });
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      const { seconds } = latestRef.current;
      if (seconds > 0) {
        onReportRef.current({
          videoId: video.id,
          watchedSeconds: seconds,
        });
      }
    };
  }, [video.id]);

  if (!video.embedUrl) {
    return (
      <div className="aspect-video bg-muted/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center px-6">
        <AlertCircle className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <span className="text-muted-foreground font-medium">
          To wideo jest chwilowo niedostępne. Spróbuj odświeżyć stronę za chwilę.
        </span>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-black rounded-2xl overflow-hidden relative shadow-inner ring-1 ring-border/50">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <Loader2 className="w-8 h-8 text-muted-foreground/60 animate-spin" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={video.embedUrl}
        title={video.title}
        onLoad={() => setLoaded(true)}
        allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}

export default function TopicDetail() {
  const [, params] = useRoute("/topics/:topicId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const topicId = params?.topicId ? parseInt(params.topicId, 10) : 0;

  const { data: topic, isLoading, isError, error } = useGetTopic(topicId, {
    query: { enabled: !!topicId } as any,
  });

  const isAccessDenied = (error as any)?.status === 403;

  const { data: allProgress, refetch: refetchProgress } = useGetMyProgress();
  const videoProgressMutation = useUpsertVideoProgress();
  const submitQuizMutation = useSubmitQuizAttempt();
  const lessonChatMutation = useLessonChat();

  const { data: siblingTopics } = useListTopics(topic?.sectionId ?? 0, {
    query: { enabled: !!topic?.sectionId } as any,
  });

  const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  // Timed-quiz state. startToken is the server-issued ticket echoed back on
  // submit; deadline is the local epoch-ms cutoff; remainingMs drives the
  // countdown; timeExpired locks the UI once the window closes.
  const [startToken, setStartToken] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const startQuizMutation = useStartQuizAttempt();
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [programOpen, setProgramOpen] = useState(false);
  // Per-task-card reveal toggles (Dział 4): answers/solutions stay hidden until
  // the student opts in. Keyed by lesson image id.
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});

  // Live retry status for the AI assistant: each chat request carries a
  // client-generated id; while it is pending we poll the progress endpoint so
  // the student sees "ponawiam próbę 2 z 4…" when the server retries for them.
  const [chatRequestId, setChatRequestId] = useState<string | null>(null);
  const [lastFailedChat, setLastFailedChat] = useState<string | null>(null);
  const chatProgressQuery = useGetAiProgress(chatRequestId ?? "", {
    query: {
      enabled: !!chatRequestId && lessonChatMutation.isPending,
      refetchInterval: 1000,
      retry: false,
      gcTime: 0,
    } as any,
  });
  const chatProgress =
    chatRequestId && lessonChatMutation.isPending ? chatProgressQuery.data : undefined;
  const chatRetryStatus =
    chatProgress && chatProgress.attempt > 1
      ? `Chwilowe przeciążenie AI — ponawiam próbę ${Math.min(chatProgress.attempt, chatProgress.maxAttempts)} z ${chatProgress.maxAttempts}…`
      : null;

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the latest auto-submit callback so the countdown interval can fire it
  // without re-subscribing on every render (avoids effect/mutation loops).
  const autoSubmitRef = useRef<() => void>(() => {});

  const currentProgress = allProgress?.find((p) => p.topicId === topicId);
  const notesKey = user ? `notes:${user.id}:${topicId}` : null;

  // Reset per-lesson UI state when switching topics.
  useEffect(() => {
    setActiveVideoId(null);
    setSelectedAnswers({});
    setQuizResult(null);
    setStartToken(null);
    setDeadline(null);
    setRemainingMs(null);
    setTimeExpired(false);
    setChatMessages([]);
    setChatInput("");
    setRevealedAnswers({});
    setRevealedSolutions({});
  }, [topicId]);

  // Pick the active video once the topic loads: prefer the video requested via
  // the ?video= query param (cross-lesson jump from a task card's "Zobacz
  // przykład rozwiązany"), otherwise fall back to the first video.
  useEffect(() => {
    if (topic?.videos?.length && activeVideoId === null) {
      const wanted = Number(
        new URLSearchParams(window.location.search).get("video"),
      );
      const requested = topic.videos.find((v) => v.id === wanted);
      setActiveVideoId((requested ?? topic.videos[0]).id);
      if (requested) {
        // Po nawigacji z innej lekcji przewiń do odtwarzacza (po renderze).
        setTimeout(() => {
          document
            .getElementById("lesson-video")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    }
  }, [topic, activeVideoId]);

  // Load saved notes for this student + topic.
  useEffect(() => {
    if (!notesKey) return;
    setNotes(localStorage.getItem(notesKey) ?? "");
    setNotesSaved(true);
  }, [notesKey]);

  // Auto-scroll the chat to the newest message.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, lessonChatMutation.isPending]);

  useEffect(() => {
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, []);

  // Keep the auto-submit callback fresh without re-running the timer effect.
  autoSubmitRef.current = () => {
    if (!quizResult && !submitQuizMutation.isPending) handleQuizSubmit(true);
  };

  // Countdown for timed quizzes. Ticks once per second off the server-derived
  // deadline; on reaching zero it locks the quiz and auto-submits current
  // answers. Server-side enforcement is the source of truth — this is UX.
  useEffect(() => {
    if (deadline == null || quizResult) return;
    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        setTimeExpired(true);
        autoSubmitRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, quizResult]);

  const handleVideoReport = useCallback(
    (report: ProgressReport) => {
      videoProgressMutation.mutate(
        { data: report },
        { onSuccess: () => refetchProgress() },
      );
    },
    [videoProgressMutation, refetchProgress],
  );

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setNotesSaved(false);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      if (notesKey) {
        localStorage.setItem(notesKey, value);
        setNotesSaved(true);
      }
    }, 800);
  };

  const handleQuizStart = () => {
    if (!topic?.quiz) return;
    startQuizMutation.mutate(
      { quizId: topic.quiz.id },
      {
        onSuccess: (data) => {
          setStartToken(data.startToken);
          setTimeExpired(false);
          if (data.timeLimitMinutes != null) {
            const end = data.startedAt + data.timeLimitMinutes * 60_000;
            setDeadline(end);
            setRemainingMs(Math.max(0, end - Date.now()));
          }
        },
        onError: () => {
          toast({
            title: "Nie można rozpocząć quizu",
            description: "Spróbuj ponownie za chwilę.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleQuizSubmit = (auto = false) => {
    if (!topic?.quiz) return;
    // On a timed auto-submit, fill any unanswered question with its first
    // option so the (complete-submission) contract still holds; the student
    // simply runs out of time on those.
    const effective: Record<number, number> = { ...selectedAnswers };
    if (auto) {
      for (const q of topic.quiz.questions) {
        if (effective[q.id] == null && q.answers[0]) {
          effective[q.id] = q.answers[0].id;
        }
      }
    }
    const answers = Object.entries(effective).map(([questionId, answerId]) => ({
      questionId: parseInt(questionId, 10),
      selectedAnswerId: answerId,
    }));
    submitQuizMutation.mutate(
      { quizId: topic.quiz.id, data: { answers, ...(startToken ? { startToken } : {}) } },
      {
        onSuccess: (result) => {
          setQuizResult(result);
          setDeadline(null);
          refetchProgress();
          if (result.passed && !prefersReducedMotion()) {
            confetti({
              particleCount: 140,
              spread: 70,
              origin: { y: 0.7 },
              colors: ["#0ea5e9", "#06b6d4", "#f59e0b", "#22c55e"],
            });
          }
          if (chatScrollRef.current) {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        },
        onError: () => {
          toast({
            title: "Wystąpił błąd",
            description: "Nie udało się wysłać quizu. Spróbuj ponownie.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const sendChatMessage = (message: string) => {
    if (!message || lessonChatMutation.isPending) return;
    // Working copy without error bubbles; on a retry also drop the duplicate
    // trailing user message so it is neither shown nor sent twice.
    const cleaned = chatMessages.filter((m) => !m.isError);
    const last = cleaned[cleaned.length - 1];
    const base =
      last?.role === "user" && last.content === message ? cleaned.slice(0, -1) : cleaned;
    // The backend keeps only the last few (clipped) turns anyway — sending
    // more would just be paid, ignored payload.
    const history = base.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setChatMessages([...base, { role: "user", content: message }]);
    setLastFailedChat(null);
    const rid = crypto.randomUUID();
    setChatRequestId(rid);
    lessonChatMutation.mutate(
      { data: { topicId, message, history, requestId: rid } },
      {
        onSuccess: (res) => {
          setChatMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
        },
        onError: (err) => {
          // Prefer the backend's specific Polish message (limit hit, AI
          // disabled, overload after retries…); never show a raw error.
          const backendRaw = (err as { data?: { error?: string } } | null)?.data?.error;
          const backend =
            typeof backendRaw === "string" && backendRaw.trim() ? backendRaw.trim() : null;
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              isError: true,
              content:
                backend ?? "Usługa AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
            },
          ]);
          setLastFailedChat(message);
        },
        onSettled: () => {
          setChatRequestId(null);
        },
      },
    );
  };

  const handleSendChat = () => {
    const message = chatInput.trim();
    if (!message || lessonChatMutation.isPending) return;
    setChatInput("");
    sendChatMessage(message);
  };

  const handleRetryChat = () => {
    if (!lastFailedChat || lessonChatMutation.isPending) return;
    sendChatMessage(lastFailedChat);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl space-y-8">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-full" />
        <div className="h-10 w-2/3 bg-muted animate-pulse rounded-xl" />
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="aspect-video bg-muted animate-pulse rounded-3xl" />
          <div className="hidden lg:block h-96 bg-muted animate-pulse rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl">
        <div className="rounded-3xl border bg-card p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold font-display">Ta lekcja wymaga dostępu</h1>
          <p className="mt-3 text-muted-foreground">
            To pełna lekcja kursu. Wykup dostęp, aby oglądać wszystkie materiały, rozwiązywać quizy i korzystać z asystenta AI.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <BuyAccessButton label="Kup dostęp" size="default" className="px-8 h-12" />
            <Button
              variant="outline"
              className="rounded-full px-8 h-12"
              onClick={() => setLocation("/")}
            >
              Strona główna
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !topic) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl">
        <div className="rounded-3xl border bg-card p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold font-display">Nie udało się wczytać lekcji</h1>
          <p className="mt-3 text-muted-foreground">
            Ta lekcja jest niedostępna lub wystąpił błąd połączenia. Wróć do pulpitu i spróbuj ponownie.
          </p>
          <Button className="mt-8 rounded-full px-8 h-12" onClick={() => setLocation("/dashboard")}>
            Wróć do pulpitu
          </Button>
        </div>
      </div>
    );
  }

  const videos = topic.videos ?? [];
  const images: LessonImage[] = topic.images ?? [];
  // Karty-zadania (obrazy z ukrytą odpowiedzią/rozwiązaniem) trafiają na
  // wspólną tablicę z akordeonem (dział „Kinematyka”); pozostałe obrazy to
  // zwykłe materiały do lekcji.
  const taskCards = images.filter((img) => Boolean(img.answer || img.solution));
  const materialImages = images.filter((img) => !(img.answer || img.solution));
  const activeVideo = videos.find((v) => v.id === activeVideoId) ?? videos[0] ?? null;

  // Jump to the worked-example video a task card refers to (Dział 4).
  const goToRelatedVideo = (videoId: number) => {
    setActiveVideoId(videoId);
    document.getElementById("lesson-video")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const orderedSiblings = [...(siblingTopics ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const isSiblingDone = (t: (typeof orderedSiblings)[number]) => {
    const p = allProgress?.find((pp) => pp.topicId === t.id);
    if (!p) return false;
    const videoOk = !t.hasVideo || p.videoCompleted;
    const quizOk = !t.hasQuiz || p.quizCompleted;
    return videoOk && quizOk;
  };

  const programNav = (onNavigate?: () => void) => (
    <nav className="p-2 space-y-1" aria-label="Lekcje w dziale">
      {orderedSiblings.map((t, idx) => {
        const done = isSiblingDone(t);
        const isCurrent = t.id === topicId;
        return (
          <button
            key={t.id}
            onClick={() => {
              setLocation(`/topics/${t.id}`);
              window.scrollTo({ top: 0 });
              onNavigate?.();
            }}
            aria-current={isCurrent ? "page" : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
              isCurrent ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60"
            }`}
          >
            <div
              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                done
                  ? "bg-success/20 text-success"
                  : isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
            </div>
            <span
              className={`text-sm leading-tight line-clamp-2 ${
                isCurrent ? "font-bold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground"
              }`}
            >
              {t.title}
            </span>
            {t.isPreview && !done && (
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-primary">
                Demo
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const chatPanel = (
    <div className="flex flex-col h-full">
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {chatMessages.length === 0 && !lessonChatMutation.isPending && (
          <div className="text-center text-sm text-muted-foreground py-8 px-4">
            <Bot className="w-10 h-10 mx-auto mb-3 text-primary/50" />
            <p className="font-medium text-foreground">Zapytaj asystenta o tę lekcję</p>
            <p className="mt-1">
              Pomogę Ci zrozumieć materiał, wyjaśnię pojęcia i naprowadzę na rozwiązanie zadań.
            </p>
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : m.isError
                    ? "bg-destructive/10 text-destructive rounded-bl-md"
                    : "bg-muted text-foreground rounded-bl-md"
              }`}
            >
              {m.content}
              {m.isError &&
                lastFailedChat &&
                i === chatMessages.length - 1 &&
                !lessonChatMutation.isPending && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full text-xs font-semibold"
                      onClick={handleRetryChat}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Spróbuj ponownie
                    </Button>
                  </div>
                )}
            </div>
          </div>
        ))}
        {lessonChatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              {chatRetryStatus ? (
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" /> {chatRetryStatus}
                </span>
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        )}
      </div>
      <form
        className="border-t p-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendChat();
        }}
      >
        <Textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendChat();
            }
          }}
          placeholder="Napisz pytanie..."
          rows={1}
          className="resize-none min-h-[44px] max-h-32 rounded-2xl"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full"
          disabled={!chatInput.trim() || lessonChatMutation.isPending}
          aria-label="Wyślij wiadomość"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );

  const notesPanel = (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-muted-foreground">Twoje notatki</span>
        <span className="text-xs text-muted-foreground">
          {notesSaved ? "Zapisano" : "Zapisywanie..."}
        </span>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Zapisuj tu najważniejsze wzory, definicje i własne wnioski z lekcji..."
        className="flex-1 resize-none rounded-2xl min-h-[300px]"
      />
    </div>
  );

  const sidePanel = (
    <Tabs defaultValue="program" className="flex flex-col h-full">
      <TabsList className="grid grid-cols-3 m-3 mb-0">
        <TabsTrigger value="program" className="gap-1.5">
          <ListChecks className="w-4 h-4" /> Lekcje
        </TabsTrigger>
        <TabsTrigger value="chat" className="gap-1.5">
          <Bot className="w-4 h-4" /> Asystent
        </TabsTrigger>
        <TabsTrigger value="notes" className="gap-1.5">
          <NotebookPen className="w-4 h-4" /> Notatki
        </TabsTrigger>
      </TabsList>
      <TabsContent value="program" className="flex-1 overflow-y-auto m-0 min-h-0">
        {programNav()}
      </TabsContent>
      <TabsContent value="chat" className="flex-1 m-0 min-h-0">
        {chatPanel}
      </TabsContent>
      <TabsContent value="notes" className="flex-1 m-0 min-h-0">
        {notesPanel}
      </TabsContent>
    </Tabs>
  );

  const passThreshold = quizResult?.passThreshold ?? 80;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <Button
          variant="ghost"
          className="-ml-4 text-muted-foreground rounded-full hover:text-foreground"
          onClick={() => setLocation("/dashboard")}
        >
          <ChevronLeft className="w-5 h-5 mr-1" /> Pulpit
        </Button>
        <Sheet open={programOpen} onOpenChange={setProgramOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden rounded-full font-semibold">
              <ListChecks className="w-4 h-4 mr-2" /> Lekcje i asystent
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-full sm:max-w-md flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-0 text-left">
              <SheetTitle>Panel lekcji</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">{sidePanel}</div>
            <SheetClose className="sr-only">Zamknij</SheetClose>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-6">
        {topic.isPreview && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary mb-3">
            <PlayCircle className="w-3.5 h-3.5" /> Lekcja demonstracyjna
          </span>
        )}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-display">{topic.title}</h1>
        {topic.description && (
          <p className="mt-2 text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
            {topic.description}
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
        {/* Main column */}
        <div className="space-y-10 min-w-0">
          {/* Video */}
          {activeVideo ? (
            <section id="lesson-video" className="space-y-4">
              <LessonVideoPlayer video={activeVideo} onReport={handleVideoReport} />
              {currentProgress?.videoCompleted && (
                <p className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="w-4 h-4" /> Materiał wideo zaliczony
                </p>
              )}
              {videos.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {videos.map((v, idx) => (
                    <button
                      key={v.id}
                      onClick={() => setActiveVideoId(v.id)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                        v.id === activeVideo.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:bg-muted text-foreground"
                      }`}
                    >
                      <PlayCircle className="w-4 h-4" /> Część {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border-2 border-dashed bg-muted/30 p-10 text-center">
              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">
                Ta lekcja opiera się na materiałach graficznych i quizie poniżej.
              </p>
            </section>
          )}

          {/* Materials (images) */}
          {materialImages.length > 0 && (
            <section className="space-y-5">
              <h2 className="flex items-center gap-3 text-2xl font-bold font-display">
                <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </span>
                Materiały do lekcji
              </h2>
              <div className="space-y-6">
                {materialImages.map((img) => (
                  <figure key={img.id} className="rounded-3xl border bg-card overflow-hidden shadow-sm">
                    <img
                      src={img.imageUrl}
                      alt={img.alt ?? topic.title}
                      loading="lazy"
                      className="w-full h-auto"
                    />
                    {img.alt && (
                      <figcaption className="px-5 py-3 text-sm text-muted-foreground border-t">
                        {img.alt}
                      </figcaption>
                    )}
                    {(img.answer || img.solution || img.relatedVideoId != null) && (
                      <div className="px-5 py-4 border-t space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {img.answer && (
                            <button
                              onClick={() =>
                                setRevealedAnswers((s) => ({ ...s, [img.id]: !s[img.id] }))
                              }
                              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                            >
                              {revealedAnswers[img.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                              {revealedAnswers[img.id] ? "Ukryj odpowiedź" : "Pokaż odpowiedź"}
                            </button>
                          )}
                          {img.solution && (
                            <button
                              onClick={() =>
                                setRevealedSolutions((s) => ({ ...s, [img.id]: !s[img.id] }))
                              }
                              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                            >
                              {revealedSolutions[img.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Lightbulb className="w-4 h-4" />
                              )}
                              {revealedSolutions[img.id] ? "Ukryj rozwiązanie" : "Pokaż rozwiązanie"}
                            </button>
                          )}
                          {img.relatedVideoId != null && (
                            <button
                              onClick={() => goToRelatedVideo(img.relatedVideoId!)}
                              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                            >
                              <PlayCircle className="w-4 h-4" /> Zobacz przykład rozwiązany
                            </button>
                          )}
                        </div>
                        {revealedAnswers[img.id] && img.answer && (
                          <div className="rounded-2xl bg-success/10 px-4 py-3 text-sm">
                            <span className="font-semibold text-success">Odpowiedź: </span>
                            <span className="text-foreground">{img.answer}</span>
                          </div>
                        )}
                        {revealedSolutions[img.id] && img.solution && (
                          <div className="rounded-2xl bg-muted px-4 py-3 text-sm whitespace-pre-line text-foreground">
                            <span className="font-semibold">Rozwiązanie: </span>
                            {img.solution}
                          </div>
                        )}
                      </div>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {/* Quiz */}
          {topic.quiz && (
            <section className="space-y-5">
              <h2 className="flex items-center gap-3 text-2xl font-bold font-display">
                <span className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </span>
                {topic.quiz.title}
              </h2>

              {currentProgress?.quizCompleted && !quizResult && (
                <div className="flex items-center gap-2 rounded-2xl bg-success/10 px-5 py-4 text-success font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> Quiz już zaliczony. Możesz rozwiązać go ponownie dla powtórki.
                </div>
              )}

              {quizResult && (
                <div
                  className={`rounded-3xl border-2 p-6 ${
                    quizResult.passed
                      ? "border-success/30 bg-success/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        quizResult.passed ? "bg-success/20 text-success" : "bg-amber-500/20 text-amber-600"
                      }`}
                    >
                      {quizResult.passed ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <RotateCcw className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {(quizResult.showScore ?? quizResult.percentage != null)
                          ? `${quizResult.percentage}% (${quizResult.score}/${quizResult.totalQuestions})`
                          : quizResult.passed
                            ? "Zaliczony"
                            : "Niezaliczony"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {quizResult.passed
                          ? "Świetnie! Quiz zaliczony."
                          : `Aby zaliczyć, potrzebujesz co najmniej ${passThreshold}%. Spróbuj ponownie.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Countdown banner for timed quizzes in progress */}
              {topic.quiz.timeLimitMinutes != null &&
                startToken !== null &&
                !quizResult &&
                remainingMs != null && (
                  <div
                    className={`flex items-center gap-2 rounded-2xl px-5 py-4 font-semibold ${
                      remainingMs <= 30_000
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    {timeExpired ? (
                      <span>Czas minął — odpowiedzi zostały wysłane.</span>
                    ) : (
                      <span>Pozostały czas: {formatRemaining(remainingMs)}</span>
                    )}
                  </div>
                )}

              {/* Start gate: timed quizzes must be started explicitly */}
              {topic.quiz.timeLimitMinutes != null && startToken === null && !quizResult ? (
                <div className="rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary font-semibold">
                    <Clock className="w-4 h-4" /> Limit czasu: {topic.quiz.timeLimitMinutes} min
                  </div>
                  <p className="text-muted-foreground">
                    Ten quiz ma ograniczenie czasowe. Po rozpoczęciu odliczanie nie
                    zatrzyma się — po upływie czasu odpowiedzi zostaną wysłane automatycznie.
                  </p>
                  <Button
                    size="lg"
                    className="h-14 px-8 rounded-full font-bold"
                    disabled={startQuizMutation.isPending}
                    onClick={handleQuizStart}
                  >
                    {startQuizMutation.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : null}
                    Rozpocznij quiz
                  </Button>
                </div>
              ) : (
              <div className="space-y-8">
                {topic.quiz.questions.map((q, idx) => {
                  const resultForQ = quizResult?.answers.find((a: any) => a.questionId === q.id);
                  const showFeedback = quizResult !== null;
                  // Only reveal per-answer right/wrong colouring when the quiz
                  // is configured to show correct answers; otherwise the server
                  // omits correctAnswerId/isCorrect and we must stay neutral.
                  const revealAnswers = showFeedback && quizResult?.showCorrectAnswers !== false;
                  return (
                    <div key={q.id} className="space-y-4">
                      <h3 className="font-bold text-lg flex gap-3">
                        <span className="text-primary">{idx + 1}.</span>
                        <span>{q.questionText}</span>
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {q.answers.map((a) => {
                          const isSelected = selectedAnswers[q.id] === a.id;
                          const isActuallyCorrect =
                            revealAnswers && resultForQ?.correctAnswerId === a.id;
                          const isWrongSelected =
                            revealAnswers && isSelected && resultForQ?.isCorrect === false;
                          let cls =
                            "justify-start h-auto py-4 px-5 rounded-2xl border-2 transition-all font-medium text-left flex items-start gap-3 text-sm";
                          if (showFeedback) {
                            if (isActuallyCorrect) cls += " border-success bg-success/10 text-foreground";
                            else if (isWrongSelected)
                              cls += " border-destructive bg-destructive/10 text-foreground";
                            else if (isSelected)
                              cls += " border-primary bg-primary/5 text-foreground";
                            else cls += " border-border bg-card text-muted-foreground";
                          } else if (isSelected) {
                            cls += " border-primary bg-primary/5 text-foreground";
                          } else {
                            cls += " border-border bg-card hover:border-primary/40 text-foreground";
                          }
                          return (
                            <button
                              key={a.id}
                              type="button"
                              disabled={showFeedback || timeExpired}
                              onClick={() =>
                                setSelectedAnswers((prev) => ({ ...prev, [q.id]: a.id }))
                              }
                              className={cls}
                            >
                              <span className="flex-1">{a.answerText}</span>
                              {isActuallyCorrect && (
                                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Submit / retry — hidden while a timed quiz is unstarted */}
              {!(topic.quiz.timeLimitMinutes != null && startToken === null && !quizResult) && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {!quizResult ? (
                    <Button
                      size="lg"
                      className="h-14 px-8 rounded-full font-bold w-full sm:w-auto"
                      disabled={
                        Object.keys(selectedAnswers).length < topic.quiz.questions.length ||
                        submitQuizMutation.isPending ||
                        timeExpired
                      }
                      onClick={() => handleQuizSubmit()}
                    >
                      {submitQuizMutation.isPending ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : null}
                      Sprawdź odpowiedzi
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 px-8 rounded-full font-bold w-full sm:w-auto"
                      onClick={() => {
                        setQuizResult(null);
                        setSelectedAnswers({});
                        setStartToken(null);
                        setDeadline(null);
                        setRemainingMs(null);
                        setTimeExpired(false);
                      }}
                    >
                      <RotateCcw className="w-5 h-5 mr-2" /> Rozwiąż ponownie
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

        </div>

        {/* Desktop side panel */}
        <aside className="hidden lg:block">
          <Card className="sticky top-24 rounded-3xl border shadow-sm overflow-hidden h-[calc(100vh-8rem)]">
            <CardContent className="p-0 h-full">{sidePanel}</CardContent>
          </Card>
        </aside>
      </div>

      {/* Wspólna tablica z akordeonem kart-zadań (dział „Kinematyka”) — poniżej
          gridu, aby tablica zajmowała pełną szerokość kontenera. Klucz topicId
          resetuje stan (aktywne/rozwinięte zadania) przy zmianie lekcji. */}
      {taskCards.length > 0 && (
        <div className="mt-10">
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card p-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /> Wczytywanie tablicy…
              </div>
            }
          >
            <TaskCardsBoard
              key={topicId}
              cards={taskCards}
              topicId={topicId}
              numberOffset={topic.taskCardNumberOffset ?? 0}
              onGoToLocalVideo={goToRelatedVideo}
            />
          </Suspense>
        </div>
      )}

      {/* Interactive whiteboard — placed below the grid on purpose so the board
          spans the full container width (more horizontal room to write). */}
      {topic.tasks.length > 0 && (
        <div className="mt-10">
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-2 rounded-3xl border bg-card p-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /> Wczytywanie tablicy…
              </div>
            }
          >
            <LessonWhiteboard tasks={topic.tasks} />
          </Suspense>
        </div>
      )}

      {/* Prev / Next */}
      <div className="mt-10 flex items-center justify-between gap-4 border-t pt-8">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!topic.previousTopicId}
          onClick={() => {
            if (topic.previousTopicId) {
              setLocation(`/topics/${topic.previousTopicId}`);
              window.scrollTo({ top: 0 });
            }
          }}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
        </Button>
        <Button
          className="rounded-full font-bold"
          disabled={!topic.nextTopicId}
          onClick={() => {
            if (topic.nextTopicId) {
              setLocation(`/topics/${topic.nextTopicId}`);
              window.scrollTo({ top: 0 });
            }
          }}
        >
          Następna lekcja <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
