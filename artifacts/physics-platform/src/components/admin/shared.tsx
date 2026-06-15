import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusUpdateStatus } from "@workspace/api-client-react";

export type Toast = ReturnType<typeof useToast>["toast"];

export const LETTERS = ["A", "B", "C", "D"];

/** Standard mutation callbacks: refetch + success toast, or a generic error toast. */
export function opts(onChanged: () => void, toast: Toast, successMsg: string) {
  return {
    onSuccess: () => { onChanged(); toast({ title: successMsg }); },
    onError: () => toast({ title: "Błąd", description: "Operacja nie powiodła się.", variant: "destructive" as const }),
  };
}

export function ConfirmDelete({ trigger, title, description, onConfirm }: {
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

export const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  published: "Opublikowany",
  hidden: "Ukryty",
  archived: "Zarchiwizowany",
};

export function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "published") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

export function StatusSelect({ value, onChange, disabled }: {
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

export const ACCESS_TYPE_LABELS: Record<string, string> = {
  free: "Darmowy (podgląd)",
  paid: "Płatny",
  admin: "Tylko administrator",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Łatwy",
  medium: "Średni",
  hard: "Trudny",
};

/** Up/down move buttons used alongside drag handles for accessible reordering. */
export function MoveButtons({ onUp, onDown, disableUp, disableDown }: {
  onUp: () => void; onDown: () => void; disableUp?: boolean; disableDown?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <Button variant="ghost" size="sm" className="rounded h-5 w-6 p-0" onClick={onUp} disabled={disableUp} aria-label="W górę">
        <span className="text-xs">▲</span>
      </Button>
      <Button variant="ghost" size="sm" className="rounded h-5 w-6 p-0" onClick={onDown} disabled={disableDown} aria-label="W dół">
        <span className="text-xs">▼</span>
      </Button>
    </div>
  );
}
