import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Camera,
  Code,
  Crown,
  Gavel,
  Gem,
  Hammer,
  Handshake,
  Heart,
  Megaphone,
  Paintbrush,
  Shield,
  Sparkles,
  Star,
  UserRound,
  Wrench,
} from "lucide-react";
import type { ROLE_ICONS } from "@/lib/auth/role-catalog-core";

type RoleIconName = (typeof ROLE_ICONS)[number];

/** The component for every icon a role may reference (see ROLE_ICONS). */
export const ROLE_ICON_COMPONENTS: Record<RoleIconName, LucideIcon> = {
  Crown,
  BadgeCheck,
  Shield,
  Gavel,
  Handshake,
  Code,
  Hammer,
  Paintbrush,
  Megaphone,
  Sparkles,
  Star,
  Heart,
  Wrench,
  Camera,
  Gem,
  UserRound,
};

/** Readable names for the picker: "BadgeCheck" → "Badge check". */
export function roleIconLabel(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
}

/** The icon for a stored name; unknown or empty names get the fallback. */
export function roleIconFor(name: string | null | undefined, fallback: LucideIcon = Shield): LucideIcon {
  return badgeIconFor(name) ?? fallback;
}

/** The badge icon for a stored name, or undefined for none/unknown. */
export function badgeIconFor(name: string | null | undefined): LucideIcon | undefined {
  return name ? ROLE_ICON_COMPONENTS[name as RoleIconName] : undefined;
}
