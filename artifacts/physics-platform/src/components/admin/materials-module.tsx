import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import {
  useListLessonImages, useCreateLessonImage, useUpdateLessonImage,
  useDeleteLessonImage, useReorderLessonImages,
} from "@workspace/api-client-react";
import type { LessonImage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, ImageIcon, GripVertical, Star, Save } from "lucide-react";
import { Toast, opts, ConfirmDelete } from "./shared";

export function MaterialsModule({ topicId, onChanged, toast }: {
  topicId: number; onChanged: () => void; toast: Toast;
}) {
  const { data: images, refetch } = useListLessonImages(topicId);
  const createImage = useCreateLessonImage();
  const updateImage = useUpdateLessonImage();
  const deleteImage = useDeleteLessonImage();
  const reorderImages = useReorderLessonImages();
  const [dialog, setDialog] = useState<{ open: boolean; edit?: LessonImage }>({ open: false });
  const [order, setOrder] = useState<number[]>([]);

  const refresh = () => { refetch(); onChanged(); };

  useEffect(() => {
    setOrder((images ?? []).map((i) => i.id));
  }, [(images ?? []).map((i) => i.id).join(",")]);

  const ordered = order
    .map((id) => (images ?? []).find((i) => i.id === id))
    .filter((i): i is LessonImage => !!i);

  const commitOrder = (ids: number[]) => {
    setOrder(ids);
    reorderImages.mutate({ data: { ids } }, opts(refresh, toast, "Zmieniono kolejność materiałów"));
  };

  const setMain = (id: number) => {
    // "Main image" = first in order; move the chosen image to the front.
    const ids = [id, ...order.filter((x) => x !== id)];
    commitOrder(ids);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Materiały (obrazy)</h5>
        <Button size="sm" variant="secondary" className="rounded-full h-8" onClick={() => setDialog({ open: true })}>
          <Plus className="w-3.5 h-3.5 mr-1" />Dodaj obraz
        </Button>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center space-y-2">
          <ImageIcon className="w-7 h-7 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">Brak materiałów graficznych w tej lekcji.</p>
        </div>
      ) : (
        <Reorder.Group axis="y" values={order} onReorder={commitOrder} className="space-y-2">
          {ordered.map((img, idx) => (
            <Reorder.Item key={img.id} value={img.id} className="list-none">
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-2.5">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />
                <img src={img.imageUrl} alt={img.alt ?? ""} className="w-16 h-16 rounded-lg object-cover border border-border/50 bg-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {idx === 0 && <Badge variant="default" className="rounded text-[10px] gap-1"><Star className="w-3 h-3" />Główny</Badge>}
                    <p className="text-xs text-muted-foreground truncate">{img.alt || "(bez opisu)"}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 truncate font-mono mt-0.5">{img.imageUrl}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {idx !== 0 && (
                    <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => setMain(img.id)} aria-label="Ustaw jako główny"><Star className="w-3.5 h-3.5" /></Button>
                  )}
                  <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" onClick={() => setDialog({ open: true, edit: img })} aria-label="Edytuj"><Edit className="w-3.5 h-3.5" /></Button>
                  <ConfirmDelete
                    trigger={<Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5" /></Button>}
                    title="Usunąć obraz?"
                    description="Materiał zostanie odłączony od lekcji."
                    onConfirm={() => deleteImage.mutate({ id: img.id }, opts(refresh, toast, "Usunięto obraz"))}
                  />
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => { if (!o) setDialog({ open: false }); }}>
        <ImageDialogBody
          open={dialog.open}
          edit={dialog.edit}
          onClose={() => setDialog({ open: false })}
          onSubmit={(imageUrl, alt) => {
            if (dialog.edit) {
              updateImage.mutate(
                { id: dialog.edit.id, data: { imageUrl, alt: alt || null } },
                { onSuccess: () => { refresh(); toast({ title: "Zapisano obraz" }); setDialog({ open: false }); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
              );
            } else {
              createImage.mutate(
                { data: { topicId, imageUrl, alt: alt || null, sortOrder: ordered.length } },
                { onSuccess: () => { refresh(); toast({ title: "Dodano obraz" }); setDialog({ open: false }); }, onError: () => toast({ title: "Błąd", variant: "destructive" }) },
              );
            }
          }}
        />
      </Dialog>
    </div>
  );
}

function ImageDialogBody({ open, edit, onClose, onSubmit }: {
  open: boolean; edit?: LessonImage; onClose: () => void;
  onSubmit: (imageUrl: string, alt: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [alt, setAlt] = useState("");

  useEffect(() => {
    if (open) {
      setImageUrl(edit?.imageUrl ?? "");
      setAlt(edit?.alt ?? "");
    }
  }, [open, edit]);

  const onFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle>{edit ? "Edytuj obraz" : "Nowy obraz"}</DialogTitle>
        <DialogDescription>Wklej adres URL obrazu lub wgraj plik (do 4 MB).</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>URL obrazu</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl font-mono text-sm" />
        </div>
        <div className="space-y-2">
          <Label>Lub wgraj plik</Label>
          <Input type="file" accept="image/*" className="rounded-xl" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </div>
        {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-48 object-contain rounded-xl border border-border/50 bg-muted" />}
        <div className="space-y-2">
          <Label>Opis (alt)</Label>
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} className="rounded-xl" placeholder="Opis obrazu dla dostępności" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Anuluj</Button>
        <Button className="rounded-xl" disabled={!imageUrl.trim()} onClick={() => onSubmit(imageUrl.trim(), alt.trim())}>
          <Save className="w-3.5 h-3.5 mr-1" />{edit ? "Zapisz" : "Dodaj"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
