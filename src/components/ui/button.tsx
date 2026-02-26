"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-primary text-background hover:bg-primary-hover shadow-[0_0_20px_var(--shadow-primary)] hover:shadow-[0_0_30px_var(--shadow-primary-hover)]":
              variant === "primary",
            "bg-surface text-foreground border border-border hover:bg-surface-hover":
              variant === "secondary",
            "bg-transparent text-foreground hover:bg-surface":
              variant === "ghost",
            "bg-error/20 text-error hover:bg-error/30":
              variant === "danger",
            "bg-accent text-background hover:bg-accent/80":
              variant === "accent",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-7 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
