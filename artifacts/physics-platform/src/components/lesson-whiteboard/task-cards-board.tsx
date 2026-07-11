import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { LessonImage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import SketchBoard, { type SketchBoardHandle } from "./sketch-board";
import {
  PencilRuler,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lightbulb,
  PlayCircle,
  Eraser,
} from "lucide-react";

// Wspólna tablica lekcji z akordeonem kart-zadań (dział „Kinematyka”).
// Jedna interaktywna tablica na lekcję; pod nią lista rozwijanych zadań.
// Kliknięcie zadania rozwija jego treść i „przypina” je na tablicy (panel
// z treścią + obrazkiem). Każde zadanie ma osobny autozapis szkicu
// (klucz "card:<id>"), więc przełączanie zadań nie kasuje pracy ucznia.
export default function TaskCardsBoard({
  cards,
  topicId,
  numberOffset,
  onGoToLocalVideo,
}: {
  cards: LessonImage[];
  topicId: number;
  /** Liczba kart-zadań we wcześniejszych lekcjach działu — ciągła numeracja. */
  numberOffset: number;
  /** Przewinięcie do filmu-przykładu, gdy film należy do bieżącej lekcji. */
  onGoToLocalVideo: (videoId: number) => void;
}) {
  const [, setLocation] = useLocation();
  const ordered = useMemo(
    () => [...cards].sort((a, b) => a.sortOrder - b.sortOrder),
    [cards],
  );
  const [activeId, setActiveId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<number, boolean>>({});
  const [board, setBoard] = useState<SketchBoardHandle | null>(null);

  if (ordered.length === 0) return null;

  const active = ordered.find((c) => c.id === activeId) ?? ordered[0];
  const activeNumber = numberOffset + ordered.findIndex((c) => c.id === active.id) + 1;

  const toggleExpanded = (id: number) => {
    const willOpen = !expanded[id];
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
    // Rozwinięcie zadania od razu przypina je na tablicy; zwinięcie nie
    // zmienia aktywnego zadania (uczeń może dalej liczyć przy zwiniętej treści).
    if (willOpen) setActiveId(id);
  };

  const goToRelatedVideo = (card: LessonImage) => {
    if (card.relatedVideoId == null) return;
    if (card.relatedVideoTopicId != null && card.relatedVideoTopicId !== topicId) {
      // Film-przykład należy do innej lekcji tego działu — przechodzimy tam
      // i wskazujemy film przez parametr ?video= (odczytywany po załadowaniu).
      setLocation(`/topics/${card.relatedVideoTopicId}?video=${card.relatedVideoId}`);
      window.scrollTo({ top: 0 });
    } else {
      onGoToLocalVideo(card.relatedVideoId);
    }
  };

  return (
    <section className="space-y-5">
      <h2 className="flex items-center gap-3 text-2xl font-bold font-display">
        <span className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
          <PencilRuler className="w-5 h-5" />
        </span>
        Tablica z zadaniami
      </h2>
      <p className="text-muted-foreground -mt-2 max-w-3xl">
        Wybierz zadanie z listy pod tablicą — jego treść pojawi się na tablicy.
        Rozwiązuj, pisząc bezpośrednio po tablicy; Twój szkic zapisuje się osobno
        dla każdego zadania.
      </p>

      {/* Wspólna tablica — remount przy zmianie zadania (key), aby wczytać
          właściwy autozapis szkicu dla wybranego zadania. */}
      <SketchBoard
        key={active.id}
        sketchKey={`card:${active.id}`}
        panelLabel={`Zadanie ${activeNumber}`}
        description={active.alt}
        imageUrl={active.imageUrl}
        imageAlt={active.alt ?? `Zadanie ${activeNumber}`}
        onHandle={setBoard}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 rounded-full font-semibold w-full sm:w-auto"
            onClick={() => board?.clear()}
          >
            <Eraser className="w-5 h-5 mr-2" /> Wyczyść tablicę
          </Button>
        </div>
      </SketchBoard>

      {/* Akordeon zadań przypisanych do tej tablicy. */}
      <div className="space-y-3">
        {ordered.map((card, idx) => {
          const n = numberOffset + idx + 1;
          const isActive = card.id === active.id;
          const isOpen = !!expanded[card.id];
          return (
            <article
              key={card.id}
              className={`rounded-3xl border bg-card shadow-sm overflow-hidden transition-colors ${
                isActive ? "border-sky-500 ring-2 ring-sky-500/25" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(card.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isActive ? "bg-sky-500 text-white" : "bg-muted text-foreground"
                  }`}
                >
                  {n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Zadanie {n}</span>
                  {card.alt && (
                    <span className="block truncate text-sm text-muted-foreground">
                      {card.alt}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                    <PencilRuler className="h-3.5 w-3.5" /> Na tablicy
                  </span>
                )}
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-4 border-t px-4 py-4 sm:px-5">
                  <img
                    src={card.imageUrl}
                    alt={card.alt ?? `Zadanie ${n}`}
                    loading="lazy"
                    className="h-auto w-full rounded-2xl border"
                  />
                  <div className="flex flex-wrap gap-2">
                    {!isActive && (
                      <button
                        onClick={() => setActiveId(card.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/5 px-4 py-2 text-sm font-semibold text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
                      >
                        <PencilRuler className="w-4 h-4" /> Rozwiązuj na tablicy
                      </button>
                    )}
                    {card.answer && (
                      <button
                        onClick={() =>
                          setRevealedAnswers((s) => ({ ...s, [card.id]: !s[card.id] }))
                        }
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                      >
                        {revealedAnswers[card.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        {revealedAnswers[card.id] ? "Ukryj odpowiedź" : "Pokaż odpowiedź"}
                      </button>
                    )}
                    {card.solution && (
                      <button
                        onClick={() =>
                          setRevealedSolutions((s) => ({ ...s, [card.id]: !s[card.id] }))
                        }
                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
                      >
                        {revealedSolutions[card.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Lightbulb className="w-4 h-4" />
                        )}
                        {revealedSolutions[card.id] ? "Ukryj rozwiązanie" : "Pokaż rozwiązanie"}
                      </button>
                    )}
                    {card.relatedVideoId != null && (
                      <button
                        onClick={() => goToRelatedVideo(card)}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" /> Zobacz przykład rozwiązany
                      </button>
                    )}
                  </div>
                  {revealedAnswers[card.id] && card.answer && (
                    <div className="rounded-2xl bg-success/10 px-4 py-3 text-sm">
                      <span className="font-semibold text-success">Odpowiedź: </span>
                      <span className="text-foreground">{card.answer}</span>
                    </div>
                  )}
                  {revealedSolutions[card.id] && card.solution && (
                    <div className="rounded-2xl bg-muted px-4 py-3 text-sm whitespace-pre-line text-foreground">
                      <span className="font-semibold">Rozwiązanie: </span>
                      {card.solution}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
