// Formateadores y contratos de datos para el Centro de Control de Representación Sindical.
// Es seguro importarlo tanto en componentes de cliente ("use client") como en el servidor.

export interface UnionDashboardSummary {
  delegation: {
    id: string;
    code: string;
    name: string;
    section: string;
    facility: string;
  };
  metrics: {
    workers: {
      total: number | null;
      active: number | null;
      error?: boolean;
    };
    cases: {
      total: number | null;
      error?: boolean;
    };
    lockers: {
      total: number | null;
      assigned: number | null;
      available: number | null;
      occupancyPercentage: number | null;
      waitlistCount: number | null;
      error?: boolean;
    };
    procedures: {
      inProgress: number | null;
      drafts: number | null;
      underReview: number | null;
      error?: boolean;
    };
    attentionCount: number;
  };
  attentionItems: Array<{
    id: string;
    caseId?: string;
    type: "license_draft" | "case_under_review" | "locker_review" | "locker_waitlist";
    title: string;
    subtitle: string;
    actionLabel: string;
    actionHref: string;
    urgency: "high" | "medium";
    date?: string;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    timeAgo: string;
    timestamp: string;
    caseType?: string;
    folio?: string;
    href?: string;
  }>;
}

export function formatRelativeTimeEs(isoString: string): string {
  try {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - then);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Hace un momento";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    const dateObj = new Date(isoString);
    return dateObj.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  } catch {
    return "Reciente";
  }
}

export function formatCaseTypeLabel(caseType: string): string {
  switch (caseType) {
    case "license":
      return "Licencia";
    case "maternity":
      return "Maternidad";
    case "lactation":
      return "Lactancia";
    case "passage_026":
      return "Pasaje 026";
    case "passage_027":
      return "Pasaje 027";
    case "locker":
      return "Casillero";
    default:
      return "Expediente";
  }
}

export function formatCaseStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "ready":
      return "Listo para firma";
    case "submitted":
      return "Enviado";
    case "under_review":
      return "En revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    case "completed":
      return "Completado";
    case "cancelled":
      return "Cancelado";
    case "archived":
      return "Archivado";
    default:
      return status;
  }
}
