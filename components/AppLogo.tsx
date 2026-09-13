"use client";

import { useEventStatus } from "./EventStatusProvider";

export default function AppLogo({
  size = "w-7 h-7",
  rounded = "rounded-md",
  badgeSize = "w-3.5 h-3.5 text-[8px]",
  className = "",
}: {
  size?: string;
  rounded?: string;
  badgeSize?: string;
  className?: string;
}) {
  const event = useEventStatus();

  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <img src="/logo.png" alt="" className={`${size} ${rounded}`} />
      {event.active && (
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-white ring-1 ring-black/20 shadow ${badgeSize}`}
          title={`Event Kemerdekaan RI ke-${event.hutNumber}`}
          aria-hidden="true"
        >
          🇮🇩
        </span>
      )}
    </span>
  );
}
