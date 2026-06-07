import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";
  const isDashboard = location.startsWith("/dashboard") || location.startsWith("/courses") || location.startsWith("/sections") || location.startsWith("/topics");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={user ? (isAdmin ? "/admin" : "/dashboard") : "/"} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl">
              F
            </div>
            <span className="font-bold text-xl text-foreground hidden sm:block">
              FizykaAI
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            {!user ? (
              <>
                <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">
                  Zaloguj się
                </Link>
                <Link href="/register">
                  <Button size="sm">Zarejestruj się</Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
                    Panel Admina
                  </Link>
                )}
                {!isAdmin && (
                  <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                    Moja nauka
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    {user.firstName}
                  </span>
                  <Button variant="ghost" size="sm" onClick={logout}>
                    Wyloguj
                  </Button>
                </div>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {!isDashboard && !location.startsWith("/admin") && (
        <footer className="bg-card border-t py-12">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} FizykaAI. Wszelkie prawa zastrzeżone.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
