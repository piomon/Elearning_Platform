import { useCallback, useRef, useState } from "react";
import { exportToBlob } from "@excalidraw/excalidraw";
import type { Task } from "@workspace/api-client-react";
import { useCheckTask, useGetAiProgress } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import SketchBoard, { type SketchBoardHandle } from "./sketch-board";
import {
  PencilRuler,
  Sparkles,
  Eraser,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Nie udało się odczytać obrazu"));
    reader.readAsDataURL(blob);
  });
}

function mapCheckError(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  // The backend sends specific, student-friendly Polish messages (quota hit,
  // AI overloaded, config problem, timeout…) — prefer them over generic text.
  const backendRaw = (err as { data?: { error?: string } } | null)?.data?.error;
  const backend =
    typeof backendRaw === "string" && backendRaw.trim() ? backendRaw : null;
  switch (status) {
    case 400:
      return "Nie udało się wysłać rozwiązania. Upewnij się, że na tablicy jest Twoje rozwiązanie i spróbuj ponownie.";
    case 401:
      return "Twoja sesja wygasła. Zaloguj się ponownie.";
    case 403:
      return backend ?? "Nie masz dostępu do tej lekcji.";
    case 404:
      return "Nie znaleziono zadania. Odśwież stronę i spróbuj ponownie.";
    case 413:
      return "Obraz tablicy jest zbyt duży. Usuń część elementów albo wyczyść tablicę i spróbuj ponownie.";
    case 429:
      return backend ?? "Wykorzystano limit sprawdzeń AI. Spróbuj ponownie później.";
    case 502:
    case 503:
    case 504:
      return backend ?? "Sprawdzanie AI jest chwilowo niedostępne. Spróbuj ponownie za chwilę.";
    default:
      return "Nie udało się teraz sprawdzić zadania. Spróbuj ponownie za chwilę.";
  }
}

// Zadanie z tabeli `tasks` (działy 1–3): pełna tablica na zadanie + sprawdzanie
// rozwiązania przez AI. Rdzeń tablicy (Excalidraw, pisaki, autozapis) jest
// wydzielony do SketchBoard i współdzielony z tablicą kart-zadań (dział 4).
function WhiteboardTask({ task }: { task: Task }) {
  const [board, setBoard] = useState<SketchBoardHandle | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const checkMutation = useCheckTask();
  const busyRef = useRef(false);
  const isBusy = isPreparing || checkMutation.isPending;

  // Live retry status: the check request carries a client-generated id and,
  // while it is in flight, we poll the progress endpoint — so the student sees
  // an honest "Ponawiam próbę 2 z 4…" instead of a mute spinner when Gemini
  // hiccups and the server retries for them.
  const [requestId, setRequestId] = useState<string | null>(null);
  const progressQuery = useGetAiProgress(requestId ?? "", {
    query: {
      enabled: !!requestId && checkMutation.isPending,
      refetchInterval: 1000,
      retry: false,
      gcTime: 0,
    } as any,
  });
  const progress =
    requestId && checkMutation.isPending ? progressQuery.data : undefined;
  const retryStatus =
    progress && progress.attempt > 1
      ? `Usługa AI jest chwilowo przeciążona. Ponawiam próbę ${Math.min(progress.attempt, progress.maxAttempts)} z ${progress.maxAttempts}…`
      : null;

  const handleClear = useCallback(() => {
    board?.clear();
    setFeedback(null);
    setErrorMsg(null);
  }, [board]);

  const handleCheck = useCallback(async () => {
    if (busyRef.current) return;
    const api = board?.api;
    if (!api) {
      setErrorMsg("Tablica jeszcze się wczytuje. Poczekaj chwilę i spróbuj ponownie.");
      return;
    }

    const elements = api.getSceneElements();
    if (!elements || elements.length === 0) {
      setFeedback(null);
      setErrorMsg("Najpierw rozwiąż zadanie na tablicy, a potem kliknij sprawdzanie.");
      return;
    }

    busyRef.current = true;
    setIsPreparing(true);
    setErrorMsg(null);
    setFeedback(null);

    const release = () => {
      busyRef.current = false;
      setIsPreparing(false);
    };

    let imageBase64: string;
    try {
      const blob = await exportToBlob({
        elements: [...elements],
        appState: {
          ...api.getAppState(),
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
        },
        files: api.getFiles(),
        mimeType: "image/png",
        maxWidthOrHeight: 1600,
      });
      if (!blob) throw new Error("Pusty obraz");
      if (blob.size > MAX_UPLOAD_BYTES) {
        setErrorMsg(
          "Obraz tablicy jest zbyt duży. Usuń część elementów albo wyczyść tablicę i spróbuj ponownie.",
        );
        release();
        return;
      }
      imageBase64 = await blobToDataUrl(blob);
    } catch {
      setErrorMsg("Nie udało się przygotować obrazu tablicy. Spróbuj ponownie.");
      release();
      return;
    }

    const rid = crypto.randomUUID();
    setRequestId(rid);
    checkMutation.mutate(
      { data: { taskId: task.id, imageBase64, requestId: rid } },
      {
        onSuccess: (res) => {
          const text = (res?.feedback ?? "").trim();
          if (!text) {
            setErrorMsg("Nie udało się odczytać odpowiedzi AI. Spróbuj ponownie za chwilę.");
            return;
          }
          setErrorMsg(null);
          setFeedback(text);
        },
        onError: (err) => {
          setErrorMsg(mapCheckError(err));
        },
        onSettled: () => {
          release();
          setRequestId(null);
        },
      },
    );
  }, [board, checkMutation, task.id]);

  return (
    <SketchBoard
      sketchKey={String(task.id)}
      title={task.title}
      description={task.description}
      imageUrl={task.initialImageUrl}
      imageAlt={`Rysunek do zadania: ${task.title}`}
      onHandle={setBoard}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          size="lg"
          className="h-14 px-8 rounded-full font-bold w-full sm:w-auto"
          disabled={isBusy}
          onClick={handleCheck}
        >
          {isBusy ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          Sprawdź zadanie
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 px-6 rounded-full font-semibold w-full sm:w-auto"
          disabled={isBusy}
          onClick={handleClear}
        >
          <Eraser className="w-5 h-5 mr-2" /> Wyczyść tablicę
        </Button>
      </div>

      {isBusy && (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />{" "}
          {retryStatus ?? "AI analizuje Twoje rozwiązanie…"}
        </div>
      )}

      {errorMsg && !isBusy && (
        <div className="rounded-2xl bg-destructive/10 px-5 py-4 space-y-3">
          <div className="flex items-start gap-2 text-sm font-medium text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full font-semibold"
            onClick={handleCheck}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Spróbuj ponownie
          </Button>
        </div>
      )}

      {feedback && !isBusy && (
        <div className="rounded-3xl border-2 border-sky-500/30 bg-sky-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <h4 className="text-lg font-bold">Wynik sprawdzenia</h4>
          </div>
          <p className="text-foreground leading-relaxed whitespace-pre-line">{feedback}</p>
          <p className="text-xs text-muted-foreground">
            Wskazówki przygotowała sztuczna inteligencja i może się mylić — traktuj je
            pomocniczo.
          </p>
          <Button
            variant="outline"
            className="rounded-full font-semibold"
            disabled={isBusy}
            onClick={handleCheck}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Sprawdź ponownie
          </Button>
        </div>
      )}
    </SketchBoard>
  );
}

export default function LessonWhiteboard({ tasks }: { tasks: Task[] }) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <section className="space-y-5">
      <h2 className="flex items-center gap-3 text-2xl font-bold font-display">
        <span className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
          <PencilRuler className="w-5 h-5" />
        </span>
        Zadanie na tablicy
      </h2>
      <p className="text-muted-foreground -mt-2 max-w-3xl">
        Rozwiąż zadanie bezpośrednio na interaktywnej tablicy, a następnie kliknij „Sprawdź
        zadanie”, aby otrzymać wskazówki od AI.
      </p>
      <div className="space-y-8">
        {tasks.map((task) => (
          <WhiteboardTask key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}
