import { useRoute } from "wouter";
import { useGetAdminUser, useBanUser, useUnbanUser, useGrantAccess, useRevokeAccess, useGetUserLoginStats, useRefundPayment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCog, ShieldAlert, ShieldCheck, KeyRound, Lock, CreditCard, Activity, ArrowLeft, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminUserDetail() {
  const [match, params] = useRoute("/admin/users/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: user, isLoading, refetch } = useGetAdminUser(id, {
    query: { enabled: !!id } as any,
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: loginStats } = useGetUserLoginStats(id, currentMonth, {
    query: { enabled: !!id } as any,
  });

  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const grantAccess = useGrantAccess();
  const revokeAccess = useRevokeAccess();
  const refundPayment = useRefundPayment();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-[400px] bg-muted animate-pulse rounded-3xl" />
          <div className="h-[400px] bg-muted animate-pulse rounded-3xl" />
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-md">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <UserCog className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-2xl font-bold font-display mb-2 text-destructive">Nie znaleziono użytkownika</h2>
        <Button variant="outline" className="rounded-full mt-4" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do listy
        </Button>
      </div>
    );
  }

  const handleBan = () => {
    const reason = prompt("Podaj powód blokady:");
    if (reason) {
      banUser.mutate({ id, data: { reason } }, { onSuccess: () => { refetch(); toast({ title: "Zablokowano konto", variant: "destructive" }); } });
    }
  };

  const handleGrant = () => {
    // Hardcoded courseId 1 for now based on instructions
    grantAccess.mutate({ id, data: { courseId: 1 } }, { onSuccess: () => { refetch(); toast({ title: "Przyznano dostęp", className: "bg-success text-success-foreground border-success/20" }); } });
  };

  const handleRefund = (paymentId: number) => {
    const reason = prompt("Podaj powód zwrotu:");
    if (reason) {
      refundPayment.mutate({ paymentId, data: { reason } }, {
        onSuccess: () => { refetch(); toast({ title: "Zlecono zwrot", className: "bg-success text-success-foreground border-success/20" }); },
        onError: () => toast({ title: "Błąd", description: "Nie udało się zlecić zwrotu.", variant: "destructive" })
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
      <Button variant="ghost" className="mb-2 -ml-4 text-muted-foreground hover:text-foreground rounded-full" onClick={() => window.history.back()}>
        <ArrowLeft className="w-5 h-5 mr-1" /> Wróć do listy użytkowników
      </Button>

      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shrink-0">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight font-display">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-muted-foreground font-medium">{user.email}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {user.isBanned ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Zablokowany
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Aktywny
            </span>
          )}
          
          {user.hasAccess ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Pełny Dostęp
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Brak dostępu
            </span>
          )}
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="w-5 h-5 text-primary" /> Zarządzanie Kontem
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                <span className="text-muted-foreground block mb-1">ID Użytkownika</span>
                <span className="font-bold font-mono">#{user.id}</span>
              </div>
              <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                <span className="text-muted-foreground block mb-1">Data rejestracji</span>
                <span className="font-bold">{format(new Date(user.createdAt), "dd.MM.yyyy", { locale: pl })}</span>
              </div>
            </div>

            {user.isBanned && user.bannedReason && (
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
                <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">Powód blokady</p>
                <p className="text-sm font-medium text-destructive/90">{user.bannedReason}</p>
                {user.bannedAt && <p className="text-xs text-destructive/70 mt-2">Zablokowano: {format(new Date(user.bannedAt), "dd.MM.yyyy HH:mm")}</p>}
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">Akcje Administracyjne</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {user.isBanned ? (
                  <Button variant="outline" className="rounded-xl h-12 border-success/30 text-success hover:bg-success/10 hover:text-success" 
                    onClick={() => unbanUser.mutate({ id }, { onSuccess: () => { refetch(); toast({ title: "Odblokowano konto", className: "bg-success text-white" }); } })}>
                    <ShieldCheck className="w-4 h-4 mr-2" /> Odblokuj
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-xl h-12 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" 
                    onClick={handleBan}>
                    <ShieldAlert className="w-4 h-4 mr-2" /> Zablokuj
                  </Button>
                )}
                
                {user.hasAccess ? (
                  <Button variant="outline" className="rounded-xl h-12" 
                    onClick={() => revokeAccess.mutate({ id }, { onSuccess: () => { refetch(); toast({ title: "Zabrano dostęp" }); } })}>
                    <Lock className="w-4 h-4 mr-2" /> Zabierz dostęp
                  </Button>
                ) : (
                  <Button className="rounded-xl h-12 bg-primary hover:bg-primary/90 text-primary-foreground" 
                    onClick={handleGrant}>
                    <KeyRound className="w-4 h-4 mr-2" /> Nadaj dostęp
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" /> Aktywność
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                <span className="font-medium">Logowania w tym miesiącu</span>
                <span className="text-2xl font-black font-display text-primary">{loginStats?.count ?? 0}</span>
              </div>
              
              {loginStats && loginStats.events && loginStats.events.length > 0 ? (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-bold text-muted-foreground mb-2">Ostatnie sesje</h4>
                  {loginStats.events.slice(0, 3).map((event, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-3 bg-muted/30 rounded-xl border border-border/50">
                      <span className="font-medium">{format(new Date(event.createdAt), "dd.MM.yyyy", { locale: pl })}</span>
                      <span className="text-muted-foreground">{format(new Date(event.createdAt), "HH:mm")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Brak zarejestrowanych logowań w historii</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border shadow-sm bg-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-5 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-primary" /> Płatności
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {user.payments && user.payments.length > 0 ? (
                <div className="divide-y divide-border">
                  {user.payments.map(p => (
                    <div key={p.id} className="p-6 hover:bg-muted/10 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">{p.amount} {p.currency}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(p.createdAt), "dd MMM yyyy, HH:mm", { locale: pl })}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider
                          ${p.status === 'completed' ? 'bg-success/20 text-success' : p.status === 'refunded' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                          {p.status}
                        </span>
                      </div>
                      
                      {p.status === 'completed' && (!p.refunds || p.refunds.length === 0) && (
                        <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                          <Button variant="outline" size="sm" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                            onClick={() => handleRefund(p.id)}
                            disabled={refundPayment.isPending}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Zleć zwrot (Refund)
                          </Button>
                        </div>
                      )}
                      
                      {p.refunds && p.refunds.length > 0 && (
                        <div className="mt-4 bg-destructive/5 border border-destructive/10 p-3 rounded-xl">
                          <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">Status zwrotu</p>
                          {p.refunds.map(r => (
                            <div key={r.id} className="flex justify-between text-sm">
                              <span>Kwota: {r.amount}</span>
                              <span className="font-medium text-destructive">{r.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
                  <CreditCard className="w-10 h-10 mb-3 opacity-20" />
                  <p>Brak zarejestrowanych płatności</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
