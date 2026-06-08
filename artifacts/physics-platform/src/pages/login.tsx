import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Nieprawidłowy adres email" }),
  password: z.string().min(6, { message: "Hasło musi mieć minimum 6 znaków" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: authLogin } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        if (data.user.isBanned) {
          toast({
            title: "Konto zablokowane",
            description: `Twoje konto zostało zablokowane. Powód: ${data.user.bannedReason || "Brak podanego powodu"}`,
            variant: "destructive",
          });
          return;
        }
        authLogin(data.token);
        if (data.user.role === "admin") {
          setLocation("/admin");
        } else {
          setLocation("/dashboard");
        }
      },
      onError: (error) => {
        toast({
          title: "Błąd logowania",
          description: error.message || "Nie udało się zalogować. Sprawdź dane.",
          variant: "destructive",
        });
      },
    }
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center mb-6 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary-foreground font-bold shadow-lg bg-primary">
              <BookOpen className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Witaj ponownie</h1>
          <p className="text-muted-foreground mt-2">Zaloguj się, aby kontynuować naukę fizyki</p>
        </div>

        <Card className="shadow-xl border-border rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold text-foreground/80">Adres email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jan@example.com"
                  {...form.register("email")}
                  className={`h-12 rounded-xl bg-muted/50 ${form.formState.errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold text-foreground/80">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  className={`h-12 rounded-xl bg-muted/50 ${form.formState.errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full text-base font-bold h-14 rounded-full mt-4 group"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Logowanie..." : "Zaloguj się"} 
                {!loginMutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-muted/30 p-6 flex justify-center border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">
              Nie masz jeszcze konta? <Link href="/register" className="text-primary hover:underline ml-1">Załóż konto</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
