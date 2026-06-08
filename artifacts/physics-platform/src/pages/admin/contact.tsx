import { useState } from "react";
import {
  useListContactMessages,
  useUpdateContactMessage,
  ListContactMessagesStatus,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, CheckCircle2, Inbox, Reply, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const LIMIT = 10;
const ALL = "all";

const STATUS_LABEL: Record<string, string> = {
  new: "Nowa",
  read: "Przeczytana",
  replied: "Odpisano",
  closed: "Zamknięta",
};

const STATUS_BADGE: Record<string, string> = {
  new: "bg-primary/20 text-primary",
  read: "bg-amber-500/20 text-amber-600",
  replied: "bg-success/20 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function AdminContact() {
  const { toast } = useToast();
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useListContactMessages({
    status: status === ALL ? undefined : (status as ListContactMessagesStatus),
    page,
    limit: LIMIT,
  });
  const updateStatus = useUpdateContactMessage();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const setMsgStatus = (id: number, next: "read" | "replied" | "closed") => {
    updateStatus.mutate(
      { id, data: { status: next } },
      {
        onSuccess: () => { refetch(); toast({ title: `Status zmieniony na: ${STATUS_LABEL[next]}` }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zmienić statusu.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Wiadomości Otrzymane</h1>
          <p className="text-muted-foreground mt-1">Zgłoszenia z formularza kontaktowego</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-[240px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
            <Filter className="w-4 h-4" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-11 pl-9 rounded-xl bg-card border-border/50 shadow-sm">
              <SelectValue placeholder="Filtruj status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value={ALL}>Wszystkie</SelectItem>
              <SelectItem value="new">Nowe</SelectItem>
              <SelectItem value="read">Przeczytane</SelectItem>
              <SelectItem value="replied">Odpisane</SelectItem>
              <SelectItem value="closed">Zamknięte</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">{total} {total === 1 ? "wiadomość" : "wiadomości"}</span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.messages.map((msg) => (
            <Card key={msg.id} className={`rounded-3xl border shadow-sm overflow-hidden transition-colors
              ${msg.status === 'new' ? 'border-primary/30 bg-primary/[0.02]' : 'border-border bg-card'}`}>
              <CardContent className="p-0">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_BADGE[msg.status] ?? STATUS_BADGE.closed}`}>
                          {STATUS_LABEL[msg.status] ?? msg.status}
                        </span>
                        <h3 className="text-xl font-bold font-display">{msg.subject}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground font-medium">
                        <span>{msg.name}</span>
                        <span>•</span>
                        <a href={`mailto:${msg.email}`} className="hover:text-primary hover:underline">{msg.email}</a>
                        <span>•</span>
                        <span>{format(new Date(msg.createdAt), "dd MMM yyyy, HH:mm", { locale: pl })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-2xl p-5 border border-border/50 text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {msg.message}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3 border-t border-border/50 pt-6">
                    {msg.status === "new" && (
                      <Button variant="outline" className="rounded-full font-semibold border-primary/30 hover:bg-primary/10 text-primary"
                        disabled={updateStatus.isPending}
                        onClick={() => setMsgStatus(msg.id, "read")}>
                        <Inbox className="w-4 h-4 mr-2" /> Oznacz jako przeczytane
                      </Button>
                    )}
                    {msg.status !== "replied" && msg.status !== "closed" && (
                      <Button variant="outline" className="rounded-full font-semibold border-success/30 hover:bg-success/10 text-success"
                        disabled={updateStatus.isPending}
                        onClick={() => setMsgStatus(msg.id, "replied")}>
                        <Reply className="w-4 h-4 mr-2" /> Oznacz jako odpisane
                      </Button>
                    )}
                    {msg.status !== "closed" && (
                      <Button variant="secondary" className="rounded-full font-semibold"
                        disabled={updateStatus.isPending}
                        onClick={() => setMsgStatus(msg.id, "closed")}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-muted-foreground" /> Zamknij zgłoszenie
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.messages.length === 0 && (
            <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border/60">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-bold mb-2">Brak wiadomości</p>
              <p className="text-muted-foreground">Brak zgłoszeń dla wybranego filtra.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">Strona {page} z {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-full px-4 border-border/60">
                <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full px-4 border-border/60">
                Następna <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
