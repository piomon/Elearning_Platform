import { useMemo } from "react";
import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, CreditCard, MessageSquare, Activity, ShieldCheck, TrendingUp,
  CheckCircle2, XCircle, FileText, ListChecks, UserPlus, FileEdit,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { formatPLN } from "@/lib/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  published: "Opublikowany",
  hidden: "Ukryty",
  archived: "Zarchiwizowany",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "published": return "bg-emerald-500/15 text-emerald-600";
    case "hidden": return "bg-amber-500/15 text-amber-600";
    case "archived": return "bg-muted text-muted-foreground";
    default: return "bg-primary/15 text-primary";
  }
}

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard();

  const loginsByDay = useMemo(() => {
    if (!dashboard) return [];
    const map = new Map<string, number>();
    for (const login of dashboard.recentLogins) {
      if (!login.loginAt) continue;
      const key = format(new Date(login.loginAt), "dd.MM", { locale: pl });
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map, ([day, count]) => ({ day, count })).reverse();
  }, [dashboard]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-96 bg-muted animate-pulse rounded-2xl" />
          <div className="h-96 bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const statCards = [
    { title: "Użytkownicy", value: String(dashboard.totalUsers), icon: <Users className="h-5 w-5 text-blue-500" />, bg: "bg-blue-500/10" },
    { title: "Aktywne dostępy", value: String(dashboard.activeAccess), icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />, bg: "bg-emerald-500/10" },
    { title: "Liczba płatności", value: String(dashboard.totalPayments), icon: <CreditCard className="h-5 w-5 text-violet-500" />, bg: "bg-violet-500/10" },
    { title: "Przychód", value: formatPLN(dashboard.totalRevenue ?? 0), icon: <Activity className="h-5 w-5 text-amber-500" />, bg: "bg-amber-500/10" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Kokpit Administratora</h1>
          <p className="text-muted-foreground mt-1">Przegląd systemu i kluczowe wskaźniki</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-shadow bg-card">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold font-display mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-medium">Przychód (7 dni)</p>
            </div>
            <p className="text-2xl font-bold font-display">{formatPLN(dashboard.revenue7d ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-medium">Przychód (30 dni)</p>
            </div>
            <p className="text-2xl font-bold font-display">{formatPLN(dashboard.revenue30d ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-2">Płatności</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold font-display text-xl">
                <CheckCircle2 className="h-5 w-5" />{dashboard.completedPayments ?? 0}
              </span>
              <span className="flex items-center gap-1.5 text-destructive font-bold font-display text-xl">
                <XCircle className="h-5 w-5" />{dashboard.failedPayments ?? 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">opłacone / nieudane</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-violet-500/10">
              <ListChecks className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Quizy</p>
              <p className="text-2xl font-bold font-display mt-1">{dashboard.totalQuizzes ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-500/10">
              <FileText className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tematy opublikowane</p>
              <p className="text-2xl font-bold font-display mt-1">{dashboard.publishedTopics ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tematy ukryte</p>
              <p className="text-2xl font-bold font-display mt-1">{dashboard.hiddenTopics ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tematy — szkice</p>
              <p className="text-2xl font-bold font-display mt-1">{dashboard.draftTopics ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-sm bg-card">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-blue-500/10">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nowe wiadomości</p>
              <p className="text-2xl font-bold font-display mt-1">{dashboard.newMessages ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-bold">Aktywność logowań</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loginsByDay.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loginsByDay} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="loginsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" stroke="hsl(var(--muted-foreground))" width={32} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    labelStyle={{ fontWeight: 700 }}
                    formatter={(value: number) => [`${value}`, "Logowania"]}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#loginsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">Brak danych o aktywności</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold">Ostatnie logowania</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {dashboard.recentLogins.length > 0 ? (
              <div className="divide-y divide-border">
                {dashboard.recentLogins.map((login, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-muted/20 transition-colors gap-2 sm:gap-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {login.firstName[0]}{login.lastName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{login.firstName} {login.lastName}</p>
                        <p className="text-xs text-muted-foreground">{login.email}</p>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full self-start sm:self-auto">
                      {login.loginAt ? format(new Date(login.loginAt), "dd MMM HH:mm", { locale: pl }) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Brak ostatnich logowań</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold">Wiadomości kontaktowe</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {dashboard.recentMessages.length > 0 ? (
              <div className="divide-y divide-border">
                {dashboard.recentMessages.map((msg) => (
                  <div key={msg.id} className="p-4 sm:px-6 hover:bg-muted/20 transition-colors">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-bold text-sm truncate">{msg.subject}</p>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider shrink-0
                        ${msg.status === 'new' ? 'bg-primary/20 text-primary' :
                          msg.status === 'read' ? 'bg-amber-500/20 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                        {msg.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">Od: {msg.name} ({msg.email})</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Brak nowych wiadomości</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold">Ostatnie płatności</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {dashboard.recentPayments && dashboard.recentPayments.length > 0 ? (
              <div className="divide-y divide-border">
                {dashboard.recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/20 transition-colors gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.createdAt ? format(new Date(p.createdAt), "dd MMM HH:mm", { locale: pl }) : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold font-display text-sm">{formatPLN(p.amount, p.currency)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider
                        ${p.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600' :
                          p.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Brak płatności</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-bold">Nowi użytkownicy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {dashboard.recentUsers && dashboard.recentUsers.length > 0 ? (
              <div className="divide-y divide-border">
                {dashboard.recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/20 transition-colors gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="rounded-md text-[10px]">{u.role}</Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {u.createdAt ? format(new Date(u.createdAt), "dd MMM", { locale: pl }) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">Brak nowych użytkowników</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border shadow-sm bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-bold">Ostatnio edytowane tematy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dashboard.recentTopics && dashboard.recentTopics.length > 0 ? (
            <div className="divide-y divide-border">
              {dashboard.recentTopics.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/20 transition-colors gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.sectionTitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusBadgeClass(t.status)}`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t.updatedAt ? format(new Date(t.updatedAt), "dd MMM HH:mm", { locale: pl }) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">Brak edytowanych tematów</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
