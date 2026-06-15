import { useEffect, useState } from "react";
import {
  useListFaqItems,
  useCreateFaqItem,
  useUpdateFaqItem,
  useDeleteFaqItem,
  useToggleFaqItem,
  useReorderFaqItems,
} from "@workspace/api-client-react";
import type { FaqItem } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, Plus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";

type Toast = ReturnType<typeof useToast>["toast"];

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

export default function AdminFaq() {
  const { data, isLoading, refetch } = useListFaqItems();
  const { toast } = useToast();
  const onChanged = () => { refetch(); };

  const createFaq = useCreateFaqItem();
  const reorderFaq = useReorderFaqItems();

  const items = (data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const addItem = () => {
    createFaq.mutate(
      { data: { question: "Nowe pytanie", answer: "", sortOrder: items.length, isVisible: true } },
      {
        onSuccess: () => { onChanged(); toast({ title: "Dodano pytanie" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się dodać pytania.", variant: "destructive" }),
      },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    const reordered = items.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved);
    reorderFaq.mutate(
      { data: { ids: reordered.map((i) => i.id) } },
      {
        onSuccess: () => { onChanged(); toast({ title: "Zmieniono kolejność" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zmienić kolejności.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-foreground">FAQ</h1>
            <p className="text-muted-foreground mt-1">Najczęściej zadawane pytania</p>
          </div>
        </div>
        <Button className="rounded-full shadow-md font-bold px-6" onClick={addItem} disabled={createFaq.isPending}>
          <Plus className="w-4 h-4 mr-2" /> Dodaj pytanie
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/60">
          <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-xl font-bold mb-2">Brak pytań</p>
          <p className="text-muted-foreground">Kliknij "Dodaj pytanie" aby rozpocząć.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <FaqItemCard
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              onChanged={onChanged}
              toast={toast}
              onMove={move}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FaqItemCard({ item, index, total, onChanged, toast, onMove }: {
  item: FaqItem; index: number; total: number; onChanged: () => void; toast: Toast;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const updateFaq = useUpdateFaqItem();
  const deleteFaq = useDeleteFaqItem();
  const toggleFaq = useToggleFaqItem();
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);

  useEffect(() => {
    setQuestion(item.question);
    setAnswer(item.answer);
  }, [item.id, item.question, item.answer]);

  const save = () => {
    updateFaq.mutate(
      { id: item.id, data: { question, answer } },
      {
        onSuccess: () => { onChanged(); toast({ title: "Zapisano pytanie" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zapisać.", variant: "destructive" }),
      },
    );
  };

  const toggle = (next: boolean) => {
    toggleFaq.mutate(
      { id: item.id, data: { isVisible: next } },
      {
        onSuccess: () => { onChanged(); toast({ title: next ? "Pytanie widoczne" : "Pytanie ukryte" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zmienić widoczności.", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" disabled={index === 0} onClick={() => onMove(index, -1)}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Pytanie</Label>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Odpowiedź</Label>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} className="rounded-xl" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/50">
          <div className="flex items-center gap-2 mt-3">
            <Switch checked={item.isVisible} onCheckedChange={toggle} />
            <span className="text-xs text-muted-foreground">{item.isVisible ? "Widoczne" : "Ukryte"}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <ConfirmDelete
              trigger={<Button variant="outline" size="sm" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4 mr-1" />Usuń</Button>}
              title="Usunąć pytanie?"
              description="Tej operacji nie można cofnąć."
              onConfirm={() => deleteFaq.mutate({ id: item.id }, {
                onSuccess: () => { onChanged(); toast({ title: "Usunięto pytanie" }); },
                onError: () => toast({ title: "Błąd", description: "Nie udało się usunąć.", variant: "destructive" }),
              })}
            />
            <Button size="sm" className="rounded-xl" onClick={save} disabled={updateFaq.isPending}>
              <Save className="w-4 h-4 mr-1" />Zapisz
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
