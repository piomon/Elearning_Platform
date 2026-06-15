import { useEffect, useMemo, useState } from "react";
import {
  useListLandingSections,
  useUpdateLandingSection,
  useToggleLandingSection,
  useReorderLandingSections,
} from "@workspace/api-client-react";
import type { LandingSection } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutTemplate, Save, Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Code, AlertTriangle,
} from "lucide-react";

type Toast = ReturnType<typeof useToast>["toast"];

type SubField = { key: string; label: string; type: "text" | "textarea" };
type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "stringList" | "objectList";
  fields?: SubField[];
};

const FIELD_CONFIG: Record<string, FieldDef[]> = {
  hero: [
    { key: "badges", label: "Odznaki", type: "stringList" },
    { key: "titleLine1", label: "Tytuł — linia 1", type: "text" },
    { key: "titleLine2", label: "Tytuł — linia 2", type: "text" },
    { key: "paragraph1", label: "Akapit 1", type: "textarea" },
    { key: "paragraph2", label: "Akapit 2", type: "textarea" },
    { key: "ctaPrimary", label: "Przycisk główny", type: "text" },
    { key: "ctaSecondary", label: "Przycisk dodatkowy", type: "text" },
    { key: "ratingText", label: "Tekst oceny", type: "text" },
  ],
  benefits: [
    {
      key: "items", label: "Korzyści", type: "objectList",
      fields: [
        { key: "title", label: "Tytuł", type: "text" },
        { key: "desc", label: "Opis", type: "textarea" },
      ],
    },
  ],
  methodology: [
    { key: "eyebrow", label: "Nadtytuł", type: "text" },
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "subheading", label: "Podtytuł", type: "textarea" },
    {
      key: "steps", label: "Kroki", type: "objectList",
      fields: [
        { key: "title", label: "Tytuł", type: "text" },
        { key: "description", label: "Opis", type: "textarea" },
      ],
    },
  ],
  modules: [
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "subheading", label: "Podtytuł", type: "textarea" },
    { key: "ctaText", label: "Tekst przycisku", type: "text" },
  ],
  ai: [
    { key: "eyebrow", label: "Nadtytuł", type: "text" },
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "paragraph", label: "Akapit", type: "textarea" },
    { key: "card1Title", label: "Karta 1 — tytuł", type: "text" },
    { key: "card1Desc", label: "Karta 1 — opis", type: "text" },
    { key: "card2Title", label: "Karta 2 — tytuł", type: "text" },
    { key: "card2Desc", label: "Karta 2 — opis", type: "text" },
  ],
  parents: [
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "subheading", label: "Podtytuł", type: "textarea" },
  ],
  pricing: [
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "subheading", label: "Podtytuł", type: "text" },
    { key: "features", label: "Cechy", type: "stringList" },
    { key: "note", label: "Notatka", type: "textarea" },
  ],
  faq: [
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "subheading", label: "Podtytuł", type: "text" },
  ],
  contact: [
    { key: "heading", label: "Nagłówek", type: "text" },
    { key: "paragraph", label: "Akapit", type: "textarea" },
    { key: "quickContactLabel", label: "Szybki kontakt — etykieta", type: "text" },
    { key: "quickContactValue", label: "Szybki kontakt — wartość", type: "text" },
  ],
};

// Non-blocking legal-risk detection for landing copy. These phrases can create
// legal exposure (claims of MEN compliance, fixed access duration, guarantees,
// refunds, certificates) and the owner should consciously confirm them — but we
// never block saving.
type LegalRiskRule = { pattern: RegExp; label: string };

const LEGAL_RISK_RULES: LegalRiskRule[] = [
  { pattern: /\bMEN\b/, label: "„MEN” — deklaracja zgodności z Ministerstwem Edukacji; upewnij się, że jest prawdziwa." },
  { pattern: /podstaw\w*\s+programow\w*/i, label: "„podstawa programowa” — odwołanie wymaga potwierdzenia zgodności." },
  { pattern: /zgodn\w*\s+z\s+(ministerstw|men|kuratorium)/i, label: "Deklaracja zgodności z MEN / ministerstwem." },
  { pattern: /(dostęp|dostępu)\s+(na|przez)\s+(rok|cały\s+rok|12\s+mies)/i, label: "„dostęp na rok” — czas dostępu musi zgadzać się z regulaminem." },
  { pattern: /roczn\w*\s+dostęp|dostęp\s+roczn\w*/i, label: "Deklaracja rocznego dostępu — musi zgadzać się z regulaminem." },
  { pattern: /gwarancj\w*|gwarantuj\w*/i, label: "„gwarancja” — może rodzić zobowiązania prawne." },
  { pattern: /zwrot\w*\s+(pieniędzy|kosztów|wpłaty)/i, label: "Obietnica zwrotu pieniędzy — musi zgadzać się z regulaminem." },
  { pattern: /certyfikat\w*/i, label: "„certyfikat” — upewnij się, że jest realny i zgodny z prawem." },
];

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }
  return [];
}

function findLegalRisks(...texts: unknown[]): string[] {
  const haystack = texts.flatMap(collectStrings).join("\n");
  return LEGAL_RISK_RULES.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.label);
}

export default function AdminLanding() {
  const { data, isLoading, refetch } = useListLandingSections();
  const { toast } = useToast();
  const onChanged = () => { refetch(); };
  const reorder = useReorderLandingSections();

  const sections = (data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const riskySections = sections
    .map((s) => ({ title: s.title, risks: findLegalRisks(s.title, s.content) }))
    .filter((s) => s.risks.length > 0);

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const reordered = sections.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved);
    reorder.mutate(
      { data: { ids: reordered.map((s) => s.id) } },
      {
        onSuccess: () => { onChanged(); toast({ title: "Zmieniono kolejność" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zmienić kolejności.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <LayoutTemplate className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Strona główna</h1>
          <p className="text-muted-foreground mt-1">Edytor sekcji treści strony głównej</p>
        </div>
      </div>

      {riskySections.length > 0 && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-700 dark:text-amber-400">
              Wykryto ryzykowne treści prawne w {riskySections.length}{" "}
              {riskySections.length === 1 ? "sekcji" : "sekcjach"}
            </p>
            <p className="text-amber-700/90 dark:text-amber-300/90 mt-0.5">
              Sprawdź: {riskySections.map((s) => s.title).join(", ")}. Rozwiń sekcję, aby zobaczyć szczegóły. Ostrzeżenia nie blokują zapisu.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-3xl" />)}
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/60">
          <LayoutTemplate className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-xl font-bold mb-2">Brak sekcji</p>
          <p className="text-muted-foreground">Sekcje strony głównej pojawią się tutaj.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              total={sections.length}
              onChanged={onChanged}
              toast={toast}
              onMove={move}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, index, total, onChanged, toast, onMove }: {
  section: LandingSection; index: number; total: number; onChanged: () => void; toast: Toast;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  const updateSection = useUpdateLandingSection();
  const toggleSection = useToggleLandingSection();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState<Record<string, unknown>>((section.content as Record<string, unknown>) ?? {});
  const [jsonText, setJsonText] = useState("");

  const fields = FIELD_CONFIG[section.key];
  const isKnown = !!fields;

  const risks = useMemo(() => {
    const extra = isKnown
      ? content
      : (() => {
          try {
            return JSON.parse(jsonText || "{}");
          } catch {
            return {};
          }
        })();
    return findLegalRisks(title, extra);
  }, [title, content, jsonText, isKnown]);

  useEffect(() => {
    setTitle(section.title);
    const c = (section.content as Record<string, unknown>) ?? {};
    setContent(c);
    setJsonText(JSON.stringify(c, null, 2));
  }, [section.id, section.title, section.content]);

  const toggle = (next: boolean) => {
    toggleSection.mutate(
      { id: section.id, data: { isEnabled: next } },
      {
        onSuccess: () => { onChanged(); toast({ title: next ? "Sekcja włączona" : "Sekcja wyłączona" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zmienić widoczności.", variant: "destructive" }),
      },
    );
  };

  const save = () => {
    let nextContent: Record<string, unknown>;
    if (isKnown) {
      nextContent = content;
    } else {
      try {
        nextContent = JSON.parse(jsonText || "{}");
      } catch {
        toast({ title: "Nieprawidłowy JSON", description: "Popraw treść JSON przed zapisem.", variant: "destructive" });
        return;
      }
    }
    updateSection.mutate(
      { id: section.id, data: { title, content: nextContent } },
      {
        onSuccess: () => { onChanged(); toast({ title: "Zapisano sekcję" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zapisać sekcji.", variant: "destructive" }),
      },
    );
  };

  const setField = (key: string, value: unknown) => setContent((c) => ({ ...c, [key]: value }));

  return (
    <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5 sm:p-6 flex gap-3 items-start justify-between">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" disabled={index === 0} onClick={() => onMove(index, -1)}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>

          <button className="flex items-start gap-3 text-left flex-1" onClick={() => setExpanded((e) => !e)}>
            <span className="mt-1 text-muted-foreground">{expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold font-display">{section.title}</h3>
                <Badge variant="outline" className="rounded-md font-mono text-[10px]">{section.key}</Badge>
                {!isKnown && <Badge variant="secondary" className="rounded-md text-[10px] gap-1"><Code className="w-3 h-3" />JSON</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{section.isEnabled ? "Sekcja widoczna na stronie" : "Sekcja ukryta"}</p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <Switch checked={section.isEnabled} onCheckedChange={toggle} />
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border/50 bg-muted/20 p-5 sm:p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Tytuł sekcji</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
            </div>

            {isKnown ? (
              fields!.map((field) => (
                <FieldEditor key={field.key} field={field} value={content[field.key]} onChange={(v) => setField(field.key, v)} />
              ))
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Treść (JSON)</Label>
                <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={10} className="rounded-xl font-mono text-xs" />
              </div>
            )}

            {risks.length > 0 && (
              <div className="rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Ryzykowne treści prawne
                </div>
                <ul className="list-disc pl-5 text-xs text-amber-700/90 dark:text-amber-300/90 space-y-0.5">
                  {risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
                  To ostrzeżenie nie blokuje zapisu.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button size="sm" className="rounded-xl" onClick={save} disabled={updateSection.isPending}>
                <Save className="w-4 h-4 mr-1" />Zapisz sekcję
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldEditor({ field, value, onChange }: {
  field: FieldDef; value: unknown; onChange: (value: unknown) => void;
}) {
  if (field.type === "text") {
    return (
      <div className="space-y-2">
        <Label className="text-xs">{field.label}</Label>
        <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className="rounded-xl" />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        <Label className="text-xs">{field.label}</Label>
        <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} className="rounded-xl" />
      </div>
    );
  }

  if (field.type === "stringList") {
    const list = Array.isArray(value) ? (value as unknown[]).map((v) => String(v ?? "")) : [];
    const update = (i: number, v: string) => onChange(list.map((item, idx) => (idx === i ? v : item)));
    const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
    const add = () => onChange([...list, ""]);
    return (
      <div className="space-y-2">
        <Label className="text-xs">{field.label}</Label>
        <div className="space-y-2">
          {list.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item} onChange={(e) => update(i, e.target.value)} className="rounded-xl" />
              <Button variant="outline" size="sm" className="rounded-xl shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => remove(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="rounded-xl w-full border-dashed" onClick={add}>
            <Plus className="w-4 h-4 mr-1" />Dodaj pozycję
          </Button>
        </div>
      </div>
    );
  }

  // objectList
  const subFields = field.fields ?? [];
  const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const updateItem = (i: number, key: string, v: string) =>
    onChange(list.map((item, idx) => (idx === i ? { ...item, [key]: v } : item)));
  const removeItem = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const addItem = () => {
    const empty: Record<string, unknown> = {};
    for (const sf of subFields) empty[sf.key] = "";
    onChange([...list, empty]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{field.label}</Label>
      <div className="space-y-3">
        {list.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <Button variant="ghost" size="sm" className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {subFields.map((sf) => (
              <div key={sf.key} className="space-y-1.5">
                <Label className="text-xs">{sf.label}</Label>
                {sf.type === "textarea" ? (
                  <Textarea value={String(item[sf.key] ?? "")} onChange={(e) => updateItem(i, sf.key, e.target.value)} rows={2} className="rounded-lg" />
                ) : (
                  <Input value={String(item[sf.key] ?? "")} onChange={(e) => updateItem(i, sf.key, e.target.value)} className="rounded-lg" />
                )}
              </div>
            ))}
          </div>
        ))}
        <Button variant="outline" size="sm" className="rounded-xl w-full border-dashed" onClick={addItem}>
          <Plus className="w-4 h-4 mr-1" />Dodaj pozycję
        </Button>
      </div>
    </div>
  );
}
