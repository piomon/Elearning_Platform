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
import { Users, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";

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
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Baza Użytkowników</h1>
          <p className="text-muted-foreground mt-1">Zarządzaj kontami uczniów i rodziców</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          <div className="p-4 sm:p-6 bg-muted/30 border-b border-border/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Szukaj po e-mailu lub nazwisku..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-11 rounded-xl bg-background border-border/50 shadow-sm"
              />
            </div>
            <div className="relative w-full sm:w-[220px]">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground">
                <Filter className="w-4 h-4" />
              </div>
              <Select value={filter} onValueChange={(v) => { setFilter(v as ListAdminUsersFilter); setPage(1); }}>
                <SelectTrigger className="h-11 pl-9 rounded-xl bg-background border-border/50 shadow-sm">
                  <SelectValue placeholder="Filtruj status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Wszyscy użytkownicy</SelectItem>
                  <SelectItem value="active">Aktywny dostęp</SelectItem>
                  <SelectItem value="no_access">Brak dostępu</SelectItem>
                  <SelectItem value="banned">Zablokowani</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="border-border">
                  <TableHead className="font-semibold px-6 py-4">Użytkownik</TableHead>
                  <TableHead className="font-semibold py-4">Status</TableHead>
                  <TableHead className="font-semibold py-4">Ostatnie logowanie</TableHead>
                  <TableHead className="font-semibold px-6 py-4 text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-6 py-4"><div className="h-10 bg-muted animate-pulse rounded-lg" /></TableCell>
                      <TableCell className="py-4"><div className="h-6 w-20 bg-muted animate-pulse rounded-full" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell className="px-6 py-4 text-right"><div className="h-9 w-20 bg-muted animate-pulse rounded-lg ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.users.map((user) => (
                  <TableRow key={user.id} className="border-border/50 hover:bg-muted/20">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {user.isBanned ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                          Zablokowany
                        </span>
                      ) : user.hasAccess ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
                          Aktywny dostęp
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                          Brak dostępu
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {user.lastLoginAt ? (
                        <div className="text-sm font-medium">
                          {format(new Date(user.lastLoginAt), "dd.MM.yyyy", { locale: pl })}
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(new Date(user.lastLoginAt), "HH:mm", { locale: pl })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Nigdy</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="secondary" size="sm" className="rounded-full font-semibold hover:bg-primary hover:text-primary-foreground">
                          Szczegóły
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && data?.users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-muted-foreground/30" />
                        <p>Brak użytkowników spełniających kryteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
            <span className="text-sm text-muted-foreground ml-2">
              Strona {page}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-full px-4 border-border/60">
                <ChevronLeft className="w-4 h-4 mr-1" /> Poprzednia
              </Button>
              <Button variant="outline" size="sm" disabled={!data || data.users.length < 20} onClick={() => setPage(p => p + 1)} className="rounded-full px-4 border-border/60">
                Następna <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
