import { PlayCircle, Brain, Target, ChevronRight } from "lucide-react";
import { ProgressRing } from "./progress-ring";

interface CourseModuleCardProps {
  title: string;
  description: string;
  lessonCount: number;
  progress?: number;
  gradientClass?: string;
}

export function CourseModuleCard({
  title,
  description,
  lessonCount,
  progress = 0,
  gradientClass = "from-blue-500/20 to-cyan-500/20"
}: CourseModuleCardProps) {
  return (
    <div className="card-premium p-6 sm:p-8 hover-lift group relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClass}`} />
      
      <div className="flex-1 space-y-3">
        <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            <PlayCircle className="w-4 h-4 text-blue-500" />
            <span>Wideo</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            <Brain className="w-4 h-4 text-violet-500" />
            <span>Quizy</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
            <Target className="w-4 h-4 text-primary" />
            <span>Zadania AI</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold">{lessonCount} lekcji</p>
          <p className="text-xs text-muted-foreground">Kompletny moduł</p>
        </div>
        
        {progress > 0 ? (
          <ProgressRing progress={progress} size={54} strokeWidth={4}>
            <span className="text-xs font-bold">{progress}%</span>
          </ProgressRing>
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <ChevronRight className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
