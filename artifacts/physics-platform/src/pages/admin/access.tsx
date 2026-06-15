import { useState } from "react";
import {
  useListAccess,
  useCreateAccess,
  useRevokeAccessGrant,
  useListAccessHistory,
  useListAdminCourses,
  useListAdminUsers,
} from "@workspace/api-client-react";
import type { AdminAccessGrant } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Plus, Search, ShieldOff } from "lucide-react";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pl-PL");
}

const SOURCE_LABELS: Record<string, string> = {
  payment: "Płatność",
  admin: "Ręcznie",
  free: "Bezpłatny",
};

const ACTION_LABELS: Record<string, string> = {
  grant_access: "Nadanie dostępu",
  revoke_access: "Odebranie dostępu",
};

export default function AdminAccess() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [q, setQ] = useState("");
  const params = {
    ...(status !== "all" ? { status } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  };
  const { data: grants, isLoading, refetch } = useListAccess(params);
  const { data: courses } = useListAdminCourses();

  const createMut = useCreateAccess();
  const revokeMut = useRevokeAccessGrant();

  const [grantOpen, setGrantOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [validTo, setValidTo] = useState("");
  const [note, setNote] = useState("");

  const { data: userResults } = useListAdminUsers(
    { search: userSearch.trim(), limit: 10 },
    { query: { enabled: grantOpen && userSearch.trim().length >= 2 } } as never,
  );

  const resetGrant = () => {
    setUserSearch(""); setUserId(""); setCourseId(""); setValidTo(""); setNote("");
  };

  const grant = () => {
    if (!userId || !courseId) {
      toast({ title: "Błąd", description: "Wybierz użytkownika i kurs.", variant: "destructive" });
      return;
    }
    createMut.mutate(
      {
        data: {
          userId: Number(userId),
          courseId: Number(courseId),
          validTo: validTo ? new Date(validTo).toISOString() : null,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Dostęp nadany" });
          setGrantOpen(false);
          resetGrant();
          refetch();
        },
        onError: (e: any) =>
          toast({ title: "Błąd", description: e?.data?.error ?? "Nie udało się nadać dostępu.", variant: "destructive" }),
      },
    );
  };

  const revoke = (g: AdminAccessGrant) => {
    const reason = prompt(`Odebrać dostęp użytkownikowi ${g.email ?? `#${g.userId}`} do "${g.courseTitle ?? g.courseId}"? Możesz dodać notatkę:`);
    if (reason === null) return;
    revokeMut.mutate(
      { id: g.id, data: { note: reason.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Dostęp odebrany" });
          refetch();
        },
        onError: (e: any) =>
          toast({ title: "Błąd", description: e?.data?.error ?? "Nie udało się odebrać dostępu.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Dostępy</h1>
            <p className="text-muted-foreground mt-1">Kto ma dostęp do kursów i historia zmian</p>
          </div>
        </div>
        <Button className="rounded-xl" onClick={() => { resetGrant(); setGrantOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Nadaj dostęp
        </Button>
      </div>

      <Tabs defaultValue="grants">
        <TabsList>
          <TabsTrigger value="grants">Aktualne dostępy</TabsTrigger>
          <TabsTrigger value="history">Historia zmian</TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Szukaj po e-mailu, nazwisku lub kursie…"
                className="rounded-xl pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="rounded-xl w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktywne</SelectItem>
                <SelectItem value="inactive">Nieaktywne</SelectItem>
                <SelectItem value="all">Wszystkie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="h-96 bg-muted animate-pulse rounded-3xl" />
          ) : !grants || grants.length === 0 ? (
            <Card className="rounded-3xl border-border shadow-sm bg-card">
              <CardContent className="p-10 text-center text-muted-foreground">Brak dostępów spełniających kryteria.</CardContent>
            </Card>
          ) : (
            <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Użytkownik</TableHead>
                        <TableHead>Kurs</TableHead>
                        <TableHead>Źródło</TableHead>
                        <TableHead>Od</TableHead>
                        <TableHead>Do</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grants.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell>{g.email ?? `#${g.userId}`}</TableCell>
                          <TableCell className="text-muted-foreground">{g.courseTitle ?? `#${g.courseId}`}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{SOURCE_LABELS[g.source] ?? g.source}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDateTime(g.validFrom)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{g.validTo ? formatDateTime(g.validTo) : "Bezterminowo"}</TableCell>
                          <TableCell>
                            {g.status === "active" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15">Aktywny</Badge>
                            ) : (
                              <Badge variant="secondary">{g.status === "revoked" ? "Odebrany" : g.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {g.status === "active" && (
                              <Button variant="ghost" size="icon" title="Odbierz dostęp" onClick={() => revoke(g)}>
                                <ShieldOff className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <AccessHistoryTable />
        </TabsContent>
      </Tabs>

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nadaj dostęp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Użytkownik</Label>
              <Input
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUserId(""); }}
                placeholder="Wpisz e-mail lub nazwisko…"
                className="rounded-xl"
              />
              {userSearch.trim().length >= 2 && (userResults?.users?.length ?? 0) > 0 && !userId && (
                <div className="rounded-xl border border-border max-h-40 overflow-y-auto">
                  {userResults!.users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => { setUserId(String(u.id)); setUserSearch(`${u.firstName} ${u.lastName} (${u.email})`); }}
                    >
                      {u.firstName} {u.lastName} — {u.email}
                    </button>
                  ))}
                </div>
              )}
              {userId && <p className="text-xs text-emerald-600">Wybrano użytkownika #{userId}</p>}
            </div>
            <div className="space-y-2">
              <Label>Kurs</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Wybierz kurs" /></SelectTrigger>
                <SelectContent>
                  {(courses ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ważny do (opcjonalnie)</Label>
              <Input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Notatka (opcjonalnie)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Powód nadania dostępu…" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setGrantOpen(false)}>Anuluj</Button>
            <Button className="rounded-xl" onClick={grant} disabled={createMut.isPending}>Nadaj dostęp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessHistoryTable() {
  const { data, isLoading } = useListAccessHistory({ limit: 100 });
  if (isLoading) return <div className="h-96 bg-muted animate-pulse rounded-3xl" />;
  if (!data || data.logs.length === 0) {
    return (
      <Card className="rounded-3xl border-border shadow-sm bg-card">
        <CardContent className="p-10 text-center text-muted-foreground">Brak historii zmian dostępu.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Akcja</TableHead>
                <TableHead>Administrator</TableHead>
                <TableHead>Szczegóły</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log) => {
                const meta = (log.metadata ?? {}) as Record<string, unknown>;
                const noteText = typeof meta.note === "string" ? meta.note : "";
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={log.action === "revoke_access" ? "secondary" : "default"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.adminEmail ?? `#${log.adminId}`}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {meta.userId != null && `Użytkownik #${meta.userId}`}
                      {meta.courseId != null && `, kurs #${meta.courseId}`}
                      {noteText && <span className="block italic">„{noteText}”</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
