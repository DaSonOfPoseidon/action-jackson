import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-green to-green-dark text-white shadow-glow hover:shadow-glow-lg hover:brightness-110",
  outline:
    "border border-border text-foreground hover:bg-surface-light hover:border-green/40 gradient-border",
  ghost:
    "text-muted hover:text-foreground hover:bg-surface-light",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "px-5 py-2.5 text-sm",
  lg: "text-base px-8 py-3.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
