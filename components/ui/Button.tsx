"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-hover",
  secondary: "border border-line bg-white text-ink hover:bg-slate-50",
  ghost: "text-ink-muted hover:bg-slate-100 hover:text-ink",
  danger: "border border-line bg-white text-danger hover:bg-danger-light",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});
