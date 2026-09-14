import { UnionAccessDenied } from "@/features/union/components/UnionAccessDenied";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sin autorización — Representación Sindical",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SinAccesoPage(): React.JSX.Element {
  return <UnionAccessDenied />;
}
