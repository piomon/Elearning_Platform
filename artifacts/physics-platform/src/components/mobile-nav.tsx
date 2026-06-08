import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGetContinueProgress } from "@workspace/api-client-react";
import { LayoutDashboard, PlayCircle, LifeBuoy, LogOut } from "lucide-react";

type Item = {
  key: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isActive: (loc: string) => boolean;
};

export function MobileNav() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: cont } = useGetContinueProgress({
    query: { enabled: !!user } as any,
  });

  // Bottom nav is a student-facing convenience; admins use the full header nav.
  if (!user || user.role === "admin") return null;

  const learnHref = cont?.topicId ? `/topics/${cont.topicId}` : "/dashboard";

  const items: Item[] = [
    {
      key: "dashboard",
      label: "Pulpit",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      isActive: (loc) => loc === "/dashboard",
    },
    {
      key: "learn",
      label: "Nauka",
      href: learnHref,
      icon: <PlayCircle className="w-5 h-5" />,
      isActive: (loc) =>
        loc.startsWith("/topics") ||
        loc.startsWith("/sections") ||
        loc.startsWith("/courses"),
    },
    {
      key: "help",
      label: "Pomoc",
      href: "/#kontakt",
      icon: <LifeBuoy className="w-5 h-5" />,
      isActive: () => false,
    },
    {
      key: "logout",
      label: "Wyloguj",
      icon: <LogOut className="w-5 h-5" />,
      onClick: logout,
      isActive: () => false,
    },
  ];

  return (
    <nav
      aria-label="Nawigacja mobilna"
      className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.isActive(location);
          const inner = (
            <span
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-xl px-4 py-1 transition-colors ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </span>
          );

          return (
            <li key={item.key} className="flex">
              {item.href ? (
                <Link href={item.href} className="flex-1">
                  {inner}
                </Link>
              ) : (
                <button onClick={item.onClick} className="flex-1" aria-label={item.label}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
