import type { LucideIcon } from "lucide-react";
import {
  Gamepad2,
  Grid2X2,
  House,
  Images,
  MessagesSquare,
  ScrollText,
  ShoppingBag,
  UsersRound,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  Home: House,
  Play: Gamepad2,
  Gallery: Images,
  Forums: MessagesSquare,
  "Our Team": UsersRound,
  Rules: ScrollText,
  Store: ShoppingBag,
  More: Grid2X2,
};

export function NavIcon({ label, size = 16 }: { label: string; size?: number }) {
  const Icon = icons[label] ?? Grid2X2;
  return <Icon size={size} aria-hidden="true" />;
}
