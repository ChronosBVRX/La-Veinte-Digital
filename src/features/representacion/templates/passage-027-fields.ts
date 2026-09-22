import type { PdfOverlayField, PdfFieldValue } from "../services/pdf-template-filler";
import type { PassagePdfWorker } from "./passage-026-fields";

export interface PassageAddressPdf {
  street: string;
  neighborhood: string;
  postalCode: string;
  municipality: string;
  state: string;
}

export interface Passage027PdfInput {
  ooad: string;
  day: string;
  month: string;
  year: string;
  controlNumber: string;
  worker: PassagePdfWorker;
  discontinuousSchedule: string;
  workerAddress: PassageAddressPdf;
  assignmentAddress: PassageAddressPdf;
  phone: string;
  folioLabel?: string;
}

export const PASSAGE_027_FIELDS: Record<string, PdfOverlayField> = {
  ooad: { page: 0, x: 160, y: 663, width: 220, fontSize: 8.5, minFontSize: 6.5 },
  day: { page: 0, x: 62, y: 621, align: "center", fontSize: 8.0 },
  month: { page: 0, x: 94, y: 621, align: "center", fontSize: 8.0 },
  year: { page: 0, x: 128, y: 621, align: "center", fontSize: 8.0 },
  controlNumber: { page: 0, x: 530, y: 621, align: "center", width: 100, fontSize: 8.0, minFontSize: 6.5 },
  paternalSurname: { page: 0, x: 148, y: 586, align: "center", width: 175, fontSize: 6.0, minFontSize: 5.0 },
  maternalSurname: { page: 0, x: 332, y: 586, align: "center", width: 175, fontSize: 6.0, minFontSize: 5.0 },
  firstName: { page: 0, x: 501, y: 586, align: "center", width: 155, fontSize: 6.0, minFontSize: 5.0 },
  employeeNumber: { page: 0, x: 102, y: 575, width: 90, fontSize: 7.5, minFontSize: 6.0 },
  category: { page: 0, x: 248, y: 575, width: 325, fontSize: 7.5, minFontSize: 5.5 },
  assignment: { page: 0, x: 110, y: 562, width: 250, fontSize: 7.5, minFontSize: 5.5 },
  discontinuousYes: { page: 0, x: 546, y: 562, align: "center", fontSize: 8.5, bold: true },
  discontinuousNo: { page: 0, x: 581, y: 562, align: "center", fontSize: 8.0, bold: true },
  workerStreet: { page: 0, x: 162, y: 536, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  assignmentStreet: { page: 0, x: 370, y: 536, width: 210, fontSize: 7.0, minFontSize: 5.5 },
  workerNeighborhood: { page: 0, x: 162, y: 524, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  assignmentNeighborhood: { page: 0, x: 370, y: 524, width: 210, fontSize: 7.0, minFontSize: 5.5 },
  workerPostalCode: { page: 0, x: 162, y: 512, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  assignmentPostalCode: { page: 0, x: 370, y: 512, width: 210, fontSize: 7.0, minFontSize: 5.5 },
  workerMunicipality: { page: 0, x: 162, y: 500, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  assignmentMunicipality: { page: 0, x: 370, y: 500, width: 210, fontSize: 7.0, minFontSize: 5.5 },
  workerState: { page: 0, x: 162, y: 488, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  assignmentState: { page: 0, x: 370, y: 488, width: 210, fontSize: 7.0, minFontSize: 5.5 },
  phone: { page: 0, x: 162, y: 476, width: 198, fontSize: 7.0, minFontSize: 5.5 },
  privacyWorkerName: { page: 1, x: 306.5, y: 169, align: "center", width: 230, fontSize: 8.5, minFontSize: 6.5 },
};

export function getPassage027FieldValues(input: Passage027PdfInput): PdfFieldValue[] {
  const control = input.controlNumber && input.controlNumber.toLowerCase() !== "pendiente"
    ? input.controlNumber
    : "";

  const isSi = input.discontinuousSchedule.trim().toLowerCase() === "si" ||
               input.discontinuousSchedule.trim().toLowerCase() === "sí";
  const isNo = input.discontinuousSchedule.trim().toLowerCase() === "no";

  const fullName = [input.worker.firstName, input.worker.paternalSurname, input.worker.maternalSurname]
    .filter(Boolean)
    .join(" ");

  const values: PdfFieldValue[] = [
    { field: PASSAGE_027_FIELDS.ooad, value: input.ooad },
    { field: PASSAGE_027_FIELDS.day, value: input.day },
    { field: PASSAGE_027_FIELDS.month, value: input.month },
    { field: PASSAGE_027_FIELDS.year, value: input.year },
    { field: PASSAGE_027_FIELDS.controlNumber, value: control },
    { field: PASSAGE_027_FIELDS.paternalSurname, value: input.worker.paternalSurname },
    { field: PASSAGE_027_FIELDS.maternalSurname, value: input.worker.maternalSurname },
    { field: PASSAGE_027_FIELDS.firstName, value: input.worker.firstName },
    { field: PASSAGE_027_FIELDS.employeeNumber, value: input.worker.employeeNumber },
    { field: PASSAGE_027_FIELDS.category, value: input.worker.category },
    { field: PASSAGE_027_FIELDS.assignment, value: input.worker.assignment },
    { field: PASSAGE_027_FIELDS.workerStreet, value: input.workerAddress.street },
    { field: PASSAGE_027_FIELDS.assignmentStreet, value: input.assignmentAddress.street },
    { field: PASSAGE_027_FIELDS.workerNeighborhood, value: input.workerAddress.neighborhood },
    { field: PASSAGE_027_FIELDS.assignmentNeighborhood, value: input.assignmentAddress.neighborhood },
    { field: PASSAGE_027_FIELDS.workerPostalCode, value: input.workerAddress.postalCode },
    { field: PASSAGE_027_FIELDS.assignmentPostalCode, value: input.assignmentAddress.postalCode },
    { field: PASSAGE_027_FIELDS.workerMunicipality, value: input.workerAddress.municipality },
    { field: PASSAGE_027_FIELDS.assignmentMunicipality, value: input.assignmentAddress.municipality },
    { field: PASSAGE_027_FIELDS.workerState, value: input.workerAddress.state },
    { field: PASSAGE_027_FIELDS.assignmentState, value: input.assignmentAddress.state },
    { field: PASSAGE_027_FIELDS.phone, value: input.phone },
  ];

  if (isSi) {
    values.push({ field: PASSAGE_027_FIELDS.discontinuousYes, value: "X" });
  } else if (isNo) {
    values.push({ field: PASSAGE_027_FIELDS.discontinuousNo, value: "X" });
  }

  if (fullName) {
    values.push({ field: PASSAGE_027_FIELDS.privacyWorkerName, value: fullName });
  }

  return values;
}
