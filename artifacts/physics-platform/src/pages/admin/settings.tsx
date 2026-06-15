import { useEffect, useState } from "react";
import {
  useGetPlatformSettings,
  useUpdatePlatformSettings,
  useListAdminCourses,
  exportLessons,
  exportUsers,
  exportPayments,
  exportQuiz,
  importQuiz,
} from "@workspace/api-client-react";
import type { PlatformSetting } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Download, Upload, Save } from "lucide-react";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useGetPlatformSettings();
  const { data: courses } = useListAdminCourses();
  const updateMut = useUpdatePlatformSettings();

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportCourseId, setExportCourseId] = useState("all");
  const [quizExportId, setQuizExportId] = useState("");
  const [quizImportTopicId, setQuizImportTopicId] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (settings) {
      const next: Record<string, unknown> = {};
      for (const s of settings) next[s.key] = s.value;
      setValues(next);
    }
  }, [settings]);

  const dirty =
    !!settings &&
    settings.some((s) => JSON.stringify(values[s.key]) !== JSON.stringify(s.value));

  const save = () => {
    if (!settings) return;
    const changed = settings
      .filter((s) => JSON.stringify(values[s.key]) !== JSON.stringify(s.value))
      .map((s) => ({ key: s.key, value: values[s.key] }));
    if (changed.length === 0) return;
    updateMut.mutate(
      { data: { settings: changed } },
      {
        onSuccess: () => {
          toast({ title: "Ustawienia zapisane" });
          refetch();
        },
        onError: (e: any) =>
          toast({ title: "Błąd", description: e?.data?.error ?? "Nie udało się zapisać.", variant: "destructive" }),
      },
    );
  };

  const runExport = async (kind: "lessons-csv" | "lessons-json" | "users" | "payments") => {
    setExporting(kind);
    try {
      if (kind === "lessons-csv") {
        const params = exportCourseId !== "all" ? { courseId: Number(exportCourseId), format: "csv" as const } : { format: "csv" as const };
        const data = await exportLessons(params);
        downloadBlob(String(data), `lekcje-${stamp()}.csv`, "text/csv;charset=utf-8");
      } else if (kind === "lessons-json") {
        const params = exportCourseId !== "all" ? { courseId: Number(exportCourseId), format: "json" as const } : { format: "json" as const };
        const data = await exportLessons(params);
        downloadBlob(JSON.stringify(data, null, 2), `lekcje-${stamp()}.json`, "application/json");
      } else if (kind === "users") {
        const data = await exportUsers();
        downloadBlob(String(data), `uzytkownicy-${stamp()}.csv`, "text/csv;charset=utf-8");
      } else if (kind === "payments") {
        const data = await exportPayments();
        downloadBlob(String(data), `platnosci-${stamp()}.csv`, "text/csv;charset=utf-8");
      }
      toast({ title: "Eksport gotowy", description: "Plik został pobrany." });
    } catch (e: any) {
      toast({ title: "Błąd eksportu", description: e?.data?.error ?? "Nie udało się wyeksportować.", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const runQuizExport = async () => {
    if (!quizExportId) {
      toast({ title: "Błąd", description: "Podaj ID quizu.", variant: "destructive" });
      return;
    }
    setExporting("quiz");
    try {
      const data = await exportQuiz(Number(quizExportId));
      downloadBlob(JSON.stringify(data, null, 2), `quiz-${quizExportId}-${stamp()}.json`, "application/json");
      toast({ title: "Eksport gotowy" });
    } catch (e: any) {
      toast({ title: "Błąd eksportu", description: e?.data?.error ?? "Nie znaleziono quizu.", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const runQuizImport = async (file: File) => {
    if (!quizImportTopicId) {
      toast({ title: "Błąd", description: "Najpierw podaj ID tematu docelowego.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const quiz = JSON.parse(text);
      await importQuiz({ topicId: Number(quizImportTopicId), quiz });
      toast({ title: "Quiz zaimportowany", description: "Quiz został dodany do tematu." });
      setQuizImportTopicId("");
    } catch (e: any) {
      const msg = e instanceof SyntaxError ? "Nieprawidłowy plik JSON." : e?.data?.error ?? "Nie udało się zaimportować.";
      toast({ title: "Błąd importu", description: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Ustawienia platformy</h1>
          <p className="text-muted-foreground mt-1">Konfiguracja, import i eksport danych</p>
        </div>
      </div>

      <Card className="rounded-3xl border-border shadow-sm bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Konfiguracja</CardTitle>
          <Button className="rounded-xl" onClick={save} disabled={!dirty || updateMut.isPending}>
            <Save className="w-4 h-4 mr-2" />Zapisz
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="h-40 bg-muted animate-pulse rounded-2xl" />
          ) : !settings || settings.length === 0 ? (
            <p className="text-muted-foreground">Brak ustawień do skonfigurowania.</p>
          ) : (
            settings.map((s) => (
              <SettingRow
                key={s.key}
                setting={s}
                value={values[s.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border shadow-sm bg-card">
        <CardHeader><CardTitle>Eksport danych</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Lekcje — kurs</Label>
            <Select value={exportCourseId} onValueChange={setExportCourseId}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie kursy</SelectItem>
                {(courses ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button variant="outline" className="rounded-xl" disabled={exporting === "lessons-csv"} onClick={() => runExport("lessons-csv")}>
                <Download className="w-4 h-4 mr-2" />Lekcje (CSV)
              </Button>
              <Button variant="outline" className="rounded-xl" disabled={exporting === "lessons-json"} onClick={() => runExport("lessons-json")}>
                <Download className="w-4 h-4 mr-2" />Lekcje (JSON)
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-border/60 pt-4">
            <Button variant="outline" className="rounded-xl" disabled={exporting === "users"} onClick={() => runExport("users")}>
              <Download className="w-4 h-4 mr-2" />Użytkownicy (CSV)
            </Button>
            <Button variant="outline" className="rounded-xl" disabled={exporting === "payments"} onClick={() => runExport("payments")}>
              <Download className="w-4 h-4 mr-2" />Płatności (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border shadow-sm bg-card">
        <CardHeader><CardTitle>Quizy — import / eksport (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Eksport quizu — ID quizu</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" value={quizExportId} onChange={(e) => setQuizExportId(e.target.value)} placeholder="np. 12" className="rounded-xl" />
                <Button variant="outline" className="rounded-xl shrink-0" disabled={exporting === "quiz"} onClick={runQuizExport}>
                  <Download className="w-4 h-4 mr-2" />Eksportuj
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Import quizu — ID tematu</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" value={quizImportTopicId} onChange={(e) => setQuizImportTopicId(e.target.value)} placeholder="np. 5" className="rounded-xl" />
                <Button variant="outline" className="rounded-xl shrink-0" disabled={importing || !quizImportTopicId} asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />Wczytaj JSON
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) runQuizImport(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Import dodaje nowy quiz do wskazanego tematu na podstawie pliku JSON z eksportu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  onChange,
}: {
  setting: PlatformSetting;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 p-4">
      <div className="min-w-0">
        <Label className="font-semibold">{setting.label}</Label>
        {setting.description && <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>}
      </div>
      <div className="shrink-0 w-44">
        {setting.type === "boolean" ? (
          <div className="flex justify-end pt-1">
            <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(v)} />
          </div>
        ) : setting.type === "number" ? (
          <Input
            type="number"
            min={setting.min}
            max={setting.max}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-xl"
          />
        ) : (
          <Input
            value={value == null ? "" : String(value)}
            maxLength={setting.maxLength}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-xl"
          />
        )}
      </div>
    </div>
  );
}
