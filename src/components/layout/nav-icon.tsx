import type { LucideIcon } from "lucide-react";
import {
  Gamepad2,
  Grid2X2,
  Headset,
  House,
  Images,
  UsersRound,
  ScrollText,
  ShoppingBag,
  Trophy,
  Newspaper,
  Calendar,
  Vote as VoteIcon,
  ShieldCheck,
  Video,
  Gavel,
  ShieldAlert,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquareText,
  UserCheck,
  CreditCard,
  Ticket,
} from "lucide-react";
import { DiscordIcon } from "@/components/shared/icon";

const icons: Record<string, LucideIcon | React.ComponentType<{ size?: number; className?: string }>> = {
  Home: House,
  Play: Gamepad2,
  Gallery: Images,
  Help: Headset,
  Support: Headset,
  "Support Center": HelpCircle,
  "Open a Ticket": Ticket,
  "Staff Application": ShieldCheck,
  "Content Creator": Video,
  "Ban & Mute Appeal": Gavel,
  "Ban appeal": Gavel,
  "Report a Player": ShieldAlert,
  "Report a Bug": Bug,
  Suggestions: Lightbulb,
  "Our Team": UsersRound,
  Rules: ScrollText,
  Store: ShoppingBag,
  More: Grid2X2,
  "Game modes": Gamepad2,
  Players: UserCheck,
  Leaderboards: Trophy,
  News: Newspaper,
  Events: Calendar,
  Vote: VoteIcon,
  Discord: DiscordIcon,
  "Discussion forum": MessageSquareText,
  "Payment support": CreditCard,
};

export function NavIcon({ label, size = 17 }: { label: string; size?: number }) {
  const Icon = icons[label] ?? Grid2X2;
  return <Icon size={size} aria-hidden="true" />;
}
