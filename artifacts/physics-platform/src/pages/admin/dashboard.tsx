import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, MessageSquare, Activity, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
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
    { title: "Użytkownicy", value: dashboard.totalUsers, icon: <Users className="h-5 w-5 text-blue-500" />, bg: "bg-blue-500/10" },
    { title: "Aktywne dostępy", value: dashboard.activeAccess, icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />, bg: "bg-emerald-500/10" },
    { title: "Liczba płatności", value: dashboard.totalPayments, icon: <CreditCard className="h-5 w-5 text-violet-500" />, bg: "bg-violet-500/10" },
    { title: "Przychód", value: `${dashboard.totalRevenue?.toFixed(2) || 0} PLN`, icon: <Activity className="h-5 w-5 text-amber-500" />, bg: "bg-amber-500/10" }
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
    </div>
  );
}
