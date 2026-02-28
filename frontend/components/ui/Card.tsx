import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glass?: boolean;
}

export function Card({ hover = false, glass = false, className = "", children, ...props }: CardProps) {
  const base = glass
    ? "rounded-xl glass p-6 shadow-inner-glow"
    : "rounded-xl border border-border bg-surface p-6";

  const hoverStyles = hover
    ? "transition-all duration-300 hover:-translate-y-0.5 gradient-border hover:shadow-glow"
    : "";

  return (
    <div
      className={`relative overflow-hidden ${base} ${hoverStyles} ${className}`}
      {...props}
    >
      {/* Top gradient highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </div>
  );
}
