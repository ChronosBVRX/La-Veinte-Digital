"use client";

export interface RepresentationLoadingSkeletonProps {
  rows?: number;
  variant?: "table" | "cards" | "metrics";
}

export function RepresentationLoadingSkeleton({
  rows = 5,
  variant = "table",
}: RepresentationLoadingSkeletonProps): React.JSX.Element {
  if (variant === "metrics") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
          width: "100%",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius, 0.375rem)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "40%",
                height: "0.75rem",
                backgroundColor: "var(--accent)",
                borderRadius: "0.25rem",
              }}
            />
            <div
              style={{
                width: "60%",
                height: "1.75rem",
                backgroundColor: "var(--accent)",
                borderRadius: "0.25rem",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg, 0.5rem)",
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  width: "50%",
                  height: "1rem",
                  backgroundColor: "var(--accent)",
                  borderRadius: "0.25rem",
                }}
              />
              <div
                style={{
                  width: "20%",
                  height: "0.875rem",
                  backgroundColor: "var(--accent)",
                  borderRadius: "999px",
                }}
              />
            </div>
            <div
              style={{
                width: "70%",
                height: "0.8125rem",
                backgroundColor: "var(--accent)",
                borderRadius: "0.25rem",
              }}
            />
            <div
              style={{
                width: "40%",
                height: "0.75rem",
                backgroundColor: "var(--accent)",
                borderRadius: "0.25rem",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // Variant: table
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 0.5rem)",
        backgroundColor: "var(--card)",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "1.5rem",
          backgroundColor: "var(--accent)",
          borderRadius: "0.25rem",
          marginBottom: "0.5rem",
        }}
      />
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.375rem 0",
          }}
        >
          <div style={{ flex: "2 1 0", height: "0.875rem", backgroundColor: "var(--accent)", borderRadius: "0.25rem" }} />
          <div style={{ flex: "1.5 1 0", height: "0.875rem", backgroundColor: "var(--accent)", borderRadius: "0.25rem" }} />
          <div style={{ flex: "1 1 0", height: "0.875rem", backgroundColor: "var(--accent)", borderRadius: "0.25rem" }} />
          <div style={{ flex: "1 1 0", height: "0.875rem", backgroundColor: "var(--accent)", borderRadius: "0.25rem" }} />
        </div>
      ))}
    </div>
  );
}
