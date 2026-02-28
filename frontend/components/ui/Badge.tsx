interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "green" | "purple" | "orange" | "glow";
  className?: string;
}

const variants = {
  default: "bg-surface-light text-muted border-border backdrop-blur-sm",
  green: "bg-green-muted/30 text-green border-green/20 backdrop-blur-sm",
  purple: "bg-purple-muted/30 text-purple border-purple/20 backdrop-blur-sm",
  orange: "bg-orange-muted/30 text-orange border-orange/20 backdrop-blur-sm",
  glow: "bg-green-muted/30 text-green-vivid border-green/30 backdrop-blur-sm shadow-glow",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
