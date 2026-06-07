import { useListContactMessages, useUpdateContactMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, Inbox } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminContact() {
  const { data, isLoading, refetch } = useListContactMessages({});
  const updateStatus = useUpdateContactMessage();

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

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.map(msg => (
            <Card key={msg.id} className={`rounded-3xl border shadow-sm overflow-hidden transition-colors
              ${msg.status === 'new' ? 'border-primary/30 bg-primary/[0.02]' : 'border-border bg-card'}`}>
              <CardContent className="p-0">
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0
                          ${msg.status === 'new' ? 'bg-primary/20 text-primary' : 
                            msg.status === 'read' ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                          {msg.status === 'new' ? 'Nowa' : msg.status === 'read' ? 'Przeczytana' : 'Zamknięta'}
                        </span>
                        <h3 className="text-xl font-bold font-display">{msg.subject}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
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
                    {msg.status !== 'read' && msg.status !== 'closed' && (
                      <Button variant="outline" className="rounded-full font-semibold border-primary/30 hover:bg-primary/10 text-primary" 
                        onClick={() => updateStatus.mutate({ id: msg.id, data: { status: 'read' } }, { onSuccess: () => refetch() })}>
                        <Inbox className="w-4 h-4 mr-2" /> Oznacz jako przeczytane
                      </Button>
                    )}
                    {msg.status !== 'closed' && (
                      <Button variant="secondary" className="rounded-full font-semibold" 
                        onClick={() => updateStatus.mutate({ id: msg.id, data: { status: 'closed' } }, { onSuccess: () => refetch() })}>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-muted-foreground" /> Zamknij zgłoszenie
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.length === 0 && (
            <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border/60">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-xl font-bold mb-2">Brak wiadomości</p>
              <p className="text-muted-foreground">Skrzynka odbiorcza jest pusta.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
