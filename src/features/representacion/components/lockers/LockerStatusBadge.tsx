"use client";

import { RepresentationStatusBadge } from "../ui";
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
    <RepresentationStatusBadge
      status={status}
      label={badge.singular}
      hasPendingReview={hasPending}
    />
  );
}
