import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  useCreateQuiz, useUpdateQuiz, useDeleteQuiz, useDuplicateQuiz,
  useCreateQuizQuestion, useUpdateQuizQuestion, useDeleteQuizQuestion,
  useDuplicateQuizQuestion, useReorderQuizQuestions,
  useCreateQuizAnswer, useUpdateQuizAnswer, useDeleteQuizAnswer, useReorderQuizAnswers,
  useSetQuizStatus, StatusUpdateStatus,
} from "@workspace/api-client-react";
import type { Quiz } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus, Trash2, Edit, Eye, EyeOff, Save, CheckCircle2, ListChecks, Copy, GripVertical, GraduationCap, AlertTriangle,
} from "lucide-react";
import { Toast, opts, ConfirmDelete, StatusSelect, STATUS_LABELS, statusBadgeVariant, LETTERS } from "./shared";

type QuizQuestion = Quiz["questions"][number];

export function QuizModule({ topicId, quiz, onChanged, toast }: {
  topicId: number; quiz: Quiz | null; onChanged: () => void; toast: Toast;
}) {
  const createQuiz = useCreateQuiz();
  const [quizTitle, setQuizTitle] = useState("Quiz");

  if (!quiz) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center space-y-3">
        <ListChecks className="w-8 h-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">Ten temat nie ma jeszcze quizu.</p>
        <div className="flex gap-2 justify-center items-center max-w-sm mx-auto">
          <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} className="rounded-lg" placeholder="Tytuł quizu" />
          <Button size="sm" className="rounded-lg shrink-0" onClick={() => createQuiz.mutate({ data: { topicId, title: quizTitle || "Quiz" } }, opts(onChanged, toast, "Utworzono quiz"))}>
            <Plus className="w-4 h-4 mr-1" />Utwórz quiz
          </Button>
        </div>
      </div>
    );
  }

  return <QuizEditorBody topicId={topicId} quiz={quiz} onChanged={onChanged} toast={toast} />;
}

function QuizEditorBody({ topicId, quiz, onChanged, toast }: {
  topicId: number; quiz: Quiz; onChanged: () => void; toast: Toast;
}) {
  const deleteQuiz = useDeleteQuiz();
  const duplicateQuiz = useDuplicateQuiz();
  const createQuestion = useCreateQuizQuestion();
  const setQuizStatus = useSetQuizStatus();
  const reorderQuestions = useReorderQuizQuestions();
  const [preview, setPreview] = useState(false);
  const [questionDialog, setQuestionDialog] = useState(false);
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    setOrder(quiz.questions.map((q) => q.id));
  }, [quiz.questions.map((q) => q.id).join(",")]);

  const orderedQuestions = order
    .map((id) => quiz.questions.find((q) => q.id === id))
    .filter((q): q is QuizQuestion => !!q);

  const commitOrder = (ids: number[]) => {
    setOrder(ids);
    reorderQuestions.mutate({ id: quiz.id, data: { ids } }, opts(onChanged, toast, "Zmieniono kolejność pytań"));
  };

  const changeStatus = (status: StatusUpdateStatus) => {
    setQuizStatus.mutate({ id: quiz.id, data: { status } }, opts(onChanged, toast, "Zmieniono status quizu"));
  };

  // Publish-readiness guardrails (server enforces; surfaced here for the admin).
  const emptyQuestions = quiz.questions.filter((q) => q.answers.length < 2 || !q.answers.some((a) => a.isCorrect));
  const publishBlocked = quiz.questions.length === 0 || emptyQuestions.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h5 className="font-bold text-sm">{quiz.title}</h5>
          <Badge variant="outline" className="rounded">{quiz.questions.length} pytań</Badge>
          <Badge variant={statusBadgeVariant(quiz.status ?? "draft")} className="rounded text-[10px]">{STATUS_LABELS[quiz.status ?? "draft"] ?? quiz.status}</Badge>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusSelect value={quiz.status ?? "draft"} onChange={changeStatus} disabled={setQuizStatus.isPending} />
          <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setPreview((p) => !p)}>
            {preview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {preview ? "Podgląd ucznia" : "Widok edycji"}
          </button>
          <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => duplicateQuiz.mutate({ id: quiz.id }, opts(onChanged, toast, "Zduplikowano quiz"))} disabled={preview}>
            <Copy className="w-3.5 h-3.5 mr-1" />Duplikuj
          </Button>
          <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => setQuestionDialog(true)} disabled={preview}>
            <Plus className="w-3.5 h-3.5 mr-1" />Pytanie
          </Button>
          <ConfirmDelete
            trigger={<Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
            title="Usunąć quiz?"
            description="Usunie wszystkie pytania i odpowiedzi."
            onConfirm={() => deleteQuiz.mutate({ id: quiz.id }, opts(onChanged, toast, "Usunięto quiz"))}
          />
        </div>
      </div>

      {!preview && <QuizSettingsForm quiz={quiz} topicId={topicId} onChanged={onChanged} toast={toast} />}

      {!preview && publishBlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            {quiz.questions.length === 0
              ? "Quiz nie ma pytań — nie można go opublikować."
              : `Niektóre pytania (${emptyQuestions.length}) nie mają min. 2 odpowiedzi lub brakuje poprawnej. Uzupełnij je przed publikacją.`}
          </span>
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 flex items-center gap-2 text-xs text-primary font-medium">
          <GraduationCap className="w-4 h-4" /> Podgląd ucznia — poprawne odpowiedzi są ukryte.
        </div>
      )}

      {quiz.questions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-4">Brak pytań.</p>
      ) : preview ? (
        <div className="space-y-3">
          {orderedQuestions.map((q, idx) => (
            <QuestionCard key={q.id} question={q} index={idx} preview onChanged={onChanged} toast={toast} />
          ))}
        </div>
      ) : (
        <Reorder.Group axis="y" values={order} onReorder={commitOrder} className="space-y-3">
          {orderedQuestions.map((q, idx) => (
            <QuestionReorderItem key={q.id} id={q.id}>
              <QuestionCard question={q} index={idx} preview={false} onChanged={onChanged} toast={toast} />
            </QuestionReorderItem>
          ))}
        </Reorder.Group>
      )}

      <Dialog open={questionDialog} onOpenChange={(o) => { if (!o) setQuestionDialog(false); }}>
        <QuestionDialogBody
          open={questionDialog}
          title="Nowe pytanie"
          onClose={() => setQuestionDialog(false)}
          onSubmit={(data) => createQuestion.mutate(
            { id: quiz.id, data: { ...data, sortOrder: quiz.questions.length } },
            { onSuccess: () => { onChanged(); toast({ title: "Dodano pytanie" }); setQuestionDialog(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          )}
        />
      </Dialog>
    </div>
  );
}

function QuestionReorderItem({ id, children }: { id: number; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="list-none">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="flex items-center px-1 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground touch-none"
          aria-label="Przeciągnij, aby zmienić kolejność"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </Reorder.Item>
  );
}

function QuizSettingsForm({ quiz, topicId, onChanged, toast }: {
  quiz: Quiz; topicId: number; onChanged: () => void; toast: Toast;
}) {
  const updateQuiz = useUpdateQuiz();
  const [title, setTitle] = useState(quiz.title);
  const [passThreshold, setPassThreshold] = useState(String(quiz.passThreshold ?? 80));
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts != null ? String(quiz.maxAttempts) : "");
  const [timeLimit, setTimeLimit] = useState(quiz.timeLimitMinutes != null ? String(quiz.timeLimitMinutes) : "");
  const [shuffleQuestions, setShuffleQuestions] = useState(!!quiz.shuffleQuestions);
  const [shuffleAnswers, setShuffleAnswers] = useState(!!quiz.shuffleAnswers);
  const [showScore, setShowScore] = useState(quiz.showScore ?? true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(quiz.showCorrectAnswers ?? true);

  useEffect(() => {
    setTitle(quiz.title);
    setPassThreshold(String(quiz.passThreshold ?? 80));
    setMaxAttempts(quiz.maxAttempts != null ? String(quiz.maxAttempts) : "");
    setTimeLimit(quiz.timeLimitMinutes != null ? String(quiz.timeLimitMinutes) : "");
    setShuffleQuestions(!!quiz.shuffleQuestions);
    setShuffleAnswers(!!quiz.shuffleAnswers);
    setShowScore(quiz.showScore ?? true);
    setShowCorrectAnswers(quiz.showCorrectAnswers ?? true);
  }, [quiz.id]);

  const save = () => {
    updateQuiz.mutate({
      id: quiz.id,
      data: {
        topicId, title: title || "Quiz", status: quiz.status,
        passThreshold: Number(passThreshold) || 80,
        maxAttempts: maxAttempts ? Number(maxAttempts) : null,
        timeLimitMinutes: timeLimit ? Number(timeLimit) : null,
        shuffleQuestions, shuffleAnswers, showScore, showCorrectAnswers,
      },
    }, opts(onChanged, toast, "Zapisano ustawienia quizu"));
  };

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tytuł quizu</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Próg zaliczenia (%)</Label>
          <Input type="number" min={0} max={100} value={passThreshold} onChange={(e) => setPassThreshold(e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Maks. prób (puste = bez limitu)</Label>
          <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Limit czasu (min, puste = brak)</Label>
          <Input type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} className="rounded-lg" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <SettingToggle label="Losuj kolejność pytań" checked={shuffleQuestions} onChange={setShuffleQuestions} />
        <SettingToggle label="Losuj kolejność odpowiedzi" checked={shuffleAnswers} onChange={setShuffleAnswers} />
        <SettingToggle label="Pokaż wynik po zakończeniu" checked={showScore} onChange={setShowScore} />
        <SettingToggle label="Pokaż poprawne odpowiedzi" checked={showCorrectAnswers} onChange={setShowCorrectAnswers} />
      </div>
      <div className="flex justify-end">
        <Button size="sm" className="rounded-lg" onClick={save} disabled={updateQuiz.isPending}>
          <Save className="w-3.5 h-3.5 mr-1" />Zapisz ustawienia
        </Button>
      </div>
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2">
      <Label className="text-xs cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function QuestionCard({ question, index, preview, onChanged, toast }: {
  question: QuizQuestion; index: number; preview: boolean; onChanged: () => void; toast: Toast;
}) {
  const updateQuestion = useUpdateQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();
  const duplicateQuestion = useDuplicateQuizQuestion();
  const createAnswer = useCreateQuizAnswer();
  const updateAnswer = useUpdateQuizAnswer();
  const deleteAnswer = useDeleteQuizAnswer();
  const reorderAnswers = useReorderQuizAnswers();
  const [editOpen, setEditOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [editAnswer, setEditAnswer] = useState<QuizQuestion["answers"][number] | null>(null);
  const [answerOrder, setAnswerOrder] = useState<number[]>([]);

  useEffect(() => {
    setAnswerOrder(question.answers.map((a) => a.id));
  }, [question.answers.map((a) => a.id).join(",")]);

  const orderedAnswers = answerOrder
    .map((id) => question.answers.find((a) => a.id === id))
    .filter((a): a is QuizQuestion["answers"][number] => !!a);

  const setCorrect = (answerId: number) => {
    const ans = question.answers.find((a) => a.id === answerId);
    if (!ans) return;
    updateAnswer.mutate(
      { answerId, data: { answerLabel: ans.answerLabel, answerText: ans.answerText, isCorrect: true } },
      opts(onChanged, toast, "Ustawiono poprawną odpowiedź"),
    );
  };

  const commitAnswerOrder = (ids: number[]) => {
    setAnswerOrder(ids);
    reorderAnswers.mutate({ questionId: question.id, data: { ids } }, opts(onChanged, toast, "Zmieniono kolejność odpowiedzi"));
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            <span className="text-muted-foreground mr-1">{index + 1}.</span>{question.questionText}
            {(question.points ?? 1) !== 1 && <Badge variant="outline" className="rounded ml-2 text-[10px]">{question.points} pkt</Badge>}
          </p>
          {!preview && question.explanation && (
            <p className="text-xs text-muted-foreground mt-1 italic">Wyjaśnienie: {question.explanation}</p>
          )}
        </div>
        {!preview && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => setEditOpen(true)} aria-label="Edytuj pytanie"><Edit className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => duplicateQuestion.mutate({ questionId: question.id }, opts(onChanged, toast, "Zduplikowano pytanie"))} aria-label="Duplikuj pytanie"><Copy className="w-3.5 h-3.5" /></Button>
            <ConfirmDelete
              trigger={<Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
              title="Usunąć pytanie?"
              description="Usunie pytanie i jego odpowiedzi."
              onConfirm={() => deleteQuestion.mutate({ questionId: question.id }, opts(onChanged, toast, "Usunięto pytanie"))}
            />
          </div>
        )}
      </div>

      {preview ? (
        <div className="space-y-1.5">
          {orderedAnswers.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border/50 p-2 text-sm">
              <span className="font-mono font-bold text-xs w-5">{a.answerLabel}</span>
              <span className="flex-1">{a.answerText}</span>
            </div>
          ))}
        </div>
      ) : (
        <RadioGroup
          value={String(question.answers.find((a) => a.isCorrect)?.id ?? "")}
          onValueChange={(v) => setCorrect(Number(v))}
        >
          <Reorder.Group axis="y" values={answerOrder} onReorder={commitAnswerOrder} className="space-y-1.5">
            {orderedAnswers.map((a) => (
              <Reorder.Item key={a.id} value={a.id} className="list-none">
                <div className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${a.isCorrect ? "border-success/40 bg-success/5" : "border-border/50"}`}>
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />
                  <RadioGroupItem value={String(a.id)} id={`a-${a.id}`} />
                  <span className="font-mono font-bold text-xs w-5">{a.answerLabel}</span>
                  <span className="flex-1">{a.answerText}</span>
                  {a.isCorrect && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                  <Button variant="ghost" size="sm" className="rounded h-6 w-6 p-0" onClick={() => { setEditAnswer(a); setAnswerOpen(true); }} aria-label="Edytuj odpowiedź"><Edit className="w-3 h-3" /></Button>
                  <ConfirmDelete
                    trigger={<Button variant="ghost" size="sm" className="rounded h-6 w-6 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3 h-3" /></Button>}
                    title="Usunąć odpowiedź?"
                    description="Tej operacji nie można cofnąć."
                    onConfirm={() => deleteAnswer.mutate({ answerId: a.id }, opts(onChanged, toast, "Usunięto odpowiedź"))}
                  />
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </RadioGroup>
      )}

      {!preview && (
        <Button variant="outline" size="sm" className="rounded-lg w-full border-dashed" onClick={() => { setEditAnswer(null); setAnswerOpen(true); }} disabled={question.answers.length >= LETTERS.length}>
          <Plus className="w-3.5 h-3.5 mr-1" />Dodaj odpowiedź
        </Button>
      )}

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false); }}>
        <QuestionDialogBody
          open={editOpen}
          title="Edytuj pytanie"
          initial={{ questionText: question.questionText, explanation: question.explanation ?? "", points: question.points ?? 1 }}
          onClose={() => setEditOpen(false)}
          onSubmit={(data) => updateQuestion.mutate(
            { questionId: question.id, data: { ...data, sortOrder: question.sortOrder } },
            { onSuccess: () => { onChanged(); toast({ title: "Zaktualizowano pytanie" }); setEditOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          )}
        />
      </Dialog>

      <Dialog open={answerOpen} onOpenChange={(o) => { if (!o) { setAnswerOpen(false); setEditAnswer(null); } }}>
        <AnswerDialogBody
          open={answerOpen}
          editAnswer={editAnswer}
          nextLabel={LETTERS[question.answers.length] ?? "?"}
          hasCorrect={question.answers.some((a) => a.isCorrect)}
          onClose={() => { setAnswerOpen(false); setEditAnswer(null); }}
          onSubmit={(answerText, isCorrect) => {
            if (editAnswer) {
              updateAnswer.mutate(
                { answerId: editAnswer.id, data: { answerLabel: editAnswer.answerLabel, answerText, isCorrect } },
                { onSuccess: () => { onChanged(); toast({ title: "Zapisano odpowiedź" }); setAnswerOpen(false); setEditAnswer(null); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
              );
            } else {
              createAnswer.mutate(
                { questionId: question.id, data: { answerLabel: LETTERS[question.answers.length] ?? "?", answerText, isCorrect } },
                { onSuccess: () => { onChanged(); toast({ title: "Dodano odpowiedź" }); setAnswerOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
              );
            }
          }}
        />
      </Dialog>
    </div>
  );
}

function QuestionDialogBody({ open, title, initial, onClose, onSubmit }: {
  open: boolean; title: string;
  initial?: { questionText: string; explanation: string; points: number };
  onClose: () => void;
  onSubmit: (data: { questionText: string; explanation: string | null; points: number }) => void;
}) {
  const [text, setText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [points, setPoints] = useState("1");

  useEffect(() => {
    if (open) {
      setText(initial?.questionText ?? "");
      setExplanation(initial?.explanation ?? "");
      setPoints(String(initial?.points ?? 1));
    }
  }, [open, initial]);

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>Treść pytania</Label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Wyjaśnienie (opcjonalne)</Label>
            <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} className="rounded-xl" placeholder="Pokazywane po odpowiedzi" />
          </div>
          <div className="space-y-2">
            <Label>Punkty</Label>
            <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} className="rounded-xl" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!text.trim()} onClick={() => onSubmit({ questionText: text, explanation: explanation.trim() || null, points: Number(points) || 1 })}>Zapisz</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AnswerDialogBody({ open, editAnswer, nextLabel, hasCorrect, onClose, onSubmit }: {
  open: boolean;
  editAnswer: QuizQuestion["answers"][number] | null;
  nextLabel: string; hasCorrect: boolean; onClose: () => void;
  onSubmit: (text: string, isCorrect: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  useEffect(() => {
    if (open) {
      setText(editAnswer?.answerText ?? "");
      setIsCorrect(editAnswer?.isCorrect ?? false);
    }
  }, [open, editAnswer]);
  const label = editAnswer?.answerLabel ?? nextLabel;
  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>{editAnswer ? `Edytuj odpowiedź (${label})` : `Nowa odpowiedź (${label})`}</DialogTitle>
        <DialogDescription>Tylko jedna odpowiedź w pytaniu może być poprawna.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>Treść odpowiedzi</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="ans-correct" checked={isCorrect} onCheckedChange={(c) => setIsCorrect(!!c)} />
          <Label htmlFor="ans-correct" className="cursor-pointer">Poprawna odpowiedź {hasCorrect && isCorrect && !editAnswer?.isCorrect ? "(zastąpi obecną)" : ""}</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!text.trim()} onClick={() => onSubmit(text, isCorrect)}>{editAnswer ? "Zapisz" : "Dodaj"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
