import { useLocation, Link } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, ArrowRight } from "lucide-react";

const registerSchema = z.object({
  firstName: z.string().min(1, { message: "Imię jest wymagane" }),
  lastName: z.string().min(1, { message: "Nazwisko jest wymagane" }),
  email: z.string().email({ message: "Nieprawidłowy adres email" }),
  password: z
    .string()
    .min(8, { message: "Hasło musi mieć minimum 8 znaków" })
    .regex(/[A-Za-z]/, { message: "Hasło musi zawierać literę" })
    .regex(/[0-9]/, { message: "Hasło musi zawierać cyfrę" }),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Akceptacja regulaminu jest wymagana" }),
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login: authLogin } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      consent: false as unknown as true,
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        authLogin(data.token);
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({
          title: "Błąd rejestracji",
          description: error.message || "Nie udało się zarejestrować. Spróbuj ponownie.",
          variant: "destructive",
        });
      },
    }
  });

  const onSubmit = (values: RegisterFormValues) => {
    const { consent, ...data } = values;
    void consent;
    registerMutation.mutate({ data });
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
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Rozpocznij naukę</h1>
          <p className="text-muted-foreground mt-2">Załóż konto dla siebie lub swojego dziecka</p>
        </div>

        <Card className="shadow-xl border-border rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-semibold text-foreground/80">Imię</Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName")}
                    className={`h-12 rounded-xl bg-muted/50 ${form.formState.errors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive font-medium">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-semibold text-foreground/80">Nazwisko</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    className={`h-12 rounded-xl bg-muted/50 ${form.formState.errors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-destructive font-medium">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold text-foreground/80">Email</Label>
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
                {form.formState.errors.password ? (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.password.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Minimum 8 znaków, w tym litera i cyfra.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Controller
                    control={form.control}
                    name="consent"
                    render={({ field }) => (
                      <Checkbox
                        id="consent"
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                        className="mt-0.5"
                      />
                    )}
                  />
                  <Label htmlFor="consent" className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
                    Akceptuję{" "}
                    <Link href="/regulamin" className="text-primary hover:underline font-medium">regulamin</Link>{" "}
                    oraz{" "}
                    <Link href="/polityka-prywatnosci" className="text-primary hover:underline font-medium">politykę prywatności</Link>.
                  </Label>
                </div>
                {form.formState.errors.consent && (
                  <p className="text-sm text-destructive font-medium">{form.formState.errors.consent.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full text-base font-bold h-14 rounded-full mt-4 group"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Rejestrowanie..." : "Załóż konto"}
                {!registerMutation.isPending && <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-muted/30 p-6 flex justify-center border-t border-border">
            <p className="text-sm font-medium text-muted-foreground">
              Masz już konto? <Link href="/login" className="text-primary hover:underline ml-1">Zaloguj się</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
