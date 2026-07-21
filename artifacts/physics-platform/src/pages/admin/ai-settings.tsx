import { useEffect, useState } from "react";
import {
  useGetAiSettings,
  useUpdateAiSettings,
  useTestAiPrompt,
  useGetAiUsageStats,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { opts } from "@/components/admin/shared";
import { Link } from "wouter";
import { Sparkles, Save, CheckCircle2, AlertTriangle, Loader2, Play, BarChart3, LifeBuoy, Activity } from "lucide-react";

const OPERATION_LABELS: Record<string, string> = {
  check: "Sprawdzanie zadań (obraz)",
  chat: "Asystent tekstowy",
  "admin-test": "Test admina",
};

// Costs are stored in grosz; show fractions of a grosz for cheap chat calls
// and switch to złote once a period's total grows past 1 zł.
function formatGrosz(g: number | null | undefined): string {
  if (g == null) return "—";
  if (g >= 100) return `${(g / 100).toFixed(2).replace(".", ",")} zł`;
  return `${g.toFixed(g < 1 ? 3 : 2).replace(".", ",")} gr`;
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function AdminAiSettings() {
  const { data, isLoading, refetch } = useGetAiSettings();
  const updateSettings = useUpdateAiSettings();
  const testPrompt = useTestAiPrompt();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [evalInstruction, setEvalInstruction] = useState("");
  const [tone, setTone] = useState("");
  const [maxResponseLength, setMaxResponseLength] = useState("500");
  const [errorMessage, setErrorMessage] = useState("");

  const [testInput, setTestInput] = useState("Rozwiąż: ile wynosi 2+2?");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testDemo, setTestDemo] = useState(false);

  const [statsDays, setStatsDays] = useState(7);
  const statsQuery = useGetAiUsageStats(
    { days: statsDays },
    { query: { staleTime: 30_000 } as any },
  );
  const stats = statsQuery.data;

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setModel(data.model);
    setSystemPrompt(data.systemPrompt);
    setEvalInstruction(data.evalInstruction);
    setTone(data.tone);
    setMaxResponseLength(String(data.maxResponseLength));
    setErrorMessage(data.errorMessage);
  }, [data]);

  const save = () => {
    updateSettings.mutate({
      data: {
        enabled, model, systemPrompt, evalInstruction, tone,
        maxResponseLength: Number(maxResponseLength) || 500,
        errorMessage,
      },
    }, opts(() => refetch(), toast, "Zapisano ustawienia AI"));
  };

  const runTest = () => {
    testPrompt.mutate(
      { data: { prompt: testInput, systemPrompt: systemPrompt || undefined } },
      {
        onSuccess: (res) => { setTestReply(res.reply); setTestDemo(res.demo); },
        onError: () => toast({ title: "Błąd", description: "Test nie powiódł się.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Ustawienia AI</h1>
          <p className="text-muted-foreground mt-1">Globalna konfiguracja asystenta Gemini</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 bg-muted animate-pulse rounded-3xl" />
      ) : (
        <>
          {data?.fallbackAlert && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm">
                <p className="font-bold text-foreground">AI działa na modelu zapasowym</p>
                <p className="text-muted-foreground">
                  W ciągu ostatnich 24 godzin sprawdzanie zadań {data.fallbackAlert.count}× użyło modelu
                  zapasowego <span className="font-mono text-foreground">{data.fallbackAlert.fallbackModel}</span> zamiast
                  skonfigurowanego <span className="font-mono text-foreground">{data.fallbackAlert.configuredModel}</span>
                  {data.fallbackAlert.lastAt && (
                    <> (ostatnio: {new Date(data.fallbackAlert.lastAt).toLocaleString("pl-PL")})</>
                  )}.
                </p>
                <p className="text-muted-foreground">
                  Skonfigurowany model przestał działać — wyczyść pole modelu, aby używać zawsze aktualnego.
                </p>
                {model.trim() !== "" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl mt-1 border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => setModel("")}
                  >
                    Wyczyść pole modelu
                  </Button>
                )}
              </div>
            </div>
          )}

          {data?.overloadRescue && (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-sky-500/30 bg-sky-500/5 p-5">
              <LifeBuoy className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-sm">
                <p className="font-bold text-foreground">Model rezerwowy ratuje sprawdzenia w godzinach szczytu</p>
                <p className="text-muted-foreground">
                  W ciągu ostatnich 24 godzin, po wyczerpaniu ponowień na przeciążonym modelu (błędy 429/5xx),
                  model rezerwowy <span className="font-mono text-foreground">{data.overloadRescue.rescueModel}</span> uratował{" "}
                  <span className="font-semibold text-foreground">{data.overloadRescue.rescued}</span>{" "}
                  {data.overloadRescue.rescued === 1 ? "sprawdzenie" : "sprawdzeń"}
                  {data.overloadRescue.failed > 0 && (
                    <>
                      , a <span className="font-semibold text-foreground">{data.overloadRescue.failed}</span> mimo to
                      zakończyło się błędem
                    </>
                  )}
                  {data.overloadRescue.lastAt && (
                    <> (ostatnio: {new Date(data.overloadRescue.lastAt).toLocaleString("pl-PL")})</>
                  )}.
                </p>
                <p className="text-muted-foreground">
                  To znak, że dzienne przeciążenia Google wciąż dotykają uczniów. Wskaźnik zniknie, gdy przeciążenia ustaną.
                </p>
              </div>
            </div>
          )}

          <Card className="rounded-3xl border-border shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                {data?.keyConfigured ? (
                  <Badge variant="default" className="rounded gap-1"><CheckCircle2 className="w-3 h-3" />Klucz Gemini skonfigurowany</Badge>
                ) : (
                  <Badge variant="secondary" className="rounded gap-1"><AlertTriangle className="w-3 h-3" />Brak klucza — tryb demo</Badge>
                )}
                <Badge variant="outline" className="rounded text-xs">Model środowiska: {data?.envModel || "—"}</Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
                <div>
                  <Label>Asystent AI włączony globalnie</Label>
                  <p className="text-xs text-muted-foreground">Wyłączenie blokuje sprawdzanie i czat AI we wszystkich lekcjach.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={data?.envModel} className="rounded-xl font-mono text-sm" />
                  <p className="text-[11px] text-muted-foreground">Puste = model środowiska ({data?.envModel || "—"}).</p>
                </div>
                <div className="space-y-2">
                  <Label>Maks. długość odpowiedzi (znaki)</Label>
                  <Input type="number" min={50} value={maxResponseLength} onChange={(e) => setMaxResponseLength(e.target.value)} className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ton wypowiedzi</Label>
                <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="np. przyjazny, zachęcający nauczyciel fizyki" className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label>Globalna instrukcja systemowa</Label>
                <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} className="rounded-xl" placeholder="Ogólne wytyczne dla asystenta AI..." />
              </div>

              <div className="space-y-2">
                <Label>Instrukcja oceniania zadań</Label>
                <Textarea value={evalInstruction} onChange={(e) => setEvalInstruction(e.target.value)} rows={3} className="rounded-xl" placeholder="Jak AI ma oceniać rozwiązania uczniów..." />
              </div>

              <div className="space-y-2">
                <Label>Komunikat przy wyłączonym AI</Label>
                <Input value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} className="rounded-xl" placeholder="Pokazywany uczniowi, gdy AI jest niedostępne" />
              </div>

              <div className="flex justify-end">
                <Button className="rounded-xl" onClick={save} disabled={updateSettings.isPending}>
                  <Save className="w-4 h-4 mr-1" />Zapisz ustawienia
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-bold text-lg flex items-center gap-2"><Play className="w-4 h-4 text-primary" />Test promptu</h2>
              <p className="text-sm text-muted-foreground">Sprawdź odpowiedź AI z aktualną instrukcją systemową (nie zapisuje zmian).</p>
              <Textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={2} className="rounded-xl" />
              <div className="flex justify-end">
                <Button variant="secondary" className="rounded-xl" onClick={runTest} disabled={testPrompt.isPending || !testInput.trim()}>
                  {testPrompt.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                  Uruchom test
                </Button>
              </div>
              {testReply !== null && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                  {testDemo && <Badge variant="secondary" className="rounded text-[10px]">Tryb demo</Badge>}
                  <p className="text-sm whitespace-pre-wrap">{testReply}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />Statystyki użycia AI
                </h2>
                <div className="flex gap-1">
                  {[7, 30, 90].map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={statsDays === d ? "default" : "outline"}
                      className="rounded-xl h-8 px-3 text-xs"
                      onClick={() => setStatsDays(d)}
                    >
                      {d} dni
                    </Button>
                  ))}
                  <Link href="/admin/ai-logs">
                    <Button size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs">
                      <Activity className="w-3.5 h-3.5 mr-1" />
                      Logi AI
                    </Button>
                  </Link>
                </div>
              </div>

              {statsQuery.isLoading ? (
                <div className="h-24 bg-muted animate-pulse rounded-xl" />
              ) : !stats || stats.operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Brak zapytań AI w wybranym okresie.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.operations.map((op) => {
                    const successPct =
                      op.total > 0 ? Math.round((op.completed / op.total) * 100) : 0;
                    return (
                      <div key={op.operation} className="rounded-xl border border-border/60 p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-semibold text-sm">
                            {OPERATION_LABELS[op.operation] ?? op.operation}
                          </span>
                          <Badge variant="outline" className="rounded text-[10px] font-mono">
                            {op.operation}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                          <StatItem label="Zapytania" value={String(op.total)} />
                          <StatItem label="Udane" value={`${op.completed} (${successPct}%)`} />
                          <StatItem label="Uratowane ponowieniem" value={String(op.rescuedByRetry)} />
                          <StatItem label="Śr. liczba prób" value={String(op.avgAttempts)} />
                          <StatItem label="Błędy 429 / 503" value={`${op.errors429} / ${op.errors503}`} />
                          <StatItem
                            label="Śr. tokeny (wej. / wyj.)"
                            value={`${op.avgInputTokens ?? "—"} / ${op.avgOutputTokens ?? "—"}`}
                          />
                          <StatItem label="Śr. koszt zapytania" value={formatGrosz(op.avgCostGrosz)} />
                          <StatItem label="Koszt łącznie" value={formatGrosz(op.totalCostGrosz)} />
                        </div>
                        {op.avgLatencyMs != null && (
                          <p className="text-[11px] text-muted-foreground">
                            Średni czas odpowiedzi: {(op.avgLatencyMs / 1000).toFixed(1).replace(".", ",")} s
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Koszt szacowany według cennika Gemini (kurs USD→PLN z konfiguracji serwera).
                „Uratowane ponowieniem” to zapytania, które powiodły się dopiero po automatycznej
                ponownej próbie — bez niej uczeń zobaczyłby błąd.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
