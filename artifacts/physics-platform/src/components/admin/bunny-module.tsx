import { useState } from "react";
import {
  useListBunnyLibrary, useBunnyDiagnostics, useAssignBunnyVideo, useSyncBunnyVideos,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Toast, opts } from "./shared";
import { Video as VideoIcon, RefreshCw, Link2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

function statusColor(available?: boolean) {
  return available ? "text-success" : "text-amber-500";
}

/** Compact Bunny picker used inside the lesson Wideo tab: assigns a library video
 *  or a manually-entered id/guid/embed URL to this topic. */
export function BunnyAssignPanel({ topicId, onAssigned, toast }: {
  topicId: number; onAssigned: () => void; toast: Toast;
}) {
  const { data: library, isLoading } = useListBunnyLibrary();
  const assign = useAssignBunnyVideo();
  const [manual, setManual] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  const assignSource = (source: string, title?: string) => {
    assign.mutate(
      { data: { topicId, source, title } },
      opts(onAssigned, toast, "Przypisano wideo do lekcji"),
    );
  };

  if (!library?.configured && !isLoading) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Bunny.net nie jest skonfigurowany</p>
          <p className="text-xs mt-1 text-muted-foreground">Możesz ręcznie podać ID / GUID / URL embed wideo poniżej. Biblioteka będzie dostępna po dodaniu kluczy Bunny w zmiennych środowiskowych serwera.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
        <Label className="text-xs">Przypisz ręcznie (ID, GUID lub URL embed)</Label>
        <div className="flex gap-2 flex-wrap">
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="np. abc-123 lub https://iframe.mediadelivery.net/embed/..." className="rounded-lg font-mono text-sm flex-1 min-w-[200px]" />
          <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Tytuł (opcjonalnie)" className="rounded-lg text-sm w-40" />
          <Button size="sm" className="rounded-lg shrink-0" disabled={!manual.trim() || assign.isPending} onClick={() => assignSource(manual.trim(), manualTitle.trim() || undefined)}>
            <Link2 className="w-3.5 h-3.5 mr-1" />Przypisz
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Biblioteka Bunny.net</Label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Ładowanie biblioteki…</div>
        ) : (library?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-3">Biblioteka jest pusta.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {library!.items.map((v) => (
              <div key={v.guid} className="rounded-xl border border-border/60 bg-background p-2.5 flex gap-2.5">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="w-20 h-14 rounded-lg object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-20 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><VideoIcon className="w-5 h-5 text-muted-foreground/40" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{v.title}</p>
                  <p className={`text-[11px] ${statusColor(v.available)}`}>{v.statusLabel}</p>
                  {v.assignedTopicId && <Badge variant="outline" className="rounded text-[9px] mt-1">Przypisane: {v.assignedTopicTitle}</Badge>}
                  <Button size="sm" variant="secondary" className="rounded-lg h-6 text-[11px] mt-1.5 w-full" disabled={assign.isPending} onClick={() => assignSource(v.guid, v.title)}>
                    Przypisz do lekcji
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-page Bunny diagnostics & library view (admin → Wideo). */
export function BunnyDiagnosticsView({ toast }: { toast: Toast }) {
  const { data: diag, isLoading, refetch } = useBunnyDiagnostics();
  const { data: library, refetch: refetchLib } = useListBunnyLibrary();
  const sync = useSyncBunnyVideos();

  const runSync = () => {
    sync.mutate(undefined, {
      onSuccess: (res) => { toast({ title: `Zsynchronizowano (${res.updated} zaktualizowanych)` }); refetch(); refetchLib(); },
      onError: () => toast({ title: "Błąd", description: "Synchronizacja nie powiodła się.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {diag?.configured ? (
            <Badge variant="default" className="rounded gap-1"><CheckCircle2 className="w-3 h-3" />Bunny skonfigurowany</Badge>
          ) : (
            <Badge variant="secondary" className="rounded gap-1"><AlertTriangle className="w-3 h-3" />Brak konfiguracji Bunny</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={runSync} disabled={sync.isPending || !diag?.configured}>
          {sync.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Synchronizuj metadane
        </Button>
      </div>

      {isLoading ? (
        <div className="h-40 bg-muted animate-pulse rounded-2xl" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Wideo bez przypisanej lekcji</h3>
              {(diag?.orphanVideos.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground italic">Brak osieroconych wideo.</p>
              ) : (
                <ul className="space-y-1.5">
                  {diag!.orphanVideos.map((v) => (
                    <li key={v.guid} className="text-xs flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                      <span className="truncate">{v.title}</span>
                      <span className="font-mono text-muted-foreground/70 shrink-0">{v.guid.slice(0, 8)}…</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><VideoIcon className="w-4 h-4 text-primary" />Lekcje bez wideo</h3>
              {(diag?.lessonsWithoutVideo.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground italic">Wszystkie lekcje mają wideo.</p>
              ) : (
                <ul className="space-y-1.5">
                  {diag!.lessonsWithoutVideo.map((l) => (
                    <li key={l.topicId} className="text-xs flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                      <span className="truncate">{l.topicTitle}</span>
                      <span className="text-muted-foreground/70 shrink-0">{l.sectionTitle}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h3 className="font-bold text-sm">Biblioteka ({library?.items.length ?? 0})</h3>
            {(library?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground italic">Biblioteka pusta lub niedostępna.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {library!.items.map((v) => (
                  <div key={v.guid} className="rounded-xl border border-border/60 p-2.5 flex gap-2.5">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt="" className="w-20 h-14 rounded-lg object-cover bg-muted shrink-0" />
                    ) : (
                      <div className="w-20 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><VideoIcon className="w-5 h-5 text-muted-foreground/40" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{v.title}</p>
                      <p className={`text-[11px] ${statusColor(v.available)}`}>{v.statusLabel}</p>
                      {v.assignedTopicId
                        ? <Badge variant="outline" className="rounded text-[9px] mt-1">{v.assignedTopicTitle}</Badge>
                        : <Badge variant="secondary" className="rounded text-[9px] mt-1">Nieprzypisane</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
