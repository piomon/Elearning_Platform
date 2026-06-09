import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  colorClass?: string;
}

export function StatCard({ title, value, icon, description, colorClass = "text-primary bg-primary/10" }: StatCardProps) {
  return (
    <div className="card-premium p-6 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-muted-foreground">{title}</h3>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-display font-bold">{value}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
