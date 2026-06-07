import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Moon, Sun, BookOpen } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const isAdmin = user?.role === "admin";
  const isDashboard = location.startsWith("/dashboard") || location.startsWith("/courses") || location.startsWith("/sections") || location.startsWith("/topics");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <header
        className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={user ? (isAdmin ? "/admin" : "/dashboard") : "/"} className="flex items-center gap-2 group transition-transform hover:scale-105 active:scale-95">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground font-bold shadow-sm bg-primary"
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <span
              className="font-display font-bold text-xl tracking-tight hidden sm:block text-foreground"
            >
              FizykaAI
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="rounded-full w-9 h-9"
              aria-label="Zmień motyw"
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
            </Button>

            {!user ? (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 hidden sm:block">
                  Zaloguj się
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="font-semibold rounded-full px-5 shadow-sm"
                  >
                    Załóż konto
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-3">
                {isAdmin ? (
                  <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 hidden sm:block">
                    Panel Admina
                  </Link>
                ) : (
                  <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 hidden sm:block">
                    Moja nauka
                  </Link>
                )}
                
                <span className="text-sm font-medium text-foreground bg-muted px-3 py-1 rounded-full hidden md:block">
                  {user.firstName}
                </span>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground font-medium"
                >
                  Wyloguj
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {!isDashboard && !location.startsWith("/admin") && (
        <footer className="border-t border-border/40 py-12 bg-card mt-auto">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-primary-foreground font-bold text-xs bg-primary"
              >
                <BookOpen className="w-3 h-3" />
              </div>
              <span className="font-display font-bold tracking-tight text-foreground">FizykaAI</span>
            </div>
            <p className="text-center md:text-left">
              &copy; {new Date().getFullYear()} FizykaAI. Edukacja z przyszłością.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
