import { useGetVideoHealth } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Film,
  ServerCog,
} from "lucide-react";

export default function AdminCourseDebug() {
  const { data, isLoading, isError, refetch, isFetching } = useGetVideoHealth();

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight font-display flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <ServerCog className="w-6 h-6" />
            </span>
            Diagnostyka kursu
          </h1>
          <p className="text-muted-foreground mt-2">
            Stan wideo w bibliotece Bunny Stream. Sprawdź, które materiały są gotowe do odtwarzania.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Odśwież
        </Button>
      </div>

      {!isLoading && summary && !summary.bunnyConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Bunny Stream nie jest skonfigurowane</p>
            <p className="text-sm text-muted-foreground mt-1">
              Uzupełnij zmienne BUNNY_LIBRARY_ID oraz klucz API, aby sprawdzać stan filmów na żywo.
            </p>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Wszystkie wideo", value: summary.total },
            { label: "Gotowe do odtwarzania", value: summary.available },
            { label: "Bez ID Bunny", value: summary.missingBunnyId },
          ].map((s) => (
            <div key={s.label} className="bg-card border rounded-2xl p-5 text-center shadow-sm">
              <p className="text-3xl font-black text-primary">{s.value}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="rounded-3xl border shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Film className="w-5 h-5 text-primary" /> Lista wideo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-muted-foreground">
              Nie udało się pobrać danych diagnostycznych.
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Brak wideo w katalogu.</div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                >
                  <div
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                      item.available
                        ? "bg-success/15 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {item.available ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.sectionTitle} · {item.topicTitle}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-medium ${
                        item.available ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {item.statusLabel}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {item.bunnyVideoId ? item.bunnyVideoId.slice(0, 12) : "brak ID"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
