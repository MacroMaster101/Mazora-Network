import type { EventStatus } from "@/lib/types";

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  upcoming: "Upcoming",
  live: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
};
