import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <img 
      src="/aside-logo-dashboard.png" 
      alt="Aside" 
      className={cn("w-auto h-8", className)}
    />
  );
}
