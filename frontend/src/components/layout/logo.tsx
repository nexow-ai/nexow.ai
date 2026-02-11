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

export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
        <span className="text-sm font-bold text-white">N</span>
      </div>
      <span className={cn("font-bold tracking-tight text-zinc-100", sizeStyles[size])}>
        Nexow
      </span>
    </Link>
  );
}
