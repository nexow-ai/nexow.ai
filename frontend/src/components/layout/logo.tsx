import { cn } from "@/lib/utils";
import Link from "next/link";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

const iconSizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-9 w-9 text-sm",
};

export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <div className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 font-bold text-white shadow-lg shadow-emerald-500/20",
        iconSizes[size]
      )}>
        N
      </div>
      <span className={cn("font-bold tracking-tight text-zinc-100", sizeStyles[size])}>
        Nexow
      </span>
    </Link>
  );
}
