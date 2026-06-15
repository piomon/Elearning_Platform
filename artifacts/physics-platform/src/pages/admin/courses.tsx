import { useEffect, useState } from "react";
import {
  useListAdminCourses,
  useCreateCourse, useUpdateCourse, useDeleteCourse,
  useCreateSection, useUpdateSection, useDeleteSection,
  useCreateTopic, useUpdateTopic, useDeleteTopic,
  useCreateVideo, useUpdateVideo, useDeleteVideo,
  useCreateQuiz, useDeleteQuiz,
  useCreateQuizQuestion, useUpdateQuizQuestion, useDeleteQuizQuestion,
  useCreateQuizAnswer, useUpdateQuizAnswer, useDeleteQuizAnswer,
  useCreateTask, useUpdateTask, useDeleteTask,
  useSetCourseStatus, useSetSectionStatus, useSetTopicStatus, useSetQuizStatus,
  StatusUpdateStatus,
} from "@workspace/api-client-react";
import type {
  AdminCourseTree, AdminSectionTree, AdminTopicTree, Quiz, Task, Video,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@/lib/utils";
import {
  BookOpen, Edit, Trash2, Plus, ChevronRight, ChevronDown, Video as VideoIcon,
  ListChecks, ClipboardList, Eye, EyeOff, GraduationCap, Save, CheckCircle2,
} from "lucide-react";

type Toast = ReturnType<typeof useToast>["toast"];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

function opts(onChanged: () => void, toast: Toast, successMsg: string) {
  return {
    onSuccess: () => { onChanged(); toast({ title: successMsg }); },
    onError: () => toast({ title: "Błąd", description: "Operacja nie powiodła się.", variant: "destructive" as const }),
  };
}

function ConfirmDelete({ trigger, title, description, onConfirm }: {
  trigger: React.ReactNode; title: string; description: string; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Anuluj</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  published: "Opublikowany",
  hidden: "Ukryty",
  archived: "Zarchiwizowany",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "published") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

function StatusSelect({ value, onChange, disabled }: {
  value: string; onChange: (status: StatusUpdateStatus) => void; disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusUpdateStatus)} disabled={disabled}>
      <SelectTrigger className="h-9 w-[150px] rounded-xl text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {Object.values(StatusUpdateStatus).map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminCourses() {
  const { data, isLoading, refetch } = useListAdminCourses();
  const { toast } = useToast();
  const onChanged = () => { refetch(); };

  const createCourse = useCreateCourse();
  const [courseDialog, setCourseDialog] = useState<{ open: boolean; edit?: AdminCourseTree }>({ open: false });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Zarządzanie Kursami</h1>
            <p className="text-muted-foreground mt-1">Struktura i treść materiałów</p>
          </div>
        </div>
        <Button className="rounded-full shadow-md font-bold px-6" onClick={() => setCourseDialog({ open: true })}>
          <Plus className="w-4 h-4 mr-2" /> Dodaj kurs
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {data?.map((course) => (
            <CourseCard key={course.id} course={course} onChanged={onChanged} toast={toast} />
          ))}
          {data?.length === 0 && (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/60">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-bold mb-2">Brak kursów</p>
              <p className="text-muted-foreground">Kliknij "Dodaj kurs" aby rozpocząć.</p>
            </div>
          )}
        </div>
      )}

      <CourseDialog
        state={courseDialog}
        onClose={() => setCourseDialog({ open: false })}
        onChanged={onChanged}
        toast={toast}
        createCourse={createCourse}
      />
    </div>
  );
}

function CourseDialog({ state, onClose, onChanged, toast, createCourse }: {
  state: { open: boolean; edit?: AdminCourseTree };
  onClose: () => void; onChanged: () => void; toast: Toast;
  createCourse: ReturnType<typeof useCreateCourse>;
}) {
  const updateCourse = useUpdateCourse();
  const edit = state.edit;
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (state.open) {
      setTitle(edit?.title ?? "");
      setSlug(edit?.slug ?? "");
      setDescription(edit?.description ?? "");
      setIsPublished(edit?.isPublished ?? false);
      setSlugTouched(!!edit);
    }
  }, [state.open, edit]);

  const submit = () => {
    const payload = { title, slug: slug || slugify(title), description, isPublished };
    if (edit) {
      updateCourse.mutate({ id: edit.id, data: payload }, { ...opts(onChanged, toast, "Zaktualizowano kurs"), onSuccess: () => { onChanged(); toast({ title: "Zaktualizowano kurs" }); onClose(); } });
    } else {
      createCourse.mutate({ data: payload }, { ...opts(onChanged, toast, "Utworzono kurs"), onSuccess: () => { onChanged(); toast({ title: "Utworzono kurs" }); onClose(); } });
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{edit ? "Edytuj kurs" : "Nowy kurs"}</DialogTitle>
          <DialogDescription>Podstawowe informacje o kursie.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tytuł</Label>
            <Input value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className="rounded-xl font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label>Opis</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-xl" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <Label>Opublikowany</Label>
              <p className="text-xs text-muted-foreground">Widoczny dla uczniów</p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
          <Button className="rounded-xl" disabled={!title.trim()} onClick={submit}>{edit ? "Zapisz" : "Utwórz"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseCard({ course, onChanged, toast }: { course: AdminCourseTree; onChanged: () => void; toast: Toast }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sectionDialog, setSectionDialog] = useState(false);
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const createCourse = useCreateCourse();
  const createSection = useCreateSection();
  const setCourseStatus = useSetCourseStatus();

  const togglePublish = (next: boolean) => {
    updateCourse.mutate(
      { id: course.id, data: { title: course.title, slug: course.slug, description: course.description, isPublished: next } },
      opts(onChanged, toast, next ? "Kurs opublikowany" : "Kurs ukryty"),
    );
  };

  const changeStatus = (status: StatusUpdateStatus) => {
    setCourseStatus.mutate({ id: course.id, data: { status } }, opts(onChanged, toast, "Zmieniono status kursu"));
  };

  return (
    <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
      <CardContent className="p-0">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start">
          <button className="flex items-start gap-3 text-left flex-1" onClick={() => setExpanded((e) => !e)}>
            <div className="mt-1 text-muted-foreground">{expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h3 className="text-xl font-bold font-display">{course.title}</h3>
                <Badge variant={course.isPublished ? "default" : "secondary"} className="rounded-md">
                  {course.isPublished ? "Opublikowany" : "Szkic"}
                </Badge>
                <Badge variant={statusBadgeVariant(course.status)} className="rounded-md">
                  {STATUS_LABELS[course.status] ?? course.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">{course.description}</p>
              <div className="flex gap-3 mt-3 text-xs font-medium text-muted-foreground items-center">
                <span>Slug: <span className="bg-muted px-2 py-0.5 rounded font-mono">{course.slug}</span></span>
                <span>{course.sections.length} działów</span>
              </div>
            </div>
          </button>

          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            <StatusSelect value={course.status} onChange={changeStatus} disabled={setCourseStatus.isPending} />
            <div className="flex items-center gap-2 mr-1 px-3 rounded-xl border border-border/60 h-9">
              <span className="text-xs text-muted-foreground">Publikuj</span>
              <Switch checked={course.isPublished} onCheckedChange={togglePublish} />
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-border/60" onClick={() => setEditOpen(true)}>
              <Edit className="w-4 h-4" />
            </Button>
            <ConfirmDelete
              trigger={<Button variant="outline" size="sm" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>}
              title="Usunąć kurs?"
              description="Usunięcie kursu usunie też wszystkie jego działy, tematy i treści. Tej operacji nie można cofnąć."
              onConfirm={() => deleteCourse.mutate({ id: course.id }, opts(onChanged, toast, "Usunięto kurs"))}
            />
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border/50 bg-muted/20 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Działy</h4>
              <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setSectionDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> Dodaj dział
              </Button>
            </div>
            {course.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">Brak działów. Dodaj pierwszy dział.</p>
            ) : (
              <div className="space-y-3">
                {course.sections.map((section) => (
                  <SectionItem key={section.id} section={section} courseId={course.id} onChanged={onChanged} toast={toast} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CourseDialog
        state={{ open: editOpen, edit: course }}
        onClose={() => setEditOpen(false)}
        onChanged={onChanged}
        toast={toast}
        createCourse={createCourse}
      />

      <NodeDialog
        open={sectionDialog}
        onClose={() => setSectionDialog(false)}
        title="Nowy dział"
        onSubmit={(title, slug) => {
          createSection.mutate(
            { data: { courseId: course.id, title, slug, sortOrder: course.sections.length } },
            { onSuccess: () => { onChanged(); toast({ title: "Utworzono dział" }); setSectionDialog(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          );
        }}
      />
    </Card>
  );
}

function NodeDialog({ open, onClose, title, initialTitle = "", initialSlug = "", initialDescription, withDescription = false, onSubmit }: {
  open: boolean; onClose: () => void; title: string;
  initialTitle?: string; initialSlug?: string; initialDescription?: string | null; withDescription?: boolean;
  onSubmit: (title: string, slug: string, description: string) => void;
}) {
  const [t, setT] = useState("");
  const [s, setS] = useState("");
  const [d, setD] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setT(initialTitle); setS(initialSlug); setD(initialDescription ?? "");
      setSlugTouched(!!initialSlug);
    }
  }, [open, initialTitle, initialSlug, initialDescription]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tytuł</Label>
            <Input value={t} onChange={(e) => { setT(e.target.value); if (!slugTouched) setS(slugify(e.target.value)); }} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={s} onChange={(e) => { setS(e.target.value); setSlugTouched(true); }} className="rounded-xl font-mono text-sm" />
          </div>
          {withDescription && (
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea value={d} onChange={(e) => setD(e.target.value)} rows={3} className="rounded-xl" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
          <Button className="rounded-xl" disabled={!t.trim()} onClick={() => onSubmit(t, s || slugify(t), d)}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionItem({ section, courseId, onChanged, toast }: { section: AdminSectionTree; courseId: number; onChanged: () => void; toast: Toast }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createTopic = useCreateTopic();
  const setSectionStatus = useSetSectionStatus();

  const changeStatus = (status: StatusUpdateStatus) => {
    setSectionStatus.mutate({ id: section.id, data: { status } }, opts(onChanged, toast, "Zmieniono status działu"));
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 sm:p-4 gap-2">
        <button className="flex items-center gap-2 text-left flex-1" onClick={() => setExpanded((e) => !e)}>
          <span className="text-muted-foreground">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          <span className="font-bold">{section.title}</span>
          <Badge variant="outline" className="rounded-md text-xs">{section.topics.length} tematów</Badge>
          <Badge variant={statusBadgeVariant(section.status)} className="rounded-md text-xs">{STATUS_LABELS[section.status] ?? section.status}</Badge>
        </button>
        <div className="flex gap-1.5 shrink-0 items-center">
          <StatusSelect value={section.status} onChange={changeStatus} disabled={setSectionStatus.isPending} />
          <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={() => setEditOpen(true)}><Edit className="w-3.5 h-3.5" /></Button>
          <ConfirmDelete
            trigger={<Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
            title="Usunąć dział?"
            description="Usunie też wszystkie tematy w tym dziale."
            onConfirm={() => deleteSection.mutate({ id: section.id }, opts(onChanged, toast, "Usunięto dział"))}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tematy</h5>
            <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => setTopicOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj temat
            </Button>
          </div>
          {section.topics.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-3 text-center">Brak tematów.</p>
          ) : (
            <div className="space-y-2">
              {section.topics.map((topic) => (
                <TopicItem key={topic.id} topic={topic} onChanged={onChanged} toast={toast} />
              ))}
            </div>
          )}
        </div>
      )}

      <NodeDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edytuj dział"
        initialTitle={section.title}
        initialSlug={section.slug}
        onSubmit={(title, slug) => updateSection.mutate(
          { id: section.id, data: { courseId, title, slug, sortOrder: section.sortOrder } },
          { onSuccess: () => { onChanged(); toast({ title: "Zaktualizowano dział" }); setEditOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
        )}
      />
      <NodeDialog
        open={topicOpen}
        onClose={() => setTopicOpen(false)}
        title="Nowy temat"
        withDescription
        onSubmit={(title, slug, description) => createTopic.mutate(
          { data: { sectionId: section.id, title, slug, description: description || undefined, sortOrder: section.topics.length } },
          { onSuccess: () => { onChanged(); toast({ title: "Utworzono temat" }); setTopicOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
        )}
      />
    </div>
  );
}

function TopicItem({ topic, onChanged, toast }: { topic: AdminTopicTree; onChanged: () => void; toast: Toast }) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const setTopicStatus = useSetTopicStatus();

  const changeStatus = (status: StatusUpdateStatus) => {
    setTopicStatus.mutate({ id: topic.id, data: { status } }, opts(onChanged, toast, "Zmieniono status tematu"));
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center justify-between p-3 gap-2">
        <button className="flex items-center gap-2 text-left flex-1" onClick={() => setExpanded((e) => !e)}>
          <span className="text-muted-foreground">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</span>
          <span className="font-semibold text-sm">{topic.title}</span>
          <div className="flex gap-1 flex-wrap">
            <Badge variant={statusBadgeVariant(topic.status)} className="rounded text-[10px]">{STATUS_LABELS[topic.status] ?? topic.status}</Badge>
            {topic.video && <Badge variant="outline" className="rounded text-[10px] gap-1"><VideoIcon className="w-3 h-3" />Wideo</Badge>}
            {topic.quiz && <Badge variant="outline" className="rounded text-[10px] gap-1"><ListChecks className="w-3 h-3" />Quiz</Badge>}
            {topic.tasks.length > 0 && <Badge variant="outline" className="rounded text-[10px] gap-1"><ClipboardList className="w-3 h-3" />{topic.tasks.length}</Badge>}
          </div>
        </button>
        <div className="flex gap-1.5 shrink-0 items-center">
          <StatusSelect value={topic.status} onChange={changeStatus} disabled={setTopicStatus.isPending} />
          <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={() => setEditOpen(true)}><Edit className="w-3.5 h-3.5" /></Button>
          <ConfirmDelete
            trigger={<Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
            title="Usunąć temat?"
            description="Usunie też wideo, quiz i zadania powiązane z tym tematem."
            onConfirm={() => deleteTopic.mutate({ id: topic.id }, opts(onChanged, toast, "Usunięto temat"))}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-3 sm:p-4">
          <Tabs defaultValue="video">
            <TabsList className="rounded-xl">
              <TabsTrigger value="video" className="rounded-lg gap-1"><VideoIcon className="w-3.5 h-3.5" />Wideo</TabsTrigger>
              <TabsTrigger value="quiz" className="rounded-lg gap-1"><ListChecks className="w-3.5 h-3.5" />Quiz</TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-lg gap-1"><ClipboardList className="w-3.5 h-3.5" />Zadania</TabsTrigger>
            </TabsList>
            <TabsContent value="video" className="pt-4"><VideoEditor topicId={topic.id} video={topic.video ?? null} onChanged={onChanged} toast={toast} /></TabsContent>
            <TabsContent value="quiz" className="pt-4"><QuizEditor topicId={topic.id} quiz={topic.quiz ?? null} onChanged={onChanged} toast={toast} /></TabsContent>
            <TabsContent value="tasks" className="pt-4"><TasksEditor topicId={topic.id} tasks={topic.tasks} onChanged={onChanged} toast={toast} /></TabsContent>
          </Tabs>
        </div>
      )}

      <NodeDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edytuj temat"
        initialTitle={topic.title}
        initialSlug={topic.slug}
        initialDescription={topic.description}
        withDescription
        onSubmit={(title, slug, description) => updateTopic.mutate(
          { id: topic.id, data: { sectionId: topic.sectionId, title, slug, description: description || undefined, sortOrder: topic.sortOrder } },
          { onSuccess: () => { onChanged(); toast({ title: "Zaktualizowano temat" }); setEditOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
        )}
      />
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
        <Button size="sm" className="rounded-lg" disabled={!title.trim()} onClick={save}><Save className="w-3.5 h-3.5 mr-1" />{video ? "Zapisz" : "Dodaj wideo"}</Button>
      </div>
    </div>
  );
}

function QuizEditor({ topicId, quiz, onChanged, toast }: { topicId: number; quiz: Quiz | null; onChanged: () => void; toast: Toast }) {
  const createQuiz = useCreateQuiz();
  const deleteQuiz = useDeleteQuiz();
  const createQuestion = useCreateQuizQuestion();
  const setQuizStatus = useSetQuizStatus();
  const [quizTitle, setQuizTitle] = useState("Quiz");
  const [preview, setPreview] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);

  const changeStatus = (status: StatusUpdateStatus) => {
    if (!quiz) return;
    setQuizStatus.mutate({ id: quiz.id, data: { status } }, opts(onChanged, toast, "Zmieniono status quizu"));
  };

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

  return (
    <div className="space-y-4">
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
          <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => setQuestionOpen(true)} disabled={preview}>
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

      {preview && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 flex items-center gap-2 text-xs text-primary font-medium">
          <GraduationCap className="w-4 h-4" /> Podgląd ucznia — poprawne odpowiedzi są ukryte.
        </div>
      )}

      {quiz.questions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-4">Brak pytań.</p>
      ) : (
        <div className="space-y-3">
          {quiz.questions.map((q, idx) => (
            <QuestionItem key={q.id} question={q} index={idx} preview={preview} onChanged={onChanged} toast={toast} />
          ))}
        </div>
      )}

      <Dialog open={questionOpen} onOpenChange={(o) => { if (!o) setQuestionOpen(false); }}>
        <QuestionDialogBody
          open={questionOpen}
          title="Nowe pytanie"
          onClose={() => setQuestionOpen(false)}
          onSubmit={(text) => createQuestion.mutate(
            { id: quiz.id, data: { questionText: text, sortOrder: quiz.questions.length } },
            { onSuccess: () => { onChanged(); toast({ title: "Dodano pytanie" }); setQuestionOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          )}
        />
      </Dialog>
    </div>
  );
}

function QuestionDialogBody({ open, title, initialText = "", onClose, onSubmit }: { open: boolean; title: string; initialText?: string; onClose: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState(initialText);
  useEffect(() => { if (open) setText(initialText); }, [open, initialText]);
  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="space-y-2 py-2">
        <Label>Treść pytania</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-xl" />
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!text.trim()} onClick={() => onSubmit(text)}>Zapisz</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function QuestionItem({ question, index, preview, onChanged, toast }: {
  question: Quiz["questions"][number]; index: number; preview: boolean; onChanged: () => void; toast: Toast;
}) {
  const updateQuestion = useUpdateQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();
  const createAnswer = useCreateQuizAnswer();
  const updateAnswer = useUpdateQuizAnswer();
  const deleteAnswer = useDeleteQuizAnswer();
  const [editOpen, setEditOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);

  const setCorrect = (answerId: number) => {
    const ans = question.answers.find((a) => a.id === answerId);
    if (!ans) return;
    updateAnswer.mutate(
      { answerId, data: { answerLabel: ans.answerLabel, answerText: ans.answerText, isCorrect: true } },
      opts(onChanged, toast, "Ustawiono poprawną odpowiedź"),
    );
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm"><span className="text-muted-foreground mr-1">{index + 1}.</span>{question.questionText}</p>
        {!preview && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => setEditOpen(true)}><Edit className="w-3.5 h-3.5" /></Button>
            <ConfirmDelete
              trigger={<Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
              title="Usunąć pytanie?"
              description="Usunie pytanie i jego odpowiedzi."
              onConfirm={() => deleteQuestion.mutate({ questionId: question.id }, opts(onChanged, toast, "Usunięto pytanie"))}
            />
          </div>
        )}
      </div>

      <RadioGroup
        value={preview ? "" : String(question.answers.find((a) => a.isCorrect)?.id ?? "")}
        onValueChange={(v) => { if (!preview) setCorrect(Number(v)); }}
        className="space-y-1.5"
      >
        {question.answers.map((a) => (
          <div key={a.id} className={`flex items-center gap-2 rounded-lg border p-2 text-sm
            ${!preview && a.isCorrect ? "border-success/40 bg-success/5" : "border-border/50"}`}>
            {!preview && <RadioGroupItem value={String(a.id)} id={`a-${a.id}`} />}
            <span className="font-mono font-bold text-xs w-5">{a.answerLabel}</span>
            <span className="flex-1">{a.answerText}</span>
            {!preview && a.isCorrect && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
            {!preview && (
              <ConfirmDelete
                trigger={<Button variant="ghost" size="sm" className="rounded h-6 w-6 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3 h-3" /></Button>}
                title="Usunąć odpowiedź?"
                description="Tej operacji nie można cofnąć."
                onConfirm={() => deleteAnswer.mutate({ answerId: a.id }, opts(onChanged, toast, "Usunięto odpowiedź"))}
              />
            )}
          </div>
        ))}
      </RadioGroup>

      {!preview && (
        <Button variant="outline" size="sm" className="rounded-lg w-full border-dashed" onClick={() => setAnswerOpen(true)} disabled={question.answers.length >= LETTERS.length}>
          <Plus className="w-3.5 h-3.5 mr-1" />Dodaj odpowiedź
        </Button>
      )}

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false); }}>
        <QuestionDialogBody
          open={editOpen}
          title="Edytuj pytanie"
          initialText={question.questionText}
          onClose={() => setEditOpen(false)}
          onSubmit={(text) => updateQuestion.mutate(
            { questionId: question.id, data: { questionText: text, sortOrder: question.sortOrder } },
            { onSuccess: () => { onChanged(); toast({ title: "Zaktualizowano pytanie" }); setEditOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          )}
        />
      </Dialog>

      <Dialog open={answerOpen} onOpenChange={(o) => { if (!o) setAnswerOpen(false); }}>
        <AnswerDialogBody
          open={answerOpen}
          nextLabel={LETTERS[question.answers.length] ?? "?"}
          hasCorrect={question.answers.some((a) => a.isCorrect)}
          onClose={() => setAnswerOpen(false)}
          onSubmit={(answerText, isCorrect) => createAnswer.mutate(
            { questionId: question.id, data: { answerLabel: LETTERS[question.answers.length] ?? "?", answerText, isCorrect } },
            { onSuccess: () => { onChanged(); toast({ title: "Dodano odpowiedź" }); setAnswerOpen(false); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
          )}
        />
      </Dialog>
    </div>
  );
}

function AnswerDialogBody({ open, nextLabel, hasCorrect, onClose, onSubmit }: { open: boolean; nextLabel: string; hasCorrect: boolean; onClose: () => void; onSubmit: (text: string, isCorrect: boolean) => void }) {
  const [text, setText] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  useEffect(() => { if (open) { setText(""); setIsCorrect(false); } }, [open]);
  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>Nowa odpowiedź ({nextLabel})</DialogTitle>
        <DialogDescription>Tylko jedna odpowiedź w pytaniu może być poprawna.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div className="space-y-2">
          <Label>Treść odpowiedzi</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="ans-correct" checked={isCorrect} onCheckedChange={(c) => setIsCorrect(!!c)} />
          <Label htmlFor="ans-correct" className="cursor-pointer">Poprawna odpowiedź {hasCorrect && isCorrect ? "(zastąpi obecną)" : ""}</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!text.trim()} onClick={() => onSubmit(text, isCorrect)}>Dodaj</Button>
      </DialogFooter>
    </DialogContent>
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

function TaskDialogBody({ open, edit, onClose, onSubmit }: {
  open: boolean;
  edit?: Task;
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
      <DialogHeader><DialogTitle>{edit ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle></DialogHeader>
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
        <Button className="rounded-xl" disabled={!title.trim()} onClick={() => onSubmit({
          title,
          description: description || undefined,
          initialImageUrl: imageUrl || undefined,
          aiPromptConfig: systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : undefined,
        })}>{edit ? "Zapisz" : "Dodaj"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
