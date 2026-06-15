import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  LayoutTemplate,
  Tag,
  HelpCircle,
  Search,
  MessageSquare,
  ScrollText,
  Menu,
  ArrowLeft,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AdminRoute } from "@/hooks/use-auth";

type NavItem = { href: string; label: string; icon: ReactNode };
type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: "Główne",
    items: [
      { href: "/admin", label: "Kokpit", icon: <LayoutDashboard className="w-5 h-5" /> },
      { href: "/admin/users", label: "Użytkownicy", icon: <Users className="w-5 h-5" /> },
      { href: "/admin/course", label: "Kursy", icon: <BookOpen className="w-5 h-5" /> },
    ],
  },
  {
    heading: "Treść strony",
    items: [
      { href: "/admin/landing", label: "Strona główna", icon: <LayoutTemplate className="w-5 h-5" /> },
      { href: "/admin/pricing", label: "Cennik", icon: <Tag className="w-5 h-5" /> },
      { href: "/admin/faq", label: "FAQ", icon: <HelpCircle className="w-5 h-5" /> },
      { href: "/admin/seo", label: "SEO", icon: <Search className="w-5 h-5" /> },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/admin/contact", label: "Wiadomości", icon: <MessageSquare className="w-5 h-5" /> },
      { href: "/admin/logs", label: "Logi", icon: <ScrollText className="w-5 h-5" /> },
    ],
  },
];

const FLAT_NAV = NAV.flatMap((g) => g.items);

// Sub-pages that aren't top-level nav entries still need a breadcrumb trail.
const DEEP_CRUMBS: { match: (path: string) => boolean; parent: NavItem; label: string }[] = [
  {
    match: (p) => /^\/admin\/users\/[^/]+$/.test(p),
    parent: FLAT_NAV.find((n) => n.href === "/admin/users")!,
    label: "Szczegóły użytkownika",
  },
  {
    match: (p) => p === "/admin/course-debug",
    parent: FLAT_NAV.find((n) => n.href === "/admin/course")!,
    label: "Diagnostyka kursu",
  },
];

function isActive(href: string, location: string): boolean {
  if (href === "/admin") return location === "/admin";
  return location === href || location.startsWith(href + "/");
}

function resolveCrumbs(location: string): { label: string; href?: string }[] {
  const exact = FLAT_NAV.find((n) => n.href === location);
  if (exact) {
    return exact.href === "/admin"
      ? [{ label: "Kokpit" }]
      : [{ label: "Kokpit", href: "/admin" }, { label: exact.label }];
  }
  const deep = DEEP_CRUMBS.find((d) => d.match(location));
  if (deep) {
    return [
      { label: "Kokpit", href: "/admin" },
      { label: deep.parent.label, href: deep.parent.href },
      { label: deep.label },
    ];
  }
  return [{ label: "Kokpit", href: "/admin" }];
}

function SidebarNav({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6 p-4">
      {NAV.map((group) => (
        <div key={group.heading} className="space-y-1">
          <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
            {group.heading}
          </p>
          {group.items.map((item) => {
            const active = isActive(item.href, location);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 px-5 h-16 border-b border-border shrink-0">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <Zap className="w-5 h-5 fill-primary" />
      </div>
      <div className="leading-tight">
        <p className="font-black tracking-tight">fizyka7</p>
        <p className="text-[11px] text-muted-foreground font-medium">Panel administratora</p>
      </div>
    </Link>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const crumbs = resolveCrumbs(location);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] border-r border-border bg-card overflow-y-auto">
          <SidebarBrand />
          <SidebarNav location={location} />
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetTitle className="sr-only">Nawigacja panelu administratora</SheetTitle>
            <SidebarBrand />
            <div className="overflow-y-auto">
              <SidebarNav location={location} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar: mobile menu + breadcrumbs */}
          <div className="sticky top-16 z-30 flex items-center gap-3 h-14 px-4 sm:px-6 border-b border-border bg-background/80 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label="Otwórz menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-sm overflow-hidden">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <li key={i} className="flex items-center gap-1.5 min-w-0">
                      {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                      {c.href && !last ? (
                        <Link
                          href={c.href}
                          className="text-muted-foreground hover:text-foreground transition-colors truncate"
                        >
                          {c.label}
                        </Link>
                      ) : (
                        <span className={cn("truncate", last ? "font-bold text-foreground" : "text-muted-foreground")}>
                          {c.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Strona główna
            </Link>
          </div>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Convenience wrapper: admin auth guard + shared shell around a page. */
export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  );
}
