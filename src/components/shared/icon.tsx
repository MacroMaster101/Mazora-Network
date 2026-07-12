import {
  Activity,
  Bug,
  Coins,
  Cpu,
  Crown,
  Gamepad2,
  Gavel,
  Gem,
  Gift,
  Hammer,
  Handshake,
  Heart,
  Layers,
  MessagesSquare,
  Music2,
  Pickaxe,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Twitter,
  Users,
  Youtube,
  type LucideIcon,
  HelpCircle,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Activity,
  Bug,
  Coins,
  Cpu,
  Crown,
  Gamepad2,
  Gavel,
  Gem,
  Gift,
  Hammer,
  Handshake,
  Heart,
  Layers,
  MessagesSquare,
  Music2,
  Pickaxe,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Twitter,
  Users,
  Youtube,
};

/** Renders a Lucide icon from a stored string name (keeps data serializable). */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Cmp = map[name] ?? HelpCircle;
  return <Cmp size={size} className={className} aria-hidden />;
}
