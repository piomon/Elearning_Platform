import { Eye, X } from "lucide-react";
import { useLocation } from "wouter";

export function PreviewBanner({ label }: { label?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 shadow-md">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold">
        <Eye className="w-4 h-4 shrink-0" />
        <span>{label ?? "Podgląd jak u ucznia — treść nie jest jeszcze opublikowana."}</span>
        <button
          type="button"
          onClick={() => setLocation("/admin")}
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-950/10 px-3 py-0.5 hover:bg-amber-950/20 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Zamknij podgląd
        </button>
      </div>
    </div>
  );
}
