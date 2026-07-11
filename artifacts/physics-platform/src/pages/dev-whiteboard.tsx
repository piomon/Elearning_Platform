// Strona podglądowa tablicy — TYLKO środowisko deweloperskie (import.meta.env.DEV).
// Służy do wizualnej weryfikacji domyślnego oddalenia (~30%) i grubości pisaka
// bez logowania (strony tematów wymagają konta i wykupionego dostępu).
// /dev/whiteboard        → tablica z zasianym przykładowym pismem (cyfry, wzór,
//                          osie, wektor, wykres) — sprawdza też scenariusz
//                          przywracania szkicu (scrollToContent po montażu).
// /dev/whiteboard?empty=1 → pusta tablica — sprawdza sam start (zoom 30%).
import { useState } from "react";
import SketchBoard from "@/components/lesson-whiteboard/sketch-board";

type Pt = [number, number];

// Mini "czcionka" kreskowa: każdy znak to lista kresek w kwadracie 0..1 (y w dół).
const GLYPHS: Record<string, Pt[][]> = {
  "1": [
    [
      [0.3, 0.2],
      [0.5, 0.0],
      [0.5, 1.0],
    ],
  ],
  "2": [
    [
      [0.1, 0.25],
      [0.3, 0.0],
      [0.7, 0.0],
      [0.9, 0.25],
      [0.1, 1.0],
      [0.9, 1.0],
    ],
  ],
  "3": [
    [
      [0.1, 0.1],
      [0.5, 0.0],
      [0.9, 0.25],
      [0.5, 0.5],
      [0.9, 0.75],
      [0.5, 1.0],
      [0.1, 0.9],
    ],
  ],
  "8": [
    [
      [0.5, 0.0],
      [0.15, 0.25],
      [0.85, 0.75],
      [0.5, 1.0],
      [0.15, 0.75],
      [0.85, 0.25],
      [0.5, 0.0],
    ],
  ],
  "9": [
    [
      [0.8, 0.3],
      [0.5, 0.0],
      [0.2, 0.15],
      [0.3, 0.5],
      [0.8, 0.3],
      [0.7, 1.0],
    ],
  ],
  v: [
    [
      [0.0, 0.4],
      [0.4, 1.0],
      [0.8, 0.4],
    ],
  ],
  "=": [
    [
      [0.1, 0.55],
      [0.9, 0.55],
    ],
    [
      [0.1, 0.75],
      [0.9, 0.75],
    ],
  ],
  s: [
    [
      [0.8, 0.45],
      [0.3, 0.42],
      [0.2, 0.6],
      [0.75, 0.75],
      [0.6, 1.0],
      [0.15, 0.95],
    ],
  ],
  "/": [
    [
      [0.7, 0.0],
      [0.2, 1.0],
    ],
  ],
  t: [
    [
      [0.4, 0.1],
      [0.4, 1.0],
      [0.6, 1.0],
    ],
    [
      [0.2, 0.4],
      [0.7, 0.4],
    ],
  ],
};

let seq = 0;

// Buduje element freedraw Excalidraw z łamanej (współrzędne sceny).
function stroke(points: Pt[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rel = points.map((p) => [p[0] - minX, p[1] - minY]);
  seq += 1;
  return {
    id: `dev-stroke-${seq}`,
    type: "freedraw",
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seq,
    version: 1,
    versionNonce: seq,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: rel,
    pressures: [],
    simulatePressure: true,
    lastCommittedPoint: rel[rel.length - 1],
  };
}

function writeText(text: string, x: number, y: number, size: number) {
  const out: ReturnType<typeof stroke>[] = [];
  let cx = x;
  for (const ch of text) {
    if (ch === " ") {
      cx += size * 0.6;
      continue;
    }
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cx += size * 0.6;
      continue;
    }
    for (const line of glyph) {
      out.push(
        stroke(line.map(([gx, gy]): Pt => [cx + gx * size * 0.7, y + gy * size])),
      );
    }
    cx += size * 0.9;
  }
  return out;
}

function buildElements() {
  const els: ReturnType<typeof stroke>[] = [];
  // Cyfry i wzór — pisane wielkością typową dla ucznia przy oddaleniu 30 %.
  els.push(...writeText("1 2 3 8 9", 100, 60, 70));
  els.push(...writeText("v = s / t", 100, 200, 70));
  // Osie wykresu (cienka oś pozioma i pionowa ze strzałkami).
  els.push(
    stroke([
      [100, 620],
      [560, 620],
    ]),
    stroke([
      [545, 610],
      [560, 620],
      [545, 630],
    ]),
    stroke([
      [100, 620],
      [100, 380],
    ]),
    stroke([
      [90, 395],
      [100, 380],
      [110, 395],
    ]),
  );
  // Prosta v(t) rosnąca + wektor ze strzałką i małe oznaczenie punktu.
  els.push(
    stroke([
      [110, 610],
      [520, 430],
    ]),
    stroke([
      [620, 600],
      [760, 470],
    ]),
    stroke([
      [742, 472],
      [760, 470],
      [756, 488],
    ]),
    stroke([
      [312, 516],
      [318, 522],
    ]),
    stroke([
      [318, 516],
      [312, 522],
    ]),
  );
  return els;
}

const SKETCH_PREFIX = "fizyka-whiteboard:";

export default function DevWhiteboard() {
  const [sketchKey] = useState(() => {
    const empty = new URLSearchParams(window.location.search).has("empty");
    const key = empty ? "devtest-empty" : "devtest";
    try {
      if (empty) {
        localStorage.removeItem(SKETCH_PREFIX + key);
      } else {
        localStorage.setItem(
          SKETCH_PREFIX + key,
          JSON.stringify(buildElements()),
        );
      }
    } catch {
      /* brak localStorage — tablica wystartuje pusta */
    }
    return key;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <SketchBoard
        key={sketchKey}
        sketchKey={sketchKey}
        panelLabel="Podgląd DEV"
        title="Weryfikacja tablicy (tylko środowisko deweloperskie)"
        description="Sprawdzenie domyślnego oddalenia ~30% i grubości pisaka."
        onHandle={(h) => {
          if (!h) return;
          const log = (label: string) => {
            const s = h.api.getAppState();
            console.log(
              `[DEV-WHITEBOARD] ${label}: zoom=${s.zoom.value} strokeWidth=${s.currentItemStrokeWidth} tool=${s.activeTool.type} scrollX=${Math.round(s.scrollX)} scrollY=${Math.round(s.scrollY)}`,
            );
          };
          log("init");
          setTimeout(() => log("po 2s"), 2000);
          setTimeout(() => log("po 5s"), 5000);
        }}
      />
    </div>
  );
}
