import { Loader2 } from "lucide-react";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-muted rounded-xl ${className}`} />
  );
}

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}
