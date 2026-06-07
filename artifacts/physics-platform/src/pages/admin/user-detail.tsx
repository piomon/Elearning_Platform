import { useRoute } from "wouter";
import { useGetAdminUser, useBanUser, useUnbanUser, useGrantAccess, useRevokeAccess } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminUserDetail() {
  const [match, params] = useRoute("/admin/users/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: user, isLoading, refetch } = useGetAdminUser(id, {
    query: { enabled: !!id } as any,
  });

  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const grantAccess = useGrantAccess();
  const revokeAccess = useRevokeAccess();

  if (isLoading) return <div className="p-8 text-center">Ładowanie użytkownika...</div>;
  if (!user) return <div className="p-8 text-center text-destructive">Nie znaleziono użytkownika</div>;

  const handleBan = () => {
    const reason = prompt("Podaj powód blokady:");
    if (reason) {
      banUser.mutate({ id, data: { reason } }, { onSuccess: () => { refetch(); toast({ title: "Zablokowano" }); } });
    }
  };

  const handleGrant = () => {
    grantAccess.mutate({ id, data: { courseId: 1 } }, { onSuccess: () => { refetch(); toast({ title: "Przyznano dostęp" }); } });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Profil użytkownika: {user.firstName} {user.lastName}</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Dane podstawowe</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Status:</strong> {user.isBanned ? "Zablokowany" : "Aktywny"}</p>
            <p><strong>Dostęp:</strong> {user.hasAccess ? "Tak" : "Nie"}</p>
            <div className="flex gap-2 mt-4">
              {user.isBanned ? (
                <Button variant="outline" onClick={() => unbanUser.mutate({ id }, { onSuccess: () => { refetch(); } })}>Odblokuj</Button>
              ) : (
                <Button variant="destructive" onClick={handleBan}>Zablokuj</Button>
              )}
              {user.hasAccess ? (
                <Button variant="outline" onClick={() => revokeAccess.mutate({ id }, { onSuccess: () => { refetch(); } })}>Zabierz dostęp</Button>
              ) : (
                <Button onClick={handleGrant}>Nadaj dostęp</Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Historia płatności</CardTitle></CardHeader>
          <CardContent>
            {user.payments && user.payments.length > 0 ? (
              <ul className="space-y-2">
                {user.payments.map(p => (
                  <li key={p.id} className="border-b pb-2">
                    {p.amount} {p.currency} - {p.status} ({new Date(p.createdAt).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Brak płatności</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
