import { Fragment, useState } from "react";
import {
  useListAiUsageLog,
  type AiUsageLogEntry,
  type AiAttemptLogEntry,
  type ListAiUsageLogParams,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRightLeft,
  X,
} from "lucide-react";

const LIMIT = 25;

const OPERATION_LABELS: Record<string, string> = {
  check: "Sprawdzenie",
  chat: "Czat",
  "admin-test": "Test admina",
};

// Costs are stored in grosz; show fractions of a grosz for cheap chat calls
// and switch to złote once the amount grows past 1 zł.
function formatGrosz(g: number | null | undefined): string {
  if (g == null) return "—";
  if (g >= 100) return `${(g / 100).toFixed(2).replace(".", ",")} zł`;
  return `${g.toFixed(g < 1 ? 3 : 2).replace(".", ",")} gr`;
}

function formatBytes(b: number | null | undefined): string {
  if (b == null) return "—";
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}

function formatSec(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

// Attempt-by-attempt timeline in Polish. Attempt numbers RESET when the route
// switches models (404 fallback or overload rescue), so a reset renders a
// "model switch" divider between the two runs.
function AttemptTimeline({ log }: { log: AiAttemptLogEntry[] }) {
  const items: React.ReactNode[] = [];
  let prevAttempt = 0;
  log.forEach((a, i) => {
    if (i > 0 && a.attempt <= prevAttempt) {
      items.push(
        <li key={`switch-${i}`} className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-medium py-0.5">
          <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
          Przełączenie na inny model (fallback / ratunek)
        </li>,
      );
    }
    prevAttempt = a.attempt;
    const isLast = i === log.length - 1;
    const failureLabel = [
      a.httpStatus != null ? `HTTP ${a.httpStatus}` : "błąd",
      a.reason ? `(${a.reason})` : "",
    ]
      .filter(Boolean)
      .join(" ");
    items.push(
      <li key={i} className="flex items-center gap-2 py-0.5">
        {a.ok ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
        )}
        <span>
          Próba {a.attempt} —{" "}
          {a.ok ? (
            <span className="text-success font-medium">sukces</span>
          ) : (
            <span className="text-destructive font-medium">{failureLabel}</span>
          )}
          , {formatSec(a.ms)}
          {!a.ok && !isLast && <span className="text-muted-foreground"> → ponowienie</span>}
          {!a.ok && isLast && <span className="text-muted-foreground"> → przerwano</span>}
        </span>
      </li>,
    );
  });
  return <ol className="text-xs space-y-0.5">{items}</ol>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-black tabular-nums mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}

function EntryDetails({ entry }: { entry: AiUsageLogEntry }) {
  const attemptLog = entry.attemptLog ?? [];
  return (
    <div className="space-y-4 text-sm">
      {attemptLog.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Przebieg prób
          </p>
          <AttemptTimeline log={attemptLog} />
        </div>
      )}

      {entry.errorMessage && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Komunikat błędu
          </p>
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3 break-words whitespace-pre-wrap font-mono">
            {entry.errorMessage}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-muted-foreground">Tokeny (wej. / wyj.)</p>
          <p className="font-semibold tabular-nums">
            {entry.inputTokens ?? "—"} / {entry.outputTokens ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Błędy 429 / 503</p>
          <p className="font-semibold tabular-nums">
            {entry.transient429} / {entry.transient503}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Koszt (szac.)</p>
          <p className="font-semibold tabular-nums">{formatGrosz(entry.estCostGrosz)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Czas łącznie</p>
          <p className="font-semibold tabular-nums">{formatSec(entry.latencyMs)}</p>
        </div>
      </div>

      {entry.checkId != null && (
        <div className="rounded-xl border border-border/60 bg-background p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Szczegóły sprawdzenia #{entry.checkId}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
            <div>
              <p className="text-muted-foreground">Zadanie</p>
              <p className="font-semibold">
                {entry.taskTitle ?? "—"}
                {entry.taskId != null && (
                  <span className="text-muted-foreground font-normal"> (ID {entry.taskId})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Temat</p>
              <p className="font-semibold">{entry.topicTitle ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rozmiar obrazka</p>
              <p className="font-semibold tabular-nums">{formatBytes(entry.requestBytes)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-muted-foreground">Ścieżka obrazka</p>
              <p className="font-mono text-[11px] break-all">{entry.imageStoragePath ?? "—"}</p>
            </div>
          </div>
          {entry.checkErrorMessage && entry.checkErrorMessage !== entry.errorMessage && (
            <p className="text-xs text-destructive break-words">
              Błąd sprawdzenia: {entry.checkErrorMessage}
            </p>
          )}
          {entry.aiResponsePreview && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">
                Podgląd odpowiedzi AI (pierwsze 400 znaków)
              </p>
              <p className="text-xs bg-muted/40 border border-border/50 rounded-lg p-3 whitespace-pre-wrap break-words">
                {entry.aiResponsePreview}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAiLogs() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [operation, setOperation] = useState("all");
  const [model, setModel] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params: ListAiUsageLogParams = {
    page,
    limit: LIMIT,
    ...(status !== "all" ? { status: status as ListAiUsageLogParams["status"] } : {}),
    ...(operation !== "all" ? { operation: operation as ListAiUsageLogParams["operation"] } : {}),
    ...(model !== "all" ? { model } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const { data, isLoading } = useListAiUsageLog(params);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const hasFilters =
    status !== "all" || operation !== "all" || model !== "all" || search !== "" || from !== "" || to !== "";

  const resetFilters = () => {
    setStatus("all");
    setOperation("all");
    setModel("all");
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const onFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
    setExpandedId(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Logi AI</h1>
          <p className="text-muted-foreground mt-1">
            Dziennik wszystkich żądań AI — sprawdzenia, czat i testy, z pełnym przebiegiem prób
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryItem label="Żądania" value={isLoading ? "…" : String(data?.summary.total ?? 0)} />
        <SummaryItem label="Błędy" value={isLoading ? "…" : String(data?.summary.failed ?? 0)} />
        <SummaryItem
          label="Śr. rozmiar obrazka"
          value={isLoading ? "…" : formatBytes(data?.summary.avgRequestBytes)}
        />
        <SummaryItem
          label="Śr. czas odpowiedzi"
          value={isLoading ? "…" : formatSec(data?.summary.avgLatencyMs)}
        />
        <SummaryItem
          label="Koszt łącznie (szac.)"
          value={isLoading ? "…" : formatGrosz(data?.summary.totalCostGrosz)}
        />
      </div>

      <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="p-4 sm:p-6 bg-muted/30 border-b border-border/50 flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po e-mailu lub nazwisku ucznia..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  setExpandedId(null);
                }}
                className="pl-9 h-10 rounded-xl bg-background border-border/50 shadow-sm"
              />
            </div>
            <Select value={status} onValueChange={onFilterChange(setStatus)}>
              <SelectTrigger className="h-10 w-full lg:w-[150px] rounded-xl bg-background border-border/50 shadow-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                <SelectItem value="failed">Tylko błędy</SelectItem>
                <SelectItem value="completed">Tylko udane</SelectItem>
              </SelectContent>
            </Select>
            <Select value={operation} onValueChange={onFilterChange(setOperation)}>
              <SelectTrigger className="h-10 w-full lg:w-[160px] rounded-xl bg-background border-border/50 shadow-sm">
                <SelectValue placeholder="Operacja" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Wszystkie operacje</SelectItem>
                <SelectItem value="check">Sprawdzenie</SelectItem>
                <SelectItem value="chat">Czat</SelectItem>
                <SelectItem value="admin-test">Test admina</SelectItem>
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={onFilterChange(setModel)}>
              <SelectTrigger className="h-10 w-full lg:w-[210px] rounded-xl bg-background border-border/50 shadow-sm">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Wszystkie modele</SelectItem>
                {(data?.models ?? []).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-[150px] rounded-xl bg-background border-border/50 shadow-sm"
                aria-label="Data od"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="h-10 w-[150px] rounded-xl bg-background border-border/50 shadow-sm"
                aria-label="Data do"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="rounded-xl h-10 text-muted-foreground"
              >
                <X className="w-4 h-4 mr-1" /> Wyczyść
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="border-border">
                  <TableHead className="font-semibold px-4 py-3">Czas</TableHead>
                  <TableHead className="font-semibold py-3">Uczeń</TableHead>
                  <TableHead className="font-semibold py-3">Operacja</TableHead>
                  <TableHead className="font-semibold py-3">Model</TableHead>
                  <TableHead className="font-semibold py-3">Status</TableHead>
                  <TableHead className="font-semibold py-3 text-right">Próby</TableHead>
                  <TableHead className="font-semibold py-3 text-right">Rozmiar</TableHead>
                  <TableHead className="font-semibold py-3 text-right">Tokeny</TableHead>
                  <TableHead className="font-semibold py-3 text-right">Koszt</TableHead>
                  <TableHead className="font-semibold py-3 text-right">Czas trwania</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(6)
                    .fill(0)
                    .map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={11} className="px-4 py-3">
                          <div className="h-8 bg-muted animate-pulse rounded-lg" />
                        </TableCell>
                      </TableRow>
                    ))
                ) : (
                  data?.entries.map((entry) => {
                    const expanded = expandedId === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <TableRow
                          className="border-border/50 hover:bg-muted/20 cursor-pointer"
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
                          aria-expanded={expanded}
                        >
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium">
                              {format(new Date(entry.createdAt), "dd.MM.yyyy", { locale: pl })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(entry.createdAt), "HH:mm:ss", { locale: pl })}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {entry.userEmail ? (
                              <div>
                                {entry.userName && (
                                  <div className="text-sm font-medium">{entry.userName}</div>
                                )}
                                <div className="text-xs text-muted-foreground">{entry.userEmail}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm">{OPERATION_LABELS[entry.operation] ?? entry.operation}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-mono text-xs">{entry.model}</span>
                          </TableCell>
                          <TableCell className="py-3 whitespace-nowrap">
                            {entry.status === "completed" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                                Udane
                                {entry.rescuedByRetry && (
                                  <RefreshCw className="w-3 h-3" aria-label="Uratowane ponowieniem" />
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                                Błąd{entry.httpStatus != null ? ` · HTTP ${entry.httpStatus}` : ""}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm">{entry.attempts}</TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm">
                            {formatBytes(entry.requestBytes)}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm">
                            {entry.totalTokens ?? "—"}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm">
                            {formatGrosz(entry.estCostGrosz)}
                          </TableCell>
                          <TableCell className="py-3 text-right tabular-nums text-sm">
                            {formatSec(entry.latencyMs)}
                          </TableCell>
                          <TableCell className="py-3 pr-4 text-right">
                            <ChevronDown
                              className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20 border-border/50">
                            <TableCell colSpan={11} className="px-6 py-4">
                              <EntryDetails entry={entry} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
                {!isLoading && data?.entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Activity className="w-8 h-8 text-muted-foreground/30" />
                        <p>Brak żądań AI spełniających kryteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
            <span className="text-sm text-muted-foreground ml-2">
              Strona {page} z {totalPages} · {total} {total === 1 ? "żądanie" : "żądań"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => {
                  setPage((p) => p - 1);
                  setExpandedId(null);
                }}
                className="rounded-full px-4 border-border/60"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1);
                  setExpandedId(null);
                }}
                className="rounded-full px-4 border-border/60"
              >
                Następna <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Dziennik zawiera wyłącznie metadane żądań i zapisany tekst odpowiedzi AI — bez zdjęć uczniów.
        Koszt szacowany według cennika Gemini. Numery prób zerują się przy przełączeniu modelu
        (fallback po 404 lub ratunek przy przeciążeniu).
      </p>
    </div>
  );
}
