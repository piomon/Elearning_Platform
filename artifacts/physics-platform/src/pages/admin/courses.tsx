import { useEffect, useState } from "react";
import {
  useListAdminCourses,
  useCreateCourse, useUpdateCourse, useDeleteCourse,
  useCreateSection, useUpdateSection, useDeleteSection,
  useCreateTopic, useDeleteTopic,
  useSetCourseStatus, useSetSectionStatus, useSetTopicStatus,
  StatusUpdateStatus,
} from "@workspace/api-client-react";
import type { AdminCourseTree, AdminSectionTree, AdminTopicTree } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@/lib/utils";
import {
  BookOpen, Edit, Trash2, Plus, ChevronRight, ChevronDown, Video as VideoIcon,
  ListChecks, ClipboardList, GraduationCap, Image as ImageIcon, Eye,
} from "lucide-react";
import {
  Toast, opts, ConfirmDelete, STATUS_LABELS, statusBadgeVariant, StatusSelect,
} from "@/components/admin/shared";
import { LessonEditorDialog } from "@/components/admin/lesson-editor";

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
            <Button variant="outline" size="sm" className="rounded-xl border-border/60" asChild title="Podgląd jako uczeń">
              <a href={`/courses/${course.slug}?preview=${course.id}`} target="_blank" rel="noopener noreferrer">
                <Eye className="w-4 h-4" />
              </a>
            </Button>
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
  const [editorOpen, setEditorOpen] = useState(false);
  const deleteTopic = useDeleteTopic();
  const setTopicStatus = useSetTopicStatus();

  const changeStatus = (status: StatusUpdateStatus) => {
    setTopicStatus.mutate({ id: topic.id, data: { status } }, opts(onChanged, toast, "Zmieniono status tematu"));
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center justify-between p-3 gap-2">
        <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={() => setEditorOpen(true)}>
          <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">{topic.title}</span>
          <div className="flex gap-1 flex-wrap shrink-0">
            <Badge variant={statusBadgeVariant(topic.status)} className="rounded text-[10px]">{STATUS_LABELS[topic.status] ?? topic.status}</Badge>
            {topic.video && <Badge variant="outline" className="rounded text-[10px] gap-1"><VideoIcon className="w-3 h-3" />Wideo</Badge>}
            {(topic.images?.length ?? 0) > 0 && <Badge variant="outline" className="rounded text-[10px] gap-1"><ImageIcon className="w-3 h-3" />{topic.images!.length}</Badge>}
            {topic.quiz && <Badge variant="outline" className="rounded text-[10px] gap-1"><ListChecks className="w-3 h-3" />Quiz</Badge>}
            {topic.tasks.length > 0 && <Badge variant="outline" className="rounded text-[10px] gap-1"><ClipboardList className="w-3 h-3" />{topic.tasks.length}</Badge>}
          </div>
        </button>
        <div className="flex gap-1.5 shrink-0 items-center">
          <StatusSelect value={topic.status} onChange={changeStatus} disabled={setTopicStatus.isPending} />
          <Button variant="outline" size="sm" className="rounded-lg h-8" onClick={() => setEditorOpen(true)}><Edit className="w-3.5 h-3.5 mr-1" />Edytuj</Button>
          <ConfirmDelete
            trigger={<Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
            title="Usunąć temat?"
            description="Usunie też wideo, quiz i zadania powiązane z tym tematem."
            onConfirm={() => deleteTopic.mutate({ id: topic.id }, opts(onChanged, toast, "Usunięto temat"))}
          />
        </div>
      </div>

      <LessonEditorDialog topic={topic} open={editorOpen} onClose={() => setEditorOpen(false)} onChanged={onChanged} toast={toast} />
    </div>
  );
}
