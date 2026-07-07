import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useUpdateTopic, useDuplicateTopic, usePreviewTopic,
  useCreateVideo, useUpdateVideo, useDeleteVideo,
  useCreateTask, useUpdateTask, useDeleteTask,
  StatusUpdateStatus,
} from "@workspace/api-client-react";
import type { AdminTopicTree, Video, Task, TopicInputDifficulty, TopicInputAccessType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Video as VideoIcon, ListChecks, ClipboardList, Save, Trash2, Plus, Edit, FileText,
  Image as ImageIcon, Sparkles, Search, Eye, Settings2, Copy, ExternalLink, GripVertical,
} from "lucide-react";
import { Toast, opts, ConfirmDelete, StatusSelect, ACCESS_TYPE_LABELS, DIFFICULTY_LABELS } from "./shared";
import { QuizModule } from "./quiz-module";
import { MaterialsModule } from "./materials-module";
import { BunnyAssignPanel } from "./bunny-module";

export function LessonEditorDialog({ topic, open, onClose, onChanged, toast }: {
  topic: AdminTopicTree; open: boolean; onClose: () => void; onChanged: () => void; toast: Toast;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-2xl max-w-4xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Edytor lekcji</span>
            <Badge variant="outline" className="rounded font-normal">{topic.title}</Badge>
          </DialogTitle>
        </DialogHeader>
        <LessonEditorBody topic={topic} onChanged={onChanged} toast={toast} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

const DIFFICULTIES: TopicInputDifficulty[] = ["easy", "medium", "hard"];
const ACCESS_TYPES: TopicInputAccessType[] = ["free", "paid", "admin"];

function LessonEditorBody({ topic, onChanged, toast, onClose }: {
  topic: AdminTopicTree; onChanged: () => void; toast: Toast; onClose: () => void;
}) {
  const updateTopic = useUpdateTopic();
  const duplicateTopic = useDuplicateTopic();
  const [tab, setTab] = useState("basic");

  // Topic-level fields managed together (Podstawowe + AI + SEO tabs) with a single save.
  const [form, setForm] = useState(() => extractForm(topic));
  const initial = useMemo(() => extractForm(topic), [topic.id]);
  useEffect(() => { setForm(extractForm(topic)); }, [topic.id]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof ReturnType<typeof extractForm>>(key: K, value: ReturnType<typeof extractForm>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    updateTopic.mutate({
      id: topic.id,
      data: {
        sectionId: topic.sectionId,
        title: form.title,
        slug: form.slug,
        description: form.description || undefined,
        sortOrder: topic.sortOrder,
        status: form.status as StatusUpdateStatus,
        objectives: form.objectives || null,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        difficulty: (form.difficulty || null) as TopicInputDifficulty,
        accessType: form.accessType,
        thumbnailUrl: form.thumbnailUrl || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
        aiEnabled: form.aiEnabled,
      },
    }, opts(onChanged, toast, "Zapisano lekcję"));
  };

  return (
    <>
      <div className="px-6 pt-3 shrink-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="basic" className="rounded-lg gap-1"><Settings2 className="w-3.5 h-3.5" />Podstawowe</TabsTrigger>
            <TabsTrigger value="video" className="rounded-lg gap-1"><VideoIcon className="w-3.5 h-3.5" />Wideo</TabsTrigger>
            <TabsTrigger value="materials" className="rounded-lg gap-1"><ImageIcon className="w-3.5 h-3.5" />Materiały</TabsTrigger>
            <TabsTrigger value="task" className="rounded-lg gap-1"><ClipboardList className="w-3.5 h-3.5" />Zadanie</TabsTrigger>
            <TabsTrigger value="ai" className="rounded-lg gap-1"><Sparkles className="w-3.5 h-3.5" />AI</TabsTrigger>
            <TabsTrigger value="quiz" className="rounded-lg gap-1"><ListChecks className="w-3.5 h-3.5" />Quiz</TabsTrigger>
            <TabsTrigger value="seo" className="rounded-lg gap-1"><Search className="w-3.5 h-3.5" />SEO</TabsTrigger>
            <TabsTrigger value="preview" className="rounded-lg gap-1"><Eye className="w-3.5 h-3.5" />Podgląd</TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto max-h-[calc(92vh-15rem)] py-4 pr-1 -mr-1">
            <TabsContent value="basic" className="mt-0 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Tytuł</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slug</Label>
                  <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="rounded-lg font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <StatusSelect value={form.status} onChange={(s) => set("status", s)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Opis</Label>
                  <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="rounded-lg" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Cele lekcji</Label>
                  <Textarea value={form.objectives} onChange={(e) => set("objectives", e.target.value)} rows={2} className="rounded-lg" placeholder="Czego uczeń się nauczy..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Czas trwania (min)</Label>
                  <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Poziom trudności</Label>
                  <Select value={form.difficulty || "none"} onValueChange={(v) => set("difficulty", v === "none" ? "" : v)}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">—</SelectItem>
                      {DIFFICULTIES.map((d) => <SelectItem key={d} value={d!}>{DIFFICULTY_LABELS[d!]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Typ dostępu</Label>
                  <Select value={form.accessType} onValueChange={(v) => set("accessType", v as TopicInputAccessType)}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ACCESS_TYPES.map((a) => <SelectItem key={a} value={a}>{ACCESS_TYPE_LABELS[a]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Lekcje „darmowe" są dostępne jako podgląd bez wykupionego kursu.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => duplicateTopic.mutate({ id: topic.id }, { ...opts(onChanged, toast, "Zduplikowano lekcję"), onSuccess: () => { onChanged(); toast({ title: "Zduplikowano lekcję" }); onClose(); } })}>
                <Copy className="w-3.5 h-3.5 mr-1" />Duplikuj całą lekcję
              </Button>
            </TabsContent>

            <TabsContent value="video" className="mt-0 space-y-4">
              <VideoEditor topicId={topic.id} video={topic.video ?? null} onChanged={onChanged} toast={toast} />
              <div className="border-t border-border/50 pt-4">
                <BunnyAssignPanel topicId={topic.id} onAssigned={onChanged} toast={toast} />
              </div>
            </TabsContent>

            <TabsContent value="materials" className="mt-0">
              <MaterialsModule topicId={topic.id} onChanged={onChanged} toast={toast} />
            </TabsContent>

            <TabsContent value="task" className="mt-0">
              <TasksEditor topicId={topic.id} tasks={topic.tasks} onChanged={onChanged} toast={toast} />
            </TabsContent>

            <TabsContent value="ai" className="mt-0 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <Label>Asystent AI w tej lekcji</Label>
                  <p className="text-xs text-muted-foreground">Sprawdzanie zadań i czat AI dla uczniów w tej lekcji.</p>
                </div>
                <Switch checked={form.aiEnabled} onCheckedChange={(v) => set("aiEnabled", v)} />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
                <p>Instrukcje promptu dla konkretnego zadania ustawisz w zakładce <strong>Zadanie</strong>.</p>
                <p className="flex items-center gap-1.5">
                  Globalny model, ton i instrukcje systemowe:
                  <Link href="/admin/ai" className="text-primary font-semibold inline-flex items-center gap-1 hover:underline">
                    Ustawienia AI <ExternalLink className="w-3 h-3" />
                  </Link>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="quiz" className="mt-0">
              <QuizModule topicId={topic.id} quiz={topic.quiz ?? null} onChanged={onChanged} toast={toast} />
            </TabsContent>

            <TabsContent value="seo" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Meta tytuł</Label>
                <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} className="rounded-lg" placeholder={form.title} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Meta opis</Label>
                <Textarea value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} rows={3} className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Miniatura (URL)</Label>
                <Input value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className="rounded-lg font-mono text-sm" placeholder="https://..." />
                {form.thumbnailUrl && <img src={form.thumbnailUrl} alt="" className="w-48 max-h-28 object-cover rounded-lg border border-border/50 bg-muted mt-2" />}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <StudentPreview topicId={topic.id} active={tab === "preview"} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Sticky save bar (topic-level fields). Module tabs save independently. */}
      <div className="border-t border-border/50 px-6 py-3 flex items-center justify-between gap-3 shrink-0 bg-background">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Masz niezapisane zmiany w polach lekcji." : "Wszystkie zmiany pól lekcji zapisane."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Zamknij</Button>
          <Button className="rounded-xl" onClick={save} disabled={!dirty || updateTopic.isPending}>
            <Save className="w-4 h-4 mr-1" />Zapisz lekcję
          </Button>
        </div>
      </div>
    </>
  );
}

function extractForm(topic: AdminTopicTree) {
  return {
    title: topic.title,
    slug: topic.slug,
    description: topic.description ?? "",
    status: topic.status as string,
    objectives: topic.objectives ?? "",
    durationMinutes: topic.durationMinutes != null ? String(topic.durationMinutes) : "",
    difficulty: (topic.difficulty ?? "") as string,
    accessType: (topic.accessType ?? "paid") as TopicInputAccessType,
    thumbnailUrl: topic.thumbnailUrl ?? "",
    metaTitle: topic.metaTitle ?? "",
    metaDescription: topic.metaDescription ?? "",
    aiEnabled: topic.aiEnabled ?? true,
  };
}

function StudentPreview({ topicId, active }: { topicId: number; active: boolean }) {
  const { data, isLoading } = usePreviewTopic(topicId, { query: { enabled: active } } as never);
  if (!active) return null;
  if (isLoading || !data) return <div className="h-40 bg-muted animate-pulse rounded-xl" />;
  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.02] p-5">
      <div className="flex items-center gap-2 text-xs text-primary font-medium">
        <Eye className="w-4 h-4" /> Podgląd jak widzi to uczeń
      </div>
      <h2 className="text-2xl font-black font-display">{data.title}</h2>
      {data.description && <p className="text-muted-foreground">{data.description}</p>}
      {data.objectives && (
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Cele lekcji</p>
          <p className="text-sm whitespace-pre-wrap">{data.objectives}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        {data.video && <Badge variant="outline" className="rounded gap-1"><VideoIcon className="w-3 h-3" />Wideo</Badge>}
        {data.images.length > 0 && <Badge variant="outline" className="rounded gap-1"><ImageIcon className="w-3 h-3" />{data.images.length} materiałów</Badge>}
        {data.quiz && <Badge variant="outline" className="rounded gap-1"><ListChecks className="w-3 h-3" />Quiz: {data.quiz.questions.length} pytań</Badge>}
        {data.tasks.length > 0 && <Badge variant="outline" className="rounded gap-1"><ClipboardList className="w-3 h-3" />{data.tasks.length} zadań</Badge>}
      </div>
      {data.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.images.map((img) => <img key={img.id} src={img.imageUrl} alt={img.alt ?? ""} className="w-full h-24 object-cover rounded-lg border border-border/50 bg-muted" />)}
        </div>
      )}
    </div>
  );
}

function VideoEditor({ topicId, video, onChanged, toast }: { topicId: number; video: Video | null; onChanged: () => void; toast: Toast }) {
  const createVideo = useCreateVideo();
  const updateVideo = useUpdateVideo();
  const deleteVideo = useDeleteVideo();
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [bunnyVideoId, setBunnyVideoId] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    setTitle(video?.title ?? "");
    setVideoUrl(video?.videoUrl ?? "");
    setBunnyVideoId(video?.bunnyVideoId ?? "");
    setDuration(video?.durationSeconds ? String(video.durationSeconds) : "");
  }, [video?.id]);

  const save = () => {
    if (updateVideo.isPending || createVideo.isPending) return;
    const payload = {
      topicId, title,
      videoUrl: videoUrl || undefined,
      bunnyVideoId: bunnyVideoId || undefined,
      durationSeconds: duration ? Number(duration) : undefined,
    };
    if (video) {
      updateVideo.mutate({ id: video.id, data: payload }, opts(onChanged, toast, "Zapisano wideo"));
    } else {
      createVideo.mutate({ data: payload }, opts(onChanged, toast, "Dodano wideo"));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Tytuł wideo</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">URL wideo</Label>
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." className="rounded-lg font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bunny Video ID</Label>
          <Input value={bunnyVideoId} onChange={(e) => setBunnyVideoId(e.target.value)} className="rounded-lg font-mono text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Czas trwania (s)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        {video && (
          <ConfirmDelete
            trigger={<Button variant="outline" size="sm" className="rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 mr-1" />Usuń wideo</Button>}
            title="Usunąć wideo?"
            description="Materiał wideo zostanie odłączony od tego tematu."
            onConfirm={() => deleteVideo.mutate({ id: video.id }, opts(onChanged, toast, "Usunięto wideo"))}
          />
        )}
        <Button size="sm" className="rounded-lg" disabled={!title.trim() || updateVideo.isPending || createVideo.isPending} onClick={save}><Save className="w-3.5 h-3.5 mr-1" />{video ? "Zapisz" : "Dodaj wideo"}</Button>
      </div>
    </div>
  );
}

function TasksEditor({ topicId, tasks, onChanged, toast }: { topicId: number; tasks: Task[]; onChanged: () => void; toast: Toast }) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [dialog, setDialog] = useState<{ open: boolean; edit?: Task }>({ open: false });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Zadania interaktywne</h5>
        <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => setDialog({ open: true })}>
          <Plus className="w-3.5 h-3.5 mr-1" />Dodaj zadanie
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-3">Brak zadań.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-border/60 bg-background p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{task.title}</p>
                {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{task.description}</p>}
                <div className="flex gap-2 mt-1.5">
                  {task.initialImageUrl && <Badge variant="outline" className="rounded text-[10px]">Obraz</Badge>}
                  {task.aiPromptConfig && <Badge variant="outline" className="rounded text-[10px]">AI prompt</Badge>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => setDialog({ open: true, edit: task })}><Edit className="w-3.5 h-3.5" /></Button>
                <ConfirmDelete
                  trigger={<Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
                  title="Usunąć zadanie?"
                  description="Tej operacji nie można cofnąć."
                  onConfirm={() => deleteTask.mutate({ id: task.id }, opts(onChanged, toast, "Usunięto zadanie"))}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) setDialog({ open: false }); }}>
        <TaskDialogBody
          open={dialog.open}
          edit={dialog.edit}
          submitting={createTask.isPending || updateTask.isPending}
          onClose={() => setDialog({ open: false })}
          onSubmit={(payload) => {
            if (dialog.edit) {
              updateTask.mutate({ id: dialog.edit.id, data: { topicId, ...payload } }, { onSuccess: () => { onChanged(); toast({ title: "Zapisano zadanie" }); setDialog({ open: false }); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) });
            } else {
              createTask.mutate({ data: { topicId, ...payload } }, { onSuccess: () => { onChanged(); toast({ title: "Dodano zadanie" }); setDialog({ open: false }); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) });
            }
          }}
        />
      </Dialog>
    </div>
  );
}

function TaskDialogBody({ open, edit, submitting, onClose, onSubmit }: {
  open: boolean;
  edit?: Task;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; description?: string; initialImageUrl?: string; aiPromptConfig?: Record<string, unknown> }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(edit?.title ?? "");
    setDescription(edit?.description ?? "");
    setImageUrl(edit?.initialImageUrl ?? "");
    const cfg = edit?.aiPromptConfig as { systemPrompt?: string } | null | undefined;
    setSystemPrompt(cfg?.systemPrompt ?? "");
  }, [open, edit]);

  return (
    <DialogContent className="rounded-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4" />{edit ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle></DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Tytuł</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Opis / polecenie</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>URL obrazu początkowego</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label>Instrukcja AI (system prompt)</Label>
          <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} placeholder="Wskazówki dla asystenta AI oceniającego rozwiązanie..." className="rounded-xl" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!title.trim() || submitting} onClick={() => onSubmit({
          title,
          description: description || undefined,
          initialImageUrl: imageUrl || undefined,
          aiPromptConfig: systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : undefined,
        })}>{edit ? "Zapisz" : "Dodaj"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
