import { useState } from "react";
import { Link } from "wouter";
import { useListAdminUsers, ListAdminUsersFilter } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListAdminUsersFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAdminUsers({
    search: search || undefined,
    filter: filter,
    page,
    limit: 20
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Użytkownicy</h1>

      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie użytkownikami</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Input 
              placeholder="Szukaj po e-mailu lub nazwisku..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as ListAdminUsersFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtruj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy</SelectItem>
                <SelectItem value="active">Aktywny dostęp</SelectItem>
                <SelectItem value="no_access">Brak dostępu</SelectItem>
                <SelectItem value="banned">Zablokowani</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i Nazwisko</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ostatnie logowanie</TableHead>
                  <TableHead>Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center">Ładowanie...</TableCell></TableRow>
                ) : data?.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <span className="text-destructive font-medium">Zablokowany</span>
                      ) : user.hasAccess ? (
                        <span className="text-success font-medium">Aktywny</span>
                      ) : (
                        <span className="text-muted-foreground">Brak dostępu</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd.MM.yyyy HH:mm", { locale: pl }) : "Nigdy"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm">Profil</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && data?.users.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Brak użytkowników spełniających kryteria</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Poprzednia</Button>
            <Button variant="outline" disabled={!data || data.users.length < 20} onClick={() => setPage(p => p + 1)}>Następna</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
