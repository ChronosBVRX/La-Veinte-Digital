// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { LockerControlCenter } from "../components/lockers/LockerControlCenter";

const { replaceMock, mockSearchParams } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  mockSearchParams: new URLSearchParams("view=table"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/representacion/lockers",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string | { pathname: string };
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

describe("LockerControlCenter Table Error vs Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders explicit error card with retry button on HTTP 500 without showing empty search card", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/union/lockers/map")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              zones: [],
              banks: [],
              lockers: [],
              summary: { total: 1201, assigned: 969, available: 232, maintenance: 0, blocked: 0, reserved: 0, unlocated: 1201 },
            }),
        });
      }
      if (url.includes("/api/union/lockers/waitlist")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      if (url.includes("/api/union/lockers?")) {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              error: "No se pudo cargar el inventario de casilleros.",
              errorCode: "42703",
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<LockerControlCenter isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("No pudimos cargar el inventario")).toBeDefined();
    });

    expect(screen.getByText("No se pudo cargar el inventario de casilleros.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();

    // MUST NOT render the misleading empty state message
    expect(screen.queryByText("No encontramos casilleros con el filtro seleccionado")).toBeNull();

    // Clicking retry triggers a new fetch
    const initialCalls = callCount;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => {
      expect(callCount).toBeGreaterThan(initialCalls);
    });
  });

  it("renders real empty state only on HTTP 200 with total = 0", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/union/lockers/map")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              zones: [],
              banks: [],
              lockers: [],
              summary: { total: 0, assigned: 0, available: 0, maintenance: 0, blocked: 0, reserved: 0, unlocated: 0 },
            }),
        });
      }
      if (url.includes("/api/union/lockers/waitlist")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      if (url.includes("/api/union/lockers?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              lockers: [],
              pagination: { total: 0, page: 1, pageSize: 25, totalPages: 1 },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });

    render(<LockerControlCenter isAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText("No encontramos casilleros con el filtro seleccionado")).toBeDefined();
    });

    // Error message must not be visible
    expect(screen.queryByText("No pudimos cargar el inventario")).toBeNull();
  });
});
