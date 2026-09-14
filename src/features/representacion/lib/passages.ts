// Pasajes 026/027 — Cl. 103 + procedimiento 1A32-A03-008.
// El sistema pre-valida y prepara; jamás dictamina, autoriza ni inventa control SIAP.

export type PassageConcept = "026" | "027";

export interface Passage026Input {
  ooad: string;
  requestDate: string;
  controlNumber?: string;
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
  extramuralFunctions: string;
  transferPeriod: string;
}

export interface PassageAddress {
  street: string;
  neighborhood: string;
  postalCode: string;
  municipality: string;
  state: string;
}

export interface Passage027Input {
  ooad: string;
  requestDate: string;
  controlNumber?: string;
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
  discontinuousSchedule: "Si" | "No" | "";
  workerAddress: PassageAddress;
  assignmentAddress: PassageAddress;
  phone: string;
}

export function validatePassage026(input: Passage026Input): string[] {
  const missing: string[] = [];
  if (!input.ooad.trim()) missing.push("OOAD / Órgano de Operación");
  if (!input.requestDate) missing.push("Fecha de solicitud");
  if (!input.paternalSurname.trim()) missing.push("Apellido paterno");
  if (!input.firstName.trim()) missing.push("Nombre(s)");
  if (!input.employeeNumber.trim()) missing.push("Matrícula");
  if (!input.category.trim()) missing.push("Categoría");
  if (!input.assignment.trim()) missing.push("Adscripción");
  if (!input.extramuralFunctions.trim()) missing.push("Funciones extramuros");
  if (!input.transferPeriod.trim()) missing.push("Periodo de traslado");
  return missing;
}

export function validatePassage027(input: Passage027Input): string[] {
  const missing: string[] = [];
  if (!input.ooad.trim()) missing.push("OOAD");
  if (!input.requestDate) missing.push("Fecha de solicitud");
  if (!input.paternalSurname.trim()) missing.push("Apellido paterno");
  if (!input.firstName.trim()) missing.push("Nombre(s)");
  if (!input.employeeNumber.trim()) missing.push("Matrícula");
  if (!input.category.trim()) missing.push("Categoría");
  if (!input.assignment.trim()) missing.push("Adscripción");
  if (!input.discontinuousSchedule) missing.push("Horario discontinuo (Sí/No)");
  const wa = input.workerAddress;
  if (!wa.street.trim() || !wa.neighborhood.trim() || !wa.postalCode.trim() || !wa.municipality.trim() || !wa.state.trim()) {
    missing.push("Domicilio del trabajador completo");
  }
  const aa = input.assignmentAddress;
  if (!aa.street.trim() || !aa.neighborhood.trim() || !aa.postalCode.trim() || !aa.municipality.trim() || !aa.state.trim()) {
    missing.push("Domicilio de adscripción completo");
  }
  return missing;
}

export const PASSAGE_CONTROL_PENDING = "pendiente";
export const PASSAGE_NO_DICTAMEN = "Pendiente de dictamen de la Subcomisión Mixta de Pasajes.";
