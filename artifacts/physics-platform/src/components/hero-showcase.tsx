import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, CheckCircle2, Sparkles, Brain, Trophy, PenTool, FileVideo, ShieldCheck,
  Loader2, ScanLine, Cpu,
} from "lucide-react";
import { ProgressRing } from "@/components/progress-ring";

type Phase = "video" | "quiz" | "task";
const PHASES: Phase[] = ["video", "quiz", "task"];
const DURATION: Record<Phase, number> = { video: 4200, quiz: 4800, task: 7400 };

type Reduce = boolean | null;

const panel = (reduce: Reduce) => ({
  initial: reduce ? false : { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: reduce ? { opacity: 0 } : { opacity: 0, y: -14 },
  transition: { duration: reduce ? 0.15 : 0.45, ease: "easeOut" as const },
});

function useTypewriter(text: string, active: boolean, reduce: Reduce, speed = 26) {
  const [out, setOut] = useState(reduce ? text : "");
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [active, text, reduce, speed]);
  return out;
}

function Dots({ reduce }: { reduce: Reduce }) {
  return (
    <span className="ml-1 inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={reduce ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25] }}
          transition={reduce ? {} : { duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

function VideoPhase({ reduce }: { reduce: Reduce }) {
  return (
    <motion.div {...panel(reduce)} className="h-full flex flex-col gap-3">
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/50 shadow-inner flex items-center justify-center">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_28%_22%,rgba(56,189,248,0.55),transparent_55%)]" />
        {!reduce && (
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative">
          {!reduce && (
            <motion.span
              className="absolute inset-0 rounded-full bg-white/40"
              animate={{ scale: [1, 1.9], opacity: [0.45, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <div className="relative w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-primary fill-primary translate-x-0.5" />
          </div>
        </div>
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center gap-1.5">
          <FileVideo className="w-3 h-3" /> Prędkość i ruch
        </div>
        <div className="absolute bottom-9 left-3 flex items-end gap-1 h-6">
          {[0.5, 0.8, 0.35, 0.65, 0.45].map((h, i) => (
            <motion.span
              key={i}
              className="w-1 rounded-full bg-primary/80"
              style={{ height: `${h * 100}%` }}
              animate={reduce ? undefined : { scaleY: [h, 1, h * 0.6, h] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
            />
          ))}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-white/25 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: reduce ? "66%" : "10%" }}
              animate={{ width: "66%" }}
              transition={{ duration: reduce ? 0 : 3.2, ease: "linear" }}
            />
          </div>
          <span className="text-white/90 text-[10px] font-medium tabular-nums">04:07 / 06:15</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: FileVideo, w1: "w-12", w2: "w-8" },
          { icon: Brain, w1: "w-10", w2: "w-10" },
        ].map(({ icon: Icon, w1, w2 }, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="space-y-1.5">
              <div className={`h-1.5 ${w1} bg-foreground/70 rounded-full`} />
              <div className={`h-1.5 ${w2} bg-muted-foreground/40 rounded-full`} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function QuizPhase({ reduce }: { reduce: Reduce }) {
  const options = ["Masa ciała w ruchu", "Szybkość zmiany położenia", "Siła działająca na ciało"];
  const correct = 1;
  const [revealed, setRevealed] = useState(!!reduce);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setRevealed(true), 1600);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <motion.div {...panel(reduce)} className="h-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Quiz · Pytanie 2/5</span>
        <Brain className="w-4 h-4 text-violet-500" />
      </div>
      <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-3">
        <p className="text-sm font-bold text-foreground leading-snug">Co opisuje prędkość?</p>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {options.map((o, i) => {
          const isCorrect = i === correct;
          const active = revealed && isCorrect;
          return (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : 0.12 * i, duration: 0.35 }}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors duration-300
                ${active ? "border-success/40 bg-success/10" : "border-border/70 bg-card"}`}
            >
              <span
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
                  ${active ? "bg-success text-white" : "bg-muted text-muted-foreground"}`}
              >
                {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
              </span>
              <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{o}</span>
            </motion.div>
          );
        })}
      </div>
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="self-start flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold text-success"
          >
            <CheckCircle2 className="w-3 h-3" /> Poprawna odpowiedź
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const CHECKS = [
  { label: "Odczytano dane: s = 120 m, t = 4 s", at: 1 },
  { label: "Rozpoznano wzór: v = s / t", at: 2 },
  { label: "Zweryfikowano obliczenia", at: 3 },
];

function TaskPhase({ reduce }: { reduce: Reduce }) {
  const [step, setStep] = useState(reduce ? 4 : 0);
  useEffect(() => {
    if (reduce) setStep(4);
  }, [reduce]);
  useEffect(() => {
    if (reduce) return;
    const timers = [
      setTimeout(() => setStep(1), 950),
      setTimeout(() => setStep(2), 1750),
      setTimeout(() => setStep(3), 2550),
      setTimeout(() => setStep(4), 3350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const done = step >= 4;
  const feedback = "Świetnie! Poprawnie zastosowałeś wzór na prędkość. Wynik 30 m/s jest prawidłowy.";
  const typed = useTypewriter(feedback, done, reduce);

  return (
    <motion.div {...panel(reduce)} className="h-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" /> Zadanie · Sprawdza AI
        </span>
        <PenTool className="w-4 h-4 text-primary" />
      </div>

      {/* Student answer being scanned */}
      <div className="relative rounded-xl border border-border/60 bg-card p-3 overflow-hidden">
        <p className="text-[11px] text-muted-foreground leading-snug">Samochód pokonał 120 m w 4 s. Oblicz jego prędkość.</p>
        <p className="mt-2 font-mono text-sm font-semibold text-foreground">
          v = s / t = 120 / 4 = <span className="text-primary">30 m/s</span>
        </p>
        {!done && !reduce && (
          <>
            <motion.div
              className="absolute left-0 right-0 h-10 bg-gradient-to-b from-primary/0 via-primary/25 to-primary/0"
              initial={{ top: "-25%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold text-primary">
              <ScanLine className="w-3 h-3" /> skan
            </div>
          </>
        )}
        {done && (
          <motion.div
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-success flex items-center justify-center"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </motion.div>
        )}
      </div>

      {/* AI verification checklist */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key="checks"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                Fizyka7 analizuje rozwiązanie <Dots reduce={reduce} />
              </div>
              {CHECKS.map((c) => {
                const isDone = step >= c.at;
                const isActive = step === c.at - 1;
                return (
                  <motion.div
                    key={c.at}
                    initial={reduce ? false : { opacity: 0, x: 8 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.4, x: 0 }}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-muted shrink-0" />
                    )}
                    <span className={isDone ? "text-foreground/80 font-medium" : "text-muted-foreground"}>{c.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="feedback"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-xl bg-success/10 border border-success/20 p-3 flex gap-3"
            >
              <div className="relative shrink-0">
                {!reduce && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-success/30"
                    animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <div className="relative w-9 h-9 rounded-full bg-success/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-success" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Fizyka7 <span className="text-[9px] font-semibold text-success bg-success/15 px-1.5 py-0.5 rounded-full">100% trafność</span>
                </p>
                <p className="mt-1 text-[11px] text-foreground/80 leading-snug min-h-[2.4em]">
                  {typed}
                  {!reduce && typed.length < feedback.length && (
                    <span className="inline-block w-1 h-3 bg-primary/70 ml-0.5 align-middle animate-pulse" />
                  )}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-success bg-success/15 px-2 py-0.5 rounded-full">+10 pkt</span>
                  <span className="text-[10px] font-medium text-muted-foreground">Temat ukończony</span>
                </div>
              </div>
              <div className="shrink-0 self-center">
                <ProgressRing progress={100} size={42} strokeWidth={4} colorClass="text-success">
                  <span className="text-[8px] font-bold text-success">100%</span>
                </ProgressRing>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function FloatingBadge({
  className, tone, icon: Icon, label, value, reduce, delay,
}: {
  className: string;
  tone: "success" | "primary";
  icon: typeof Trophy;
  label: string;
  value: string;
  reduce: Reduce;
  delay: number;
}) {
  return (
    <motion.div
      className={`absolute ${className} bg-card p-3.5 rounded-2xl shadow-xl border border-border items-center gap-3 hidden md:flex z-20`}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: [0, -8, 0] }}
      transition={reduce ? {} : { y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay }, opacity: { duration: 0.6 } }}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center ${tone === "success" ? "bg-success/20" : "bg-primary/10"}`}>
        <Icon className={`w-5 h-5 ${tone === "success" ? "text-success" : "text-primary"}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </motion.div>
  );
}

export function HeroShowcase() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? "task" : "video");

  useEffect(() => {
    if (reduce) setPhase("task");
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => {
      setPhase((p) => PHASES[(PHASES.indexOf(p) + 1) % PHASES.length]);
    }, DURATION[phase]);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const steps = [
    { id: "video" as const, icon: FileVideo },
    { id: "quiz" as const, icon: Brain },
    { id: "task" as const, icon: PenTool },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none perspective-1000">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-background/90 backdrop-blur-xl aspect-square sm:aspect-[4/3] flex flex-col p-4 sm:p-6 transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out">
        <div className="flex items-center gap-2 mb-5 border-b border-border/50 pb-4">
          <div className="w-3.5 h-3.5 rounded-full bg-red-400 shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-inner" />
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-inner" />
          <div className="mx-auto flex items-center gap-1.5 bg-muted/50 rounded-md h-7 px-3 text-[10px] font-medium text-muted-foreground">
            <ShieldCheck className="w-3 h-3 text-success" /> fizyka7.pl/lekcja/predkosc
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          <div className="col-span-3 border-r border-border/50 pr-4 hidden sm:flex sm:flex-col gap-2">
            {steps.map((s) => {
              const active = s.id === phase;
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className={`relative h-9 rounded-lg flex items-center px-2.5 gap-2 transition-colors duration-300 ${active ? "bg-primary/10" : "bg-muted/40"}`}
                >
                  {active && <motion.div layoutId="hs-active" className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary" />}
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
                  <div className={`h-2 rounded-full transition-colors ${active ? "bg-primary/50 w-12" : "bg-muted-foreground/30 w-10"}`} />
                </div>
              );
            })}
            <div className="mt-auto flex items-center gap-2 rounded-lg bg-muted/40 p-2">
              <ProgressRing progress={72} size={34} strokeWidth={3}>
                <span className="text-[8px] font-bold">72%</span>
              </ProgressRing>
              <div className="space-y-1.5">
                <div className="h-1.5 w-10 bg-foreground/70 rounded-full" />
                <div className="h-1.5 w-7 bg-muted-foreground/40 rounded-full" />
              </div>
            </div>
          </div>

          <div className="col-span-12 sm:col-span-9 min-h-0">
            <AnimatePresence mode="wait">
              {phase === "video" && <VideoPhase key="video" reduce={reduce} />}
              {phase === "quiz" && <QuizPhase key="quiz" reduce={reduce} />}
              {phase === "task" && <TaskPhase key="task" reduce={reduce} />}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FloatingBadge
        className="-right-6 -top-6"
        tone="success"
        icon={CheckCircle2}
        label="Zadanie sprawdzone"
        value="Świetna robota!"
        reduce={reduce}
        delay={0}
      />
      <FloatingBadge
        className="-left-6 -bottom-6"
        tone="primary"
        icon={Trophy}
        label="Nowe osiągnięcie"
        value="Mistrz Kinematyki"
        reduce={reduce}
        delay={1.2}
      />
    </div>
  );
}
