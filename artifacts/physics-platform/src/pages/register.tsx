import { Link, Redirect } from "wouter";
import { useAuth as useClerkAuth, SignUp } from "@clerk/clerk-react";
import { BookOpen } from "lucide-react";

export default function Register() {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const base = import.meta.env.BASE_URL;

  // Zalogowanego użytkownika przekierowujemy deklaratywnie (raz), zamiast
  // wołać setLocation w useEffect — to eliminuje pętlę przekierowań powstającą
  // w wyścigu z własnym przekierowaniem komponentu <SignUp/> Clerka. Dzięki
  // wcześniejszemu return komponent <SignUp/> nie renderuje się dla zalogowanych.
  if (isLoaded && isSignedIn) {
    return <Redirect to="/dashboard" replace />;
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 justify-center mb-6 hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary-foreground font-bold shadow-lg bg-primary">
              <BookOpen className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">
            Rozpocznij naukę
          </h1>
          <p className="text-muted-foreground mt-2">
            Załóż konto dla siebie lub swojego dziecka
          </p>
        </div>

        <SignUp
          routing="hash"
          signInUrl={`${base}login`}
          fallbackRedirectUrl={`${base}dashboard`}
        />
      </div>
    </div>
  );
}
