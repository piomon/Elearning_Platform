import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { BuyAccessButton } from "@/components/buy-access-button";

// The API client requests a bearer token on every call. We keep the latest
// Clerk getToken in a module-level ref and register the getter exactly once, so
// the singleton always reaches the current Clerk session without re-binding.
let clerkGetToken: (() => Promise<string | null>) | null = null;
setAuthTokenGetter(async () => (clerkGetToken ? clerkGetToken() : null));

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    clerkGetToken = getToken;
  }, [getToken]);

  const {
    data: user,
    isLoading: isUserLoading,
    error,
    refetch,
  } = useGetMe({
    query: { enabled: isLoaded && isSignedIn === true, retry: false } as never,
  });

  const logout = useCallback(() => {
    void signOut();
    setLocation("/login");
  }, [signOut, setLocation]);

  // A valid Clerk session but a rejecting backend (unverified email, transient
  // failure) leaves us in a broken state — sign out to recover cleanly.
  useEffect(() => {
    if (error) {
      logout();
    }
  }, [error, logout]);

  useEffect(() => {
    if (user?.isBanned) {
      alert(
        `Twoje konto zostało zablokowane. Powód: ${
          user.bannedReason || "Brak podanego powodu"
        }`,
      );
      logout();
    }
  }, [user, logout]);

  const isLoading = !isLoaded || (isSignedIn === true && isUserLoading);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        logout,
        refresh: () => {
          void refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Ładowanie...
      </div>
    );
  if (!user) return null;

  return <>{children}</>;
}

export function AccessRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Ładowanie...
      </div>
    );
  if (!user) return null;

  const canAccess = user.hasAccess || user.role === "admin";
  if (!canAccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-muted/30">
        <div className="text-center space-y-6 max-w-lg bg-card p-10 sm:p-14 rounded-3xl border border-border shadow-xl">
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">
            Ta treść wymaga dostępu
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Aby zobaczyć materiały kursu, quizy i zadania, potrzebny jest aktywny
            dostęp do platformy.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <BuyAccessButton />
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center justify-center rounded-full h-12 px-8 text-base font-bold border border-border bg-background hover:bg-muted transition-colors"
            >
              Zobacz ofertę
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (user.role !== "admin") {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, setLocation]);

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Ładowanie...
      </div>
    );
  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}
