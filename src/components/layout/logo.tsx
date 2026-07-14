import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const RATIO = 1536 / 1024; // source logo aspect

/** The Mazora Network brand lockup, rendered from the source logo art. */
export function Logo({
  className,
  height = 48,
  priority = false,
  variant = "lockup",
}: {
  className?: string;
  height?: number;
  priority?: boolean;
  variant?: "lockup" | "mark";
}) {
  const width = variant === "mark" ? height : Math.round(height * RATIO);
  return (
    <Link href="/" className={cn("inline-flex items-center", variant === "mark" && "brand-mark", className)} aria-label="Mazora Network — home">
      <Image
        src={variant === "mark" ? "/icon.png" : "/images/mazora-logo.webp"}
        alt="Mazora Network"
        width={width}
        height={height}
        priority={priority}
        className="max-w-none object-contain"
        style={{ width, height }}
      />
    </Link>
  );
}
