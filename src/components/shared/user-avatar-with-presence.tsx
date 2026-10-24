import type { ComponentProps } from "react";
import { UserAvatar } from "./user-avatar";
import { PresenceDot } from "@/components/presence/presence-dot";
import type { PresenceChoice, PresenceShown } from "@/lib/presence-rules";

/** One sized frame keeps the status attached to the photo, not its text baseline. */
export function UserAvatarWithPresence({
  status,
  decorative = false,
  size = 32,
  ...avatar
}: ComponentProps<typeof UserAvatar> & {
  status?: PresenceChoice | PresenceShown | null;
  decorative?: boolean;
}) {
  return (
    <span className="user-presence-avatar relative inline-flex shrink-0 align-middle leading-none" style={{ width: size, height: size }}>
      <UserAvatar {...avatar} size={size} />
      {status && <PresenceDot status={status} decorative={decorative} className="user-presence-avatar-dot" />}
    </span>
  );
}
