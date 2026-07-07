import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import "@excalidraw/excalidraw/index.css";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";
import type { Task } from "@workspace/api-client-react";
import { useCheckTask } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  PencilRuler,
  Sparkles,
  Eraser,
  Loader2,
  AlertCircle,
  RotateCcw,
  Monitor,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

type ExcalidrawAPI = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Elementy sceny w formacie zwracanym przez onChange Excalidraw — używane do
// autozapisu szkicu ucznia w localStorage i przywrócenia go po odświeżeniu.
type SketchElements = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>
>[0];

const SKETCH_PREFIX = "fizyka-whiteboard:";

function loadSketch(taskId: number): SketchElements | undefined {
  try {
    const raw = localStorage.getItem(SKETCH_PREFIX + taskId);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as unknown as SketchElements)
      : undefined;
  } catch {
    return undefined;
  }
}

// Grubości pisaka (strokeWidth w jednostkach sceny Excalidraw). Wartości są
// celowo niższe niż standardowe 1/2/4 — „Cienki” ma być realnie cienki do cyfr,
// wzorów i jednostek, ale przy eksporcie do 1600 px nadal czytelny dla Gemini
// AI. „Gruby” służy głównie do podkreśleń i zaznaczeń.
type PenWidth = 0.75 | 1.5 | 3;
const DEFAULT_PEN: PenWidth = 0.75;
const PEN_OPTIONS: { label: string; value: PenWidth; preview: number }[] = [
  { label: "Cienki pisak", value: 0.75, preview: 1.5 },
  { label: "Normalny pisak", value: 1.5, preview: 3 },
  { label: "Gruby pisak", value: 3, preview: 5 },
];

// Tablica startuje lekko oddalona (zoom 0.8 = oddalenie o ~20%): linie wyglądają
// optycznie cieniej, a uczeń od razu ma więcej miejsca na obliczenia. Eksport do
// AI bazuje na elementach sceny, więc zoom nie wpływa na obraz wysyłany do Gemini.
const DEFAULT_ZOOM = 0.8 as NormalizedZoomValue;

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
  switch (status) {
    case 400:
      return "Nie udało się wysłać rozwiązania. Upewnij się, że na tablicy jest Twoje rozwiązanie i spróbuj ponownie.";
    case 401:
      return "Twoja sesja wygasła. Zaloguj się ponownie.";
    case 403: {
      const backend = (err as { data?: { error?: string } } | null)?.data?.error;
      return typeof backend === "string" && backend.trim()
        ? backend
        : "Nie masz dostępu do tej lekcji.";
    }
    case 404:
      return "Nie znaleziono zadania. Odśwież stronę i spróbuj ponownie.";
    case 413:
      return "Obraz tablicy jest zbyt duży. Usuń część elementów albo wyczyść tablicę i spróbuj ponownie.";
    case 429:
      return "Wykorzystano limit sprawdzeń AI. Spróbuj ponownie później.";
    case 502:
    case 503:
      return "Sprawdzanie AI jest chwilowo niedostępne. Spróbuj ponownie za chwilę.";
    default:
      return "Nie udało się teraz sprawdzić zadania. Spróbuj ponownie za chwilę.";
  }
}

function WhiteboardTask({ task }: { task: Task }) {
  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showTask, setShowTask] = useState(true);
  const [penWidth, setPenWidth] = useState<PenWidth>(DEFAULT_PEN);
  const checkMutation = useCheckTask();
  const busyRef = useRef(false);
  const isBusy = isPreparing || checkMutation.isPending;

  // Autozapis szkicu: przywracamy zapisany rysunek przy montowaniu komponentu
  // (osobna instancja na każde zadanie — klucz task.id), a zmiany zapisujemy
  // z opóźnieniem do localStorage, aby uczeń nie tracił pracy po odświeżeniu.
  const [initialElements] = useState<SketchElements | undefined>(() =>
    loadSketch(task.id),
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Domyślnie wybierz cienki pisak (odręczny), aby od razu można było pisać
  // rozwiązanie bez szukania narzędzia. Jeżeli przywrócono zapisany szkic,
  // wycentruj widok na notatkach ucznia (bez zmiany startowego oddalenia).
  useEffect(() => {
    if (!api) return;
    api.setActiveTool({ type: "freedraw" });
    const elements = api.getSceneElements();
    if (elements.length > 0) {
      api.scrollToContent(elements, { fitToViewport: false, animate: false });
    }
  }, [api]);

  const handleClear = useCallback(() => {
    if (!api) return;
    api.updateScene({ elements: [] });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      localStorage.removeItem(SKETCH_PREFIX + task.id);
    } catch {
      /* brak dostępu do localStorage — ignorujemy */
    }
    setFeedback(null);
    setErrorMsg(null);
  }, [api, task.id]);

  // Zapis szkicu z opóźnieniem (Excalidraw wywołuje onChange bardzo często —
  // przy każdym ruchu). Zapisujemy tylko żywe elementy; pustą tablicę czyścimy.
  const persistSketch = useCallback(
    (elements: SketchElements) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          const live = elements.filter((el) => !el.isDeleted);
          if (live.length === 0) {
            localStorage.removeItem(SKETCH_PREFIX + task.id);
          } else {
            localStorage.setItem(SKETCH_PREFIX + task.id, JSON.stringify(live));
          }
        } catch {
          /* localStorage pełny lub niedostępny — pomijamy autozapis */
        }
      }, 700);
    },
    [task.id],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Szybki wybór grubości pisaka. Zmienia domyślną grubość nowych elementów
  // (istniejące rysunki zostają bez zmian) i od razu aktywuje pisak odręczny,
  // aby uczeń mógł pisać dalej bez dodatkowych kliknięć.
  const setPen = useCallback(
    (width: PenWidth) => {
      setPenWidth(width);
      if (!api) return;
      api.updateScene({
        appState: {
          currentItemStrokeWidth: width,
          currentItemStrokeColor: "#1e1e1e",
          currentItemOpacity: 100,
        },
      });
      api.setActiveTool({ type: "freedraw" });
    },
    [api],
  );

  const handleCheck = useCallback(async () => {
    if (busyRef.current) return;
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

    checkMutation.mutate(
      { data: { taskId: task.id, imageBase64 } },
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
        },
      },
    );
  }, [api, checkMutation, task.id]);

  return (
    <article className="rounded-3xl border bg-card shadow-sm overflow-hidden">
      <div className="relative w-full h-[72vh] min-h-[500px] max-h-[560px] sm:h-[74vh] sm:min-h-[600px] sm:max-h-[680px] lg:h-[78vh] lg:min-h-[620px] lg:max-h-[780px] xl:max-h-[800px]">
        <Excalidraw
          excalidrawAPI={(instance) => setApi(instance)}
          langCode="pl-PL"
          theme="light"
          onChange={persistSketch}
          initialData={{
            elements: initialElements,
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemStrokeWidth: DEFAULT_PEN,
              currentItemStrokeColor: "#1e1e1e",
              currentItemOpacity: 100,
              currentItemRoughness: 0,
              zoom: { value: DEFAULT_ZOOM },
            },
          }}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
            },
          }}
        />

        {/* Treść zadania przypięta bezpośrednio na tablicy — nie znika podczas
            rysowania. Można ją zwinąć, aby odzyskać miejsce do pisania. */}
        <div className="pointer-events-none absolute right-3 top-16 z-10 w-[min(320px,calc(100%-1.5rem))]">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border bg-card/95 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setShowTask((s) => !s)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
              aria-expanded={showTask}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <PencilRuler className="h-4 w-4 text-sky-500" /> Zadanie
              </span>
              {showTask ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showTask && (
              <div className="max-h-[45vh] space-y-2 overflow-y-auto border-t px-4 py-3">
                <p className="text-sm font-semibold">{task.title}</p>
                {task.description && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {task.description}
                  </p>
                )}
                {task.initialImageUrl && (
                  <img
                    src={task.initialImageUrl}
                    alt={`Rysunek do zadania: ${task.title}`}
                    loading="lazy"
                    className="h-auto w-full rounded-lg border"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 border-t">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Grubość pisaka:
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Wybór grubości pisaka"
            >
              {PEN_OPTIONS.map((opt) => {
                const active = penWidth === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPen(opt.value)}
                    aria-pressed={active}
                    title="Do obliczeń najlepiej używać cienkiego pisaka i lekko oddalonego widoku."
                    className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                      active
                        ? "border-sky-500 bg-sky-500 text-white shadow-sm"
                        : "border-border bg-muted text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="inline-block w-5 rounded-full bg-current"
                      style={{ height: `${opt.preview}px` }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Do obliczeń najlepiej używać cienkiego pisaka i lekko oddalonego widoku.
          </p>
        </div>

        <div className="flex sm:hidden items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Dla wygodnego rozwiązywania zadań najlepiej użyć tabletu lub komputera.
          </span>
        </div>

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
            <Loader2 className="w-4 h-4 animate-spin" /> AI analizuje Twoje rozwiązanie…
          </div>
        )}

        {errorMsg && !isBusy && (
          <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-5 py-4 text-sm font-medium text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
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
      </div>
    </article>
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
