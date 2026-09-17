"use client";

import { getLockerStatusBadge } from "@/features/representacion/lib/lockers";

export function LockerStatusBadge({
  status,
  hasPending = false,
}: {
  status: string;
  hasPending?: boolean;
}): React.JSX.Element {
  const badge = getLockerStatusBadge(status, hasPending);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.2rem 0.625rem",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        backgroundColor: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      <span
        style={{
          width: "0.45rem",
          height: "0.45rem",
          borderRadius: "50%",
          backgroundColor: badge.dotColor,
          display: "inline-block",
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{badge.singular}</span>
    </span>
  );
}
