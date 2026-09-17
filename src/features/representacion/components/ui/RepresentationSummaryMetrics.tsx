"use client";

import type { ReactNode } from "react";

export interface RepresentationSummaryMetricsProps {
  children: ReactNode;
  alert?: ReactNode;
}

export function RepresentationSummaryMetrics({
  children,
  alert,
}: RepresentationSummaryMetricsProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
          width: "100%",
        }}
      >
        {children}
      </div>
      {alert ? <div>{alert}</div> : null}
    </div>
  );
}
