import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import "@excalidraw/excalidraw/index.css";
import "./lesson-whiteboard.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { NormalizedZoomValue } from "@excalidraw/excalidraw/types";
import {
  PencilRuler,
  Monitor,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

// Wspólny rdzeń interaktywnej tablicy Excalidraw. Używany w dwóch miejscach:
// 1) WhiteboardTask (lesson-whiteboard.tsx) — zadania z tabeli `tasks`
//    ze sprawdzaniem AI (działy 1–3, jedna tablica na zadanie),
// 2) TaskCardsBoard (task-cards-board.tsx) — jedna wspólna tablica na lekcję
//    z akordeonem kart-zadań (dział „Kinematyka”).
//
// UWAGA: komponent wczytuje zapisany szkic tylko przy montowaniu — rodzic MUSI
// przekazać `key` powiązany ze `sketchKey`, aby zmiana zadania przeładowała
// tablicę wraz z właściwym szkicem ucznia.

export type ExcalidrawAPI = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

// Elementy sceny w formacie zwracanym przez onChange Excalidraw — używane do
// autozapisu szkicu ucznia w localStorage i przywrócenia go po odświeżeniu.
type SketchElements = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>
>[0];

const SKETCH_PREFIX = "fizyka-whiteboard:";

function loadSketch(sketchKey: string): SketchElements | undefined {
  try {
    const raw = localStorage.getItem(SKETCH_PREFIX + sketchKey);
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
// dobrane tak, aby przy domyślnym oddaleniu (zoom 0.5) linia „Cienki” była na
// ekranie realnie cienka (~0,75 px), ale nadal dobrze widoczna podczas pisania,
// a przy eksporcie do 1600 px czytelna dla Gemini AI. „Gruby” służy głównie do
// podkreśleń i zaznaczeń.
type PenWidth = 1.5 | 3 | 6;
const DEFAULT_PEN: PenWidth = 1.5;
const PEN_OPTIONS: { label: string; value: PenWidth; preview: number }[] = [
  { label: "Cienki pisak", value: 1.5, preview: 2 },
  { label: "Normalny pisak", value: 3, preview: 4 },
  { label: "Gruby pisak", value: 6, preview: 6 },
];

// Kolory pisaka udostępnione w kompaktowym pasku pod tablicą — natywny boczny
// panel kolorów Excalidraw (~1/3 szerokości) jest ukryty (lesson-whiteboard.css).
const DEFAULT_COLOR = "#1e1e1e";
const PEN_COLORS: { label: string; value: string }[] = [
  { label: "Czarny", value: "#1e1e1e" },
  { label: "Czerwony", value: "#e03131" },
  { label: "Niebieski", value: "#1971c2" },
  { label: "Zielony", value: "#2f9e44" },
  { label: "Pomarańczowy", value: "#f08c00" },
];

// Tablica startuje mocno oddalona (zoom 0.5 = widok pomniejszony do 50%): uczeń
// od razu widzi znacznie większą część tablicy i ma dużo miejsca na obliczenia.
// Testowano też wariant 0.2 (20%) — odrzucony jako zbyt mało czytelny do pisania
// odręcznego. Eksport do AI bazuje na elementach sceny, więc zoom nie wpływa na
// obraz wysyłany do Gemini.
const DEFAULT_ZOOM = 0.5 as NormalizedZoomValue;

export type SketchBoardHandle = {
  api: ExcalidrawAPI;
  /** Czyści tablicę i usuwa zapisany szkic z localStorage. */
  clear: () => void;
};

export default function SketchBoard({
  sketchKey,
  panelLabel = "Zadanie",
  title,
  description,
  imageUrl,
  imageAlt,
  onHandle,
  children,
}: {
  /** Klucz autozapisu szkicu w localStorage (pełny klucz: "fizyka-whiteboard:" + sketchKey). */
  sketchKey: string;
  /** Nagłówek panelu przypiętego na tablicy, np. "Zadanie 4". */
  panelLabel?: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string;
  /** Uchwyt do API tablicy (eksport obrazu, czyszczenie) — dla przycisków rodzica. */
  onHandle?: (handle: SketchBoardHandle | null) => void;
  /** Dodatkowa zawartość panelu pod tablicą (przyciski, feedback AI itp.). */
  children?: ReactNode;
}) {
  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [showTask, setShowTask] = useState(true);
  const [penWidth, setPenWidth] = useState<PenWidth>(DEFAULT_PEN);
  const [penColor, setPenColor] = useState<string>(DEFAULT_COLOR);

  // Autozapis szkicu: przywracamy zapisany rysunek przy montowaniu komponentu
  // (osobna instancja na każde zadanie — klucz sketchKey), a zmiany zapisujemy
  // z opóźnieniem do localStorage, aby uczeń nie tracił pracy po odświeżeniu.
  const [initialElements] = useState<SketchElements | undefined>(() =>
    loadSketch(sketchKey),
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

  const clear = useCallback(() => {
    if (!api) return;
    api.updateScene({ elements: [] });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      localStorage.removeItem(SKETCH_PREFIX + sketchKey);
    } catch {
      /* brak dostępu do localStorage — ignorujemy */
    }
  }, [api, sketchKey]);

  // Uchwyt dla rodzica trzymamy w ref, aby zmiana identyczności callbacku nie
  // powodowała ponownego uruchamiania efektu (patrz: pętle efektów w React).
  const onHandleRef = useRef(onHandle);
  useEffect(() => {
    onHandleRef.current = onHandle;
  });
  useEffect(() => {
    if (!api) return;
    onHandleRef.current?.({ api, clear });
    return () => onHandleRef.current?.(null);
  }, [api, clear]);

  // Zapis szkicu z opóźnieniem (Excalidraw wywołuje onChange bardzo często —
  // przy każdym ruchu). Zapisujemy tylko żywe elementy; pustą tablicę czyścimy.
  const persistSketch = useCallback(
    (elements: SketchElements) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        try {
          const live = elements.filter((el) => !el.isDeleted);
          if (live.length === 0) {
            localStorage.removeItem(SKETCH_PREFIX + sketchKey);
          } else {
            localStorage.setItem(
              SKETCH_PREFIX + sketchKey,
              JSON.stringify(live),
            );
          }
        } catch {
          /* localStorage pełny lub niedostępny — pomijamy autozapis */
        }
      }, 700);
    },
    [sketchKey],
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
          currentItemOpacity: 100,
        },
      });
      api.setActiveTool({ type: "freedraw" });
    },
    [api],
  );

  // Szybki wybór koloru pisaka — zastępuje ukryty natywny panel kolorów.
  // Zmienia kolor nowych elementów i od razu aktywuje pisak odręczny.
  const setColor = useCallback(
    (color: string) => {
      setPenColor(color);
      if (!api) return;
      api.updateScene({ appState: { currentItemStrokeColor: color } });
      api.setActiveTool({ type: "freedraw" });
    },
    [api],
  );

  return (
    <article className="rounded-3xl border bg-card shadow-sm overflow-hidden">
      <div className="relative w-full h-[74vh] min-h-[520px] max-h-[600px] sm:h-[76vh] sm:min-h-[620px] sm:max-h-[720px] lg:h-[80vh] lg:min-h-[660px] lg:max-h-[820px] xl:max-h-[880px]">
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
              currentItemStrokeColor: DEFAULT_COLOR,
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
                <PencilRuler className="h-4 w-4 text-sky-500" /> {panelLabel}
              </span>
              {showTask ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showTask && (
              <div className="max-h-[45vh] space-y-2 overflow-y-auto border-t px-4 py-3">
                {title && <p className="text-sm font-semibold">{title}</p>}
                {description && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                )}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={imageAlt ?? panelLabel}
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Kolor pisaka:
            </span>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Wybór koloru pisaka"
            >
              {PEN_COLORS.map((c) => {
                const active = penColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    aria-pressed={active}
                    aria-label={c.label}
                    title={c.label}
                    className={`h-9 w-9 rounded-full border border-black/10 transition-transform ${
                      active
                        ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-card scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                );
              })}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Do obliczeń najlepiej używać cienkiego pisaka i oddalonego widoku. Kolor i
            grubość pisaka zmienisz w pasku powyżej.
          </p>
        </div>

        <div className="flex sm:hidden items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Dla wygodnego rozwiązywania zadań najlepiej użyć tabletu lub komputera.
          </span>
        </div>

        {children}
      </div>
    </article>
  );
}
