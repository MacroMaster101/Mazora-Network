import {
  Activity,
  BookOpen,
  Bug,
  Coins,
  Clock3,
  Cpu,
  Crown,
  FileText,
  Gamepad2,
  Gavel,
  Gem,
  Gift,
  Hammer,
  Handshake,
  Heart,
  Layers,
  Lock,
  MessagesSquare,
  Music2,
  Pickaxe,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Twitter,
  Users,
  Youtube,
  HelpCircle,
} from "lucide-react";

export function DiscordIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.098.245.195.372.288a.077.077 0 0 1-.006.128c-.598.353-1.22.651-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function TikTokIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-1.35v-3.5a6.34 6.34 0 0 0-5.11 2.29A6.36 6.36 0 0 0 3 15.67a6.37 6.37 0 0 0 6.37 6.37 6.36 6.36 0 0 0 6.37-6.37V9.7a8.27 8.27 0 0 0 4.85 1.56V7.8a4.84 4.84 0 0 1-1-.11z" />
    </svg>
  );
}

const map: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Activity,
  BookOpen,
  Bug,
  Coins,
  Clock3,
  Cpu,
  Crown,
  FileText,
  Gamepad2,
  Gavel,
  Gem,
  Gift,
  Hammer,
  Handshake,
  Heart,
  Layers,
  Lock,
  MessagesSquare,
  Music2,
  Pickaxe,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Twitter,
  Users,
  Youtube,
  Discord: DiscordIcon,
  DiscordIcon,
  TikTok: TikTokIcon,
  TikTokIcon,
};

/** Renders a stored icon by name or fallback icon. */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Cmp = map[name] ?? HelpCircle;
  return <Cmp size={size} className={className} />;
}
