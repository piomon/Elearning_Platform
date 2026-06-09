import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  colorClass?: string;
}

export function FeatureCard({ icon, title, description, colorClass = "bg-primary text-primary-foreground" }: FeatureCardProps) {
  return (
    <div className="card-premium p-8 h-full flex flex-col hover-lift group">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-transform group-hover:scale-110 ${colorClass}`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed flex-1">{description}</p>
    </div>
  );
}
