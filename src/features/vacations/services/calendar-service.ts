import type { AnnualVacationCalendar, VacationRole } from "../domain/types";

export async function getPublishedCalendar(supabase: any, year: number): Promise<AnnualVacationCalendar | null> {
  const { data } = await supabase
    .from("vacation_calendars")
    .select("*, roles:vacation_calendar_roles(*)")
    .eq("year", year)
    .eq("status", "PUBLISHED")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    year: data.year,
    version: data.version,
    status: data.status,
    sourceName: data.source_name,
    sourceDate: data.source_date,
    publishedAt: data.published_at,
    roles: (data.roles || []).map((r: any) => ({
      id: r.id,
      roleNumber: r.role_number,
      startDate: r.start_date,
      label: r.label,
      enabled: r.enabled,
    })),
  };
}

export async function getAllCalendars(supabase: any): Promise<AnnualVacationCalendar[]> {
  const { data } = await supabase
    .from("vacation_calendars")
    .select("*, roles:vacation_calendar_roles(*)")
    .order("year", { ascending: false })
    .order("version", { ascending: false });

  if (!data) return [];

  return data.map((d: any) => ({
    id: d.id,
    year: d.year,
    version: d.version,
    status: d.status,
    sourceName: d.source_name,
    sourceDate: d.source_date,
    publishedAt: d.published_at,
    roles: (d.roles || []).map((r: any) => ({
      id: r.id,
      roleNumber: r.role_number,
      startDate: r.start_date,
      label: r.label,
      enabled: r.enabled,
    })),
  }));
}

export async function createCalendar(
  supabase: any,
  calendar: Omit<AnnualVacationCalendar, "id">
): Promise<AnnualVacationCalendar | { error: string }> {
  const { data, error } = await supabase.from("vacation_calendars").insert({
    year: calendar.year,
    version: calendar.version,
    status: calendar.status,
    source_name: calendar.sourceName,
    source_date: calendar.sourceDate,
    published_at: calendar.publishedAt,
  }).select().single();

  if (error) return { error: error.message };
  return { ...calendar, id: data.id };
}

export async function publishCalendar(supabase: any, id: string): Promise<boolean> {
  const { error } = await supabase
    .from("vacation_calendars")
    .update({ status: "PUBLISHED", published_at: new Date().toISOString() })
    .eq("id", id);

  return !error;
}
