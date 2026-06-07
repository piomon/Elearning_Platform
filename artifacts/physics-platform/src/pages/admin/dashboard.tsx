import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, MessageSquare, Activity } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminDashboard() {
  const { data: dashboard, isLoading } = useGetAdminDashboard();

  if (isLoading) return <div className="p-8 text-center">Ładowanie panelu...</div>;
  if (!dashboard) return null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Panel Administratora</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Całkowita liczba użytkowników</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne dostępy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.activeAccess}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba płatności</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalPayments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Przychód (PLN)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalRevenue?.toFixed(2) || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Ostatnie logowania</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentLogins.map((login, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{login.firstName} {login.lastName}</p>
                    <p className="text-sm text-muted-foreground">{login.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {login.loginAt ? format(new Date(login.loginAt), "dd MMM HH:mm", { locale: pl }) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ostatnie wiadomości kontaktowe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentMessages.map((msg) => (
                <div key={msg.id} className="border-b pb-2 last:border-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium">{msg.subject}</p>
                    <span className="text-xs px-2 py-1 bg-secondary rounded-full">{msg.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">od: {msg.name} ({msg.email})</p>
                </div>
              ))}
              {dashboard.recentMessages.length === 0 && (
                <p className="text-muted-foreground text-center">Brak nowych wiadomości</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
