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
      <header
        className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(6, 8, 20, 0.85)", backdropFilter: "blur(20px)" }}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={user ? (isAdmin ? "/admin" : "/dashboard") : "/"} className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
            >
              F
            </div>
            <span
              className="font-bold text-xl hidden sm:block"
              style={{
                background: "linear-gradient(135deg, #60A5FA, #A78BFA)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              FizykaAI
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            {!user ? (
              <>
                <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
                  Zaloguj się
                </Link>
                <Link href="/register">
                  <Button
                    size="sm"
                    className="text-white font-semibold"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
                  >
                    Zarejestruj się
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Panel Admina
                  </Link>
                )}
                {!isAdmin && (
                  <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Moja nauka
                  </Link>
                )}
                <span className="text-sm text-muted-foreground hidden sm:block border-l border-white/10 pl-3">
                  {user.firstName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Wyloguj
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      {!isDashboard && !location.startsWith("/admin") && (
        <footer className="border-t border-white/5 py-10">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-xs"
                style={{ background: "linear-gradient(135deg, #3B82F6, #8B5CF6)" }}
              >
                F
              </div>
              <span className="font-medium">FizykaAI</span>
            </div>
            <p>&copy; {new Date().getFullYear()} FizykaAI. Wszelkie prawa zastrzeżone.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
