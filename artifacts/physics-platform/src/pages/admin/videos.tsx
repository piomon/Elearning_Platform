import { useToast } from "@/hooks/use-toast";
import { Video as VideoIcon } from "lucide-react";
import { BunnyDiagnosticsView } from "@/components/admin/bunny-module";

export default function AdminVideos() {
  const { toast } = useToast();
  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <VideoIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-foreground">Wideo (Bunny.net)</h1>
          <p className="text-muted-foreground mt-1">Biblioteka, diagnostyka i synchronizacja</p>
        </div>
      </div>
      <BunnyDiagnosticsView toast={toast} />
    </div>
  );
}
