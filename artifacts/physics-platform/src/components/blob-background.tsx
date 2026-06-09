interface BlobBackgroundProps {
  className?: string;
  variant?: "blue" | "amber" | "mixed";
}

export function BlobBackground({ className = "", variant = "blue" }: BlobBackgroundProps) {
  const blobs = {
    blue: [
      "bg-blue-400/20",
      "bg-cyan-400/20",
      "bg-sky-400/20"
    ],
    amber: [
      "bg-amber-400/20",
      "bg-orange-400/20",
      "bg-yellow-400/20"
    ],
    mixed: [
      "bg-blue-400/20",
      "bg-amber-400/20",
      "bg-cyan-400/20"
    ]
  };

  const colors = blobs[variant];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none -z-10 ${className}`}>
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob ${colors[0]}`} />
      <div className={`absolute top-0 right-1/4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 ${colors[1]}`} />
      <div className={`absolute -bottom-32 left-1/3 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000 ${colors[2]}`} />
    </div>
  );
}
