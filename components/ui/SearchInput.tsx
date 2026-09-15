"use client";

import type { InputHTMLAttributes } from "react";
import { SearchIcon } from "./icons";

export function SearchInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="text"
        className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        {...props}
      />
    </div>
  );
}
