import type { ComponentType } from "react";
import { Bug, CreditCard, Gavel, Lightbulb, MessagesSquare, ScrollText, ShieldAlert, ShieldCheck, Ticket, Video } from "lucide-react";
import { DiscordIcon } from "./icon";

type CardIcon = ComponentType<{ size?: number; className?: string }>;

export const SUPPORT_ICON_OPTIONS = [
  { value: "ticket", label: "Support ticket", icon: Ticket },
  { value: "messages", label: "Discussion", icon: MessagesSquare },
  { value: "gavel", label: "Appeal", icon: Gavel },
  { value: "shield-check", label: "Staff", icon: ShieldCheck },
  { value: "video", label: "Creator", icon: Video },
  { value: "shield-alert", label: "Player report", icon: ShieldAlert },
  { value: "bug", label: "Bug report", icon: Bug },
  { value: "lightbulb", label: "Suggestion", icon: Lightbulb },
  { value: "credit-card", label: "Store help", icon: CreditCard },
  { value: "scroll", label: "Rules", icon: ScrollText },
  { value: "discord", label: "Discord", icon: DiscordIcon },
] as const;

const SUPPORT_ICONS = Object.fromEntries(SUPPORT_ICON_OPTIONS.map((option) => [option.value, option.icon])) as Record<string, CardIcon>;

export function SupportCardIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = SUPPORT_ICONS[name] ?? Ticket;
  return <Icon size={size} className={className} />;
}
