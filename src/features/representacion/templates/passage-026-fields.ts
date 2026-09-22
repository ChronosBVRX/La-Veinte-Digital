import type { PdfOverlayField, PdfFieldValue } from "../services/pdf-template-filler";

export interface PassagePdfWorker {
  paternalSurname: string;
  maternalSurname: string;
  firstName: string;
  employeeNumber: string;
  category: string;
  assignment: string;
}

export interface Passage026PdfInput {
  ooad: string;
  day: string;
  month: string;
  year: string;
  controlNumber: string;
  worker: PassagePdfWorker;
  extramuralFunctions: string;
  transferPeriod: string;
  folioLabel?: string;
}

export const PASSAGE_026_FIELDS: Record<string, PdfOverlayField> = {
  ooad: { page: 0, x: 270, y: 679, width: 250, fontSize: 7.5, minFontSize: 6.5 },
  day: { page: 0, x: 91, y: 643, align: "center", fontSize: 7.5 },
  month: { page: 0, x: 132, y: 643, align: "center", fontSize: 7.5 },
  year: { page: 0, x: 174, y: 643, align: "center", fontSize: 7.5 },
  controlNumber: { page: 0, x: 507, y: 643, align: "center", width: 120, fontSize: 7.0, minFontSize: 5.5 },
  paternalSurname: { page: 0, x: 130, y: 602.0, align: "center", width: 160, fontSize: 6.0, minFontSize: 5.0 },
  maternalSurname: { page: 0, x: 297, y: 602.0, align: "center", width: 155, fontSize: 6.0, minFontSize: 5.0 },
  firstName: { page: 0, x: 475, y: 602.0, align: "center", width: 180, fontSize: 6.0, minFontSize: 5.0 },
  employeeNumber: { page: 0, x: 106, y: 588.5, width: 125, fontSize: 7.0, minFontSize: 5.75 },
  category: { page: 0, x: 295, y: 588.5, width: 270, fontSize: 7.0, minFontSize: 5.5 },
  assignment: { page: 0, x: 118, y: 576, width: 447, fontSize: 7.0, minFontSize: 5.5 },
  extramuralFunctions: { page: 0, x: 74, y: 554, width: 295, height: 34, multiline: true, fontSize: 7.0, minFontSize: 5.5, lineHeight: 8.5 },
  transferPeriod: { page: 0, x: 395, y: 554, width: 165, height: 34, multiline: true, fontSize: 7.0, minFontSize: 5.5, lineHeight: 8.5 },
};

export function getPassage026FieldValues(input: Passage026PdfInput): PdfFieldValue[] {
  const control = input.controlNumber && input.controlNumber.toLowerCase() !== "pendiente"
    ? input.controlNumber
    : "";

  return [
    { field: PASSAGE_026_FIELDS.ooad, value: input.ooad },
    { field: PASSAGE_026_FIELDS.day, value: input.day },
    { field: PASSAGE_026_FIELDS.month, value: input.month },
    { field: PASSAGE_026_FIELDS.year, value: input.year },
    { field: PASSAGE_026_FIELDS.controlNumber, value: control },
    { field: PASSAGE_026_FIELDS.paternalSurname, value: input.worker.paternalSurname },
    { field: PASSAGE_026_FIELDS.maternalSurname, value: input.worker.maternalSurname },
    { field: PASSAGE_026_FIELDS.firstName, value: input.worker.firstName },
    { field: PASSAGE_026_FIELDS.employeeNumber, value: input.worker.employeeNumber },
    { field: PASSAGE_026_FIELDS.category, value: input.worker.category },
    { field: PASSAGE_026_FIELDS.assignment, value: input.worker.assignment },
    { field: PASSAGE_026_FIELDS.extramuralFunctions, value: input.extramuralFunctions },
    { field: PASSAGE_026_FIELDS.transferPeriod, value: input.transferPeriod },
  ];
}
