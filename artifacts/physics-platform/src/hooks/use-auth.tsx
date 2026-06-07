import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

// Setup token getter for API client
setAuthTokenGetter(() => localStorage.getItem("token"));

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, error, refetch } = useGetMe({
    query: { enabled: !!token, retry: false } as any,
  });

  useEffect(() => {
    if (error) {
      logout();
    }
  }, [error]);

  useEffect(() => {
    if (user?.isBanned) {
      alert(`Twoje konto zostało zablokowane. Powód: ${user.bannedReason || "Brak podanego powodu"}`);
      logout();
    }
  }, [user]);

  const login = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setTokenState(newToken);
    refetch();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setTokenState(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: isUserLoading && !!token,
        login,
        logout,
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
  if (!user) return null;

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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}
