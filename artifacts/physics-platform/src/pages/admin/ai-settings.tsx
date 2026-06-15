import { useEffect, useState } from "react";
import { useGetAiSettings, useUpdateAiSettings, useTestAiPrompt } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { opts } from "@/components/admin/shared";
import { Sparkles, Save, CheckCircle2, AlertTriangle, Loader2, Play } from "lucide-react";

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
        </>
      )}
    </div>
  );
}
