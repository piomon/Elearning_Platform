import { useListAdminLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TerminalSquare, FileText, UserCog, Database } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminLogs() {
  const { data, isLoading } = useListAdminLogs({ limit: 100 });

  const getActionIcon = (action: string) => {
    if (action.includes('delete') || action.includes('ban') || action.includes('revoke')) return "bg-destructive/10 text-destructive";
    if (action.includes('create') || action.includes('grant') || action.includes('unban')) return "bg-success/10 text-success";
    if (action.includes('update')) return "bg-amber-500/10 text-amber-500";
    return "bg-primary/10 text-primary";
  };

  const getEntityIcon = (type: string) => {
    if (type.includes('user')) return <UserCog className="w-4 h-4" />;
    if (type.includes('course') || type.includes('topic') || type.includes('section')) return <FileText className="w-4 h-4" />;
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
          <p className="text-muted-foreground mt-1">Historia operacji administracyjnych (ostatnie 100)</p>
        </div>
      </div>

      <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data?.map(log => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-muted/30 transition-colors gap-3 sm:gap-0">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getActionIcon(log.action)}`}>
                      {getEntityIcon(log.entityType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm">{log.action}</span>
                        <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded-md border border-border/50 text-muted-foreground">
                          {log.entityType} #{log.entityId || '-'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Wykonane przez: <span className="font-medium text-foreground/80">{log.adminEmail || `Admin #${log.adminId}`}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs font-medium text-muted-foreground bg-background border border-border/50 px-3 py-1.5 rounded-lg self-start sm:self-auto shrink-0 shadow-sm whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm:ss", { locale: pl })}
                  </div>
                </div>
              ))}
              {data?.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <TerminalSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  Brak zapisanych logów
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
