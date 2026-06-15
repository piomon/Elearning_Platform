import { useEffect, useState } from "react";
import { useGetAdminSeo, useUpdateSeo } from "@workspace/api-client-react";
import type { SeoSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Save } from "lucide-react";

type SeoForm = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonicalUrl: string;
  robots: string;
};

const EMPTY: SeoForm = {
  metaTitle: "",
  metaDescription: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  canonicalUrl: "",
  robots: "",
};

function fromSettings(s: SeoSettings): SeoForm {
  return {
    metaTitle: s.metaTitle ?? "",
    metaDescription: s.metaDescription ?? "",
    ogTitle: s.ogTitle ?? "",
    ogDescription: s.ogDescription ?? "",
    ogImage: s.ogImage ?? "",
    canonicalUrl: s.canonicalUrl ?? "",
    robots: s.robots ?? "",
  };
}

export default function AdminSeo() {
  const { data, isLoading } = useGetAdminSeo();
  const { toast } = useToast();
  const updateSeo = useUpdateSeo();
  const [form, setForm] = useState<SeoForm>(EMPTY);

  useEffect(() => {
    if (data) setForm(fromSettings(data));
  }, [data]);

  const set = <K extends keyof SeoForm>(key: K, value: SeoForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    updateSeo.mutate(
      { data: form },
      {
        onSuccess: () => toast({ title: "Zapisano ustawienia SEO" }),
        onError: () => toast({ title: "Błąd", description: "Nie udało się zapisać ustawień SEO.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Search className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Ustawienia SEO</h1>
          <p className="text-muted-foreground mt-1">Meta tagi i dane Open Graph strony</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-96 bg-muted animate-pulse rounded-3xl" />
      ) : (
        <Card className="rounded-3xl border-border shadow-sm bg-card">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Meta tytuł</Label>
                <span className={`text-xs ${form.metaTitle.length > 60 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {form.metaTitle.length} / ~60
                </span>
              </div>
              <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Meta opis</Label>
                <span className={`text-xs ${form.metaDescription.length > 160 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {form.metaDescription.length} / ~160
                </span>
              </div>
              <Textarea value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} rows={3} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Open Graph — tytuł</Label>
              <Input value={form.ogTitle} onChange={(e) => set("ogTitle", e.target.value)} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Open Graph — opis</Label>
              <Textarea value={form.ogDescription} onChange={(e) => set("ogDescription", e.target.value)} rows={3} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Open Graph — obraz (URL)</Label>
              <Input value={form.ogImage} onChange={(e) => set("ogImage", e.target.value)} placeholder="https://..." className="rounded-xl font-mono text-sm" />
            </div>

            <div className="space-y-2">
              <Label>Adres kanoniczny (URL)</Label>
              <Input value={form.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} placeholder="https://..." className="rounded-xl font-mono text-sm" />
            </div>

            <div className="space-y-2">
              <Label>Robots</Label>
              <Input value={form.robots} onChange={(e) => set("robots", e.target.value)} placeholder="index, follow" className="rounded-xl font-mono text-sm" />
            </div>

            <div className="flex justify-end pt-2">
              <Button className="rounded-xl" onClick={save} disabled={updateSeo.isPending}>
                <Save className="w-4 h-4 mr-2" />Zapisz ustawienia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
