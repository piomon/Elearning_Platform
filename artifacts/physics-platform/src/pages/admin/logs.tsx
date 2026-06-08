import { useState } from "react";
import { useListAdminLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TerminalSquare, FileText, UserCog, Database, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

const LIMIT = 25;
const ALL = "all";

const ACTIONS = ["create", "update", "delete", "ban", "unban", "grant_access", "revoke_access", "refund"];
const ENTITIES = ["user", "course", "section", "topic", "video", "quiz", "task", "payment"];

export default function AdminLogs() {
  const [action, setAction] = useState<string>(ALL);
  const [entityType, setEntityType] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAdminLogs({
    action: action === ALL ? undefined : action,
    entityType: entityType === ALL ? undefined : entityType,
    page,
    limit: LIMIT,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const getActionColor = (a: string) => {
    if (a.includes("delete") || a.includes("ban") || a.includes("revoke")) return "bg-destructive/10 text-destructive";
    if (a.includes("create") || a.includes("grant") || a.includes("unban")) return "bg-success/10 text-success";
    if (a.includes("update")) return "bg-amber-500/10 text-amber-500";
    return "bg-primary/10 text-primary";
  };

  const getEntityIcon = (type: string) => {
    if (type.includes("user")) return <UserCog className="w-4 h-4" />;
    if (type.includes("course") || type.includes("topic") || type.includes("section")) return <FileText className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <TerminalSquare className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Logi Systemowe</h1>
          <p className="text-muted-foreground mt-1">Historia operacji administracyjnych</p>
        </div>
      </div>

      <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="p-4 sm:p-6 bg-muted/30 border-b border-border/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
                <Filter className="w-4 h-4" />
              </div>
              <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
                <SelectTrigger className="h-11 pl-9 rounded-xl bg-background border-border/50 shadow-sm">
                  <SelectValue placeholder="Akcja" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={ALL}>Wszystkie akcje</SelectItem>
                  {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border/50 shadow-sm">
                  <SelectValue placeholder="Typ obiektu" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value={ALL}>Wszystkie obiekty</SelectItem>
                  {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data?.logs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-muted/30 transition-colors gap-3 sm:gap-0">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                      {getEntityIcon(log.entityType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm">{log.action}</span>
                        <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded-md border border-border/50 text-muted-foreground">
                          {log.entityType} #{log.entityId || "-"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Wykonane przez: <span className="font-medium text-foreground/80">{log.adminFirstName ? `${log.adminFirstName} (${log.adminEmail ?? `#${log.adminId}`})` : log.adminEmail || `Admin #${log.adminId}`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground bg-background border border-border/50 px-3 py-1.5 rounded-lg self-start sm:self-auto shrink-0 shadow-sm whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm:ss", { locale: pl })}
                  </div>
                </div>
              ))}
              {data?.logs.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <TerminalSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  Brak zapisanych logów
                </div>
              )}
            </div>
          )}

          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
            <span className="text-sm text-muted-foreground ml-2">
              Strona {page} z {totalPages} · {total} {total === 1 ? "wpis" : "wpisów"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-full px-4 border-border/60">
                <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full px-4 border-border/60">
                Następna <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
