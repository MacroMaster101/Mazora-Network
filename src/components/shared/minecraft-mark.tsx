import { cn } from "@/lib/utils";

export function MinecraftMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("minecraft-mark", className)} aria-hidden="true">
      <path fill="#55a630" d="M16 2 29 9v14L16 30 3 23V9z" />
      <path fill="#79c143" d="m16 2 13 7-13 7L3 9z" />
      <path fill="#4a8f2b" d="m16 16 13-7v14l-13 7z" />
      <path fill="#8b5a2b" d="M3 12.5 16 19v11L3 23z" />
      <path fill="#6f451f" d="m16 19 13-6.5V23l-13 7z" />
      <path fill="#9bd35a" d="m3 9 4.2-2.25 4.15 2.2L16 6.5l4.3 2.3L25 6.85 29 9l-13 7z" />
      <path fill="#477d29" d="M16 16v4.2l4.3-2.15v3.7l4.2-2.15v-4.85L29 12.5V9z" />
      <path fill="#5f381a" d="M7 17.2 11 19v4.1l-4-1.85zm6 6.4 3 1.45V30l-3-1.6zm8-1.7 4-2v4l-4 2z" />
    </svg>
  );
}
