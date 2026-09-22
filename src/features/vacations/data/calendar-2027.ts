import type {
  AnnualVacationCalendar,
  VacationCalendarDayCount,
  VacationRole,
} from "../domain/types"

export const VACATION_CALENDAR_2027_SOURCE =
  "Tabla de Roles Vacacionales para Otorgamiento Año 2027 - Dirección de Administración / Unidad de Personal IMSS y Secretaría de Trabajo del Comité Ejecutivo Nacional del SNTSS"

type OfficialRoleDefinition = {
  roleNumber: number
  startDate: string
  observation: "A" | "B"
  endDateByDays: Partial<Record<VacationCalendarDayCount, string>>
}

const OFFICIAL_ROLE_DEFINITIONS: OfficialRoleDefinition[] = [
  {
    roleNumber: 1, startDate: "2027-01-18", observation: "A",
    endDateByDays: { 7: "2027-01-26", 8: "2027-01-27", 9: "2027-01-28", 10: "2027-01-29", 11: "2027-02-02", 12: "2027-02-03", 13: "2027-02-04", 14: "2027-02-05", 15: "2027-02-08", 16: "2027-02-09", 17: "2027-02-10", 18: "2027-02-11", 19: "2027-02-12", 20: "2027-02-15" },
  },
  {
    roleNumber: 2, startDate: "2027-02-02", observation: "B",
    endDateByDays: { 7: "2027-02-10", 8: "2027-02-11", 9: "2027-02-12", 10: "2027-02-15" },
  },
  {
    roleNumber: 3, startDate: "2027-02-16", observation: "A",
    endDateByDays: { 7: "2027-02-24", 8: "2027-02-25", 9: "2027-02-26", 10: "2027-03-01", 11: "2027-03-02", 12: "2027-03-03", 13: "2027-03-04", 14: "2027-03-05", 15: "2027-03-08", 16: "2027-03-09", 17: "2027-03-10", 18: "2027-03-11", 19: "2027-03-12", 20: "2027-03-16" },
  },
  {
    roleNumber: 4, startDate: "2027-03-02", observation: "B",
    endDateByDays: { 7: "2027-03-10", 8: "2027-03-11", 9: "2027-03-12", 10: "2027-03-16" },
  },
  {
    roleNumber: 5, startDate: "2027-03-17", observation: "A",
    endDateByDays: { 7: "2027-03-29", 8: "2027-03-30", 9: "2027-03-31", 10: "2027-04-01", 11: "2027-04-02", 12: "2027-04-05", 13: "2027-04-06", 14: "2027-04-07", 15: "2027-04-08", 16: "2027-04-09", 17: "2027-04-12", 18: "2027-04-13", 19: "2027-04-14", 20: "2027-04-15" },
  },
  {
    roleNumber: 6, startDate: "2027-04-02", observation: "B",
    endDateByDays: { 7: "2027-04-12", 8: "2027-04-13", 9: "2027-04-14", 10: "2027-04-15" },
  },
  {
    roleNumber: 7, startDate: "2027-04-19", observation: "A",
    endDateByDays: { 7: "2027-04-27", 8: "2027-04-28", 9: "2027-04-29", 10: "2027-04-30", 11: "2027-05-03", 12: "2027-05-04", 13: "2027-05-05", 14: "2027-05-06", 15: "2027-05-07", 16: "2027-05-11", 17: "2027-05-12", 18: "2027-05-13", 19: "2027-05-14", 20: "2027-05-17" },
  },
  {
    roleNumber: 8, startDate: "2027-05-03", observation: "B",
    endDateByDays: { 7: "2027-05-12", 8: "2027-05-13", 9: "2027-05-14", 10: "2027-05-17" },
  },
  {
    roleNumber: 9, startDate: "2027-05-24", observation: "A",
    endDateByDays: { 7: "2027-06-01", 8: "2027-06-02", 9: "2027-06-03", 10: "2027-06-04", 11: "2027-06-07", 12: "2027-06-08", 13: "2027-06-09", 14: "2027-06-10", 15: "2027-06-11", 16: "2027-06-14", 17: "2027-06-15", 18: "2027-06-16", 19: "2027-06-17", 20: "2027-06-18" },
  },
  {
    roleNumber: 10, startDate: "2027-06-07", observation: "B",
    endDateByDays: { 7: "2027-06-15", 8: "2027-06-16", 9: "2027-06-17", 10: "2027-06-18" },
  },
  {
    roleNumber: 11, startDate: "2027-06-21", observation: "A",
    endDateByDays: { 7: "2027-06-29", 8: "2027-06-30", 9: "2027-07-01", 10: "2027-07-02", 11: "2027-07-05", 12: "2027-07-06", 13: "2027-07-07", 14: "2027-07-08", 15: "2027-07-09", 16: "2027-07-12", 17: "2027-07-13", 18: "2027-07-14", 19: "2027-07-15", 20: "2027-07-16" },
  },
  {
    roleNumber: 12, startDate: "2027-07-05", observation: "B",
    endDateByDays: { 7: "2027-07-13", 8: "2027-07-14", 9: "2027-07-15", 10: "2027-07-16" },
  },
  {
    roleNumber: 13, startDate: "2027-07-19", observation: "A",
    endDateByDays: { 7: "2027-07-27", 8: "2027-07-28", 9: "2027-07-29", 10: "2027-07-30", 11: "2027-08-02", 12: "2027-08-03", 13: "2027-08-04", 14: "2027-08-05", 15: "2027-08-06", 16: "2027-08-09", 17: "2027-08-10", 18: "2027-08-11", 19: "2027-08-12", 20: "2027-08-13" },
  },
  {
    roleNumber: 14, startDate: "2027-08-02", observation: "B",
    endDateByDays: { 7: "2027-08-10", 8: "2027-08-11", 9: "2027-08-12", 10: "2027-08-13" },
  },
  {
    roleNumber: 15, startDate: "2027-08-16", observation: "A",
    endDateByDays: { 7: "2027-08-24", 8: "2027-08-25", 9: "2027-08-26", 10: "2027-08-27", 11: "2027-08-30", 12: "2027-08-31", 13: "2027-09-01", 14: "2027-09-02", 15: "2027-09-03", 16: "2027-09-06", 17: "2027-09-07", 18: "2027-09-08", 19: "2027-09-09", 20: "2027-09-10" },
  },
  {
    roleNumber: 16, startDate: "2027-08-30", observation: "B",
    endDateByDays: { 7: "2027-09-07", 8: "2027-09-08", 9: "2027-09-09", 10: "2027-09-10" },
  },
  {
    roleNumber: 17, startDate: "2027-09-13", observation: "A",
    endDateByDays: { 7: "2027-09-23", 8: "2027-09-24", 9: "2027-09-27", 10: "2027-09-28", 11: "2027-09-29", 12: "2027-09-30", 13: "2027-10-01", 14: "2027-10-04", 15: "2027-10-05", 16: "2027-10-06", 17: "2027-10-07", 18: "2027-10-08", 19: "2027-10-11", 20: "2027-10-12" },
  },
  {
    roleNumber: 18, startDate: "2027-09-29", observation: "B",
    endDateByDays: { 7: "2027-10-07", 8: "2027-10-08", 9: "2027-10-11", 10: "2027-10-12" },
  },
  {
    roleNumber: 19, startDate: "2027-10-18", observation: "A",
    endDateByDays: { 7: "2027-10-26", 8: "2027-10-27", 9: "2027-10-28", 10: "2027-10-29", 11: "2027-11-01", 12: "2027-11-02", 13: "2027-11-03", 14: "2027-11-04", 15: "2027-11-05", 16: "2027-11-08", 17: "2027-11-09", 18: "2027-11-10", 19: "2027-11-11", 20: "2027-11-12" },
  },
  {
    roleNumber: 20, startDate: "2027-11-01", observation: "B",
    endDateByDays: { 7: "2027-11-09", 8: "2027-11-10", 9: "2027-11-11", 10: "2027-11-12" },
  },
  {
    roleNumber: 21, startDate: "2027-11-16", observation: "A",
    endDateByDays: { 7: "2027-11-24", 8: "2027-11-25", 9: "2027-11-26", 10: "2027-11-29", 11: "2027-11-30", 12: "2027-12-01", 13: "2027-12-02", 14: "2027-12-03", 15: "2027-12-06", 16: "2027-12-07", 17: "2027-12-08", 18: "2027-12-09", 19: "2027-12-10", 20: "2027-12-13" },
  },
  {
    roleNumber: 22, startDate: "2027-11-30", observation: "B",
    endDateByDays: { 7: "2027-12-08", 8: "2027-12-09", 9: "2027-12-10", 10: "2027-12-13" },
  },
  {
    roleNumber: 23, startDate: "2027-12-14", observation: "A",
    endDateByDays: { 7: "2027-12-22", 8: "2027-12-23", 9: "2027-12-24", 10: "2027-12-27", 11: "2027-12-28", 12: "2027-12-29", 13: "2027-12-30", 14: "2027-12-31", 15: "2028-01-03", 16: "2028-01-04", 17: "2028-01-05", 18: "2028-01-06", 19: "2028-01-07", 20: "2028-01-10" },
  },
  {
    roleNumber: 24, startDate: "2027-12-28", observation: "B",
    endDateByDays: { 7: "2028-01-05", 8: "2028-01-06", 9: "2028-01-07", 10: "2028-01-10" },
  },
]

const roles: VacationRole[] = OFFICIAL_ROLE_DEFINITIONS.map((role) => ({
  id: `official-2027-role-${role.roleNumber}`,
  roleNumber: role.roleNumber,
  startDate: role.startDate,
  observation: role.observation,
  endDateByDays: role.endDateByDays,
  label: `Rol ${role.roleNumber} · Observación ${role.observation}`,
  enabled: true,
}))

/**
 * Fuente única y autoritativa del calendario 2027.
 *
 * NO regenerar ni sustituir estas fechas mediante días hábiles, festivos o
 * fórmulas. Fueron capturadas literalmente de la tabla oficial proporcionada.
 */
export const VACATION_CALENDAR_2027: AnnualVacationCalendar = {
  id: "official-vacation-calendar-2027",
  year: 2027,
  version: "2027-oficial-1",
  status: "PUBLISHED",
  sourceName: VACATION_CALENDAR_2027_SOURCE,
  authoritative: true,
  roles,
}
