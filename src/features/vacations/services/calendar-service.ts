import type { AnnualVacationCalendar } from "../domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPublishedCalendar(supabase: SupabaseClient, year: number): Promise<AnnualVacationCalendar | null> {
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
    id: data.id as string,
    year: data.year as number,
    version: data.version as string,
    status: data.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    sourceName: data.source_name as string,
    sourceDate: data.source_date as string | undefined,
    publishedAt: data.published_at as string | undefined,
    roles: ((data.roles as Record<string, unknown>[]) || []).map((r) => ({
      id: r.id as string,
      roleNumber: r.role_number as number,
      startDate: r.start_date as string,
      endDate: (r.end_date as string) || undefined,
      roleGroup: (r.role_group as "A" | "B" | "GENERAL") || undefined,
      label: r.label as string | undefined,
      enabled: r.enabled as boolean,
    })),
  };
}

export async function getAllCalendars(supabase: SupabaseClient): Promise<AnnualVacationCalendar[]> {
  const { data } = await supabase
    .from("vacation_calendars")
    .select("*, roles:vacation_calendar_roles(*)")
    .order("year", { ascending: false })
    .order("version", { ascending: false });

  if (!data) return [];

  return data.map((d) => ({
    id: d.id as string,
    year: d.year as number,
    version: d.version as string,
    status: d.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    sourceName: d.source_name as string,
    sourceDate: d.source_date as string | undefined,
    publishedAt: d.published_at as string | undefined,
    roles: ((d.roles as Record<string, unknown>[]) || []).map((r) => ({
      id: r.id as string,
      roleNumber: r.role_number as number,
      startDate: r.start_date as string,
      endDate: (r.end_date as string) || undefined,
      roleGroup: (r.role_group as "A" | "B" | "GENERAL") || undefined,
      label: r.label as string | undefined,
      enabled: r.enabled as boolean,
    })),
  }));
}

export async function createCalendar(
  supabase: SupabaseClient,
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
  return { ...calendar, id: data.id as string };
}

export async function publishCalendar(supabase: SupabaseClient, id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("publish_vacation_calendar", { p_calendar_id: id });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
