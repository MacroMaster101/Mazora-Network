import { Facebook, Globe, Instagram, Twitch, Youtube } from "lucide-react";
import { DiscordIcon } from "@/components/auth/provider-icons";
import type { SocialPlatform } from "@/lib/creator-socials";

/**
 * Platform marks for the creator-code editor.
 *
 * Lucide covers YouTube, Twitch, Instagram and a globe. It has no TikTok, no
 * post-rebrand X and no Kick, so those three are drawn here rather than shipped
 * as mangled approximations of the real brand paths. Discord reuses the icon the
 * auth screens already use, so the two never drift.
 */

const BRAND_COLOR: Record<SocialPlatform, string> = {
  youtube: "#ff0033",
  twitch: "#9146ff",
  tiktok: "#25f4ee",
  instagram: "#e1306c",
  facebook: "#1877f2",
  x: "currentColor",
  kick: "#53fc18",
  discord: "#5865f2",
  website: "currentColor",
};

function TikTokMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.5a5.7 5.7 0 1 0 5.2 5.68V8.9a7.2 7.2 0 0 0 4 1.22V7.1a4.2 4.2 0 0 1-4-4.1V2Z" />
    </svg>
  );
}

function XMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.53 3h3.19l-6.97 7.97L22 21h-6.42l-4.03-5.27L6.94 21H3.75l7.46-8.52L2.5 3h6.58l3.64 4.81L17.53 3Zm-1.12 16.1h1.77L7.67 4.8H5.77l10.64 14.3Z" />
    </svg>
  );
}

function KickMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 3h5.5v5.5H11V5.75h2.75V3H19v6.5h-2.75v2.75h-2.5v2.5h2.5V17H19v4h-5.25v-2.75H11V15.5H8.5V21H3V3Z" />
    </svg>
  );
}

export function SocialIcon({ platform, size = 15 }: { platform: SocialPlatform; size?: number }) {
  const color = BRAND_COLOR[platform];
  const style = color === "currentColor" ? undefined : { color };

  const mark = (() => {
    switch (platform) {
      case "youtube":
        return <Youtube size={size} aria-hidden="true" />;
      case "twitch":
        return <Twitch size={size} aria-hidden="true" />;
      case "instagram":
        return <Instagram size={size} aria-hidden="true" />;
      case "facebook":
        return <Facebook size={size} aria-hidden="true" />;
      case "discord":
        return <DiscordIcon className="h-[15px] w-[15px]" />;
      case "tiktok":
        return <TikTokMark size={size} />;
      case "x":
        return <XMark size={size} />;
      case "kick":
        return <KickMark size={size} />;
      default:
        return <Globe size={size} aria-hidden="true" />;
    }
  })();

  return (
    <span className="creator-code-social-ico" style={style}>
      {mark}
    </span>
  );
}
