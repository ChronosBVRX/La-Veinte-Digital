// NEVER execute these as current payroll rules without validation.

export const manual2023Formulas = [
  {
    "concept": "011",
    "sourcePage": 22,
    "sourceText": "Sueldo tabular (002) x 72.15",
    "warning": "La propia fuente dice que el porcentaje se actualiza en cada revisión contractual; validar antes de usar."
  },
  {
    "concept": "012",
    "sourcePage": 23,
    "sourceText": "Sueldo tabular (002) + cpto. 011 x 15%",
    "warning": "Validar vigencia y precedencia matemática con fuente normativa actual."
  },
  {
    "concept": "022",
    "sourcePage": 23,
    "sourceText": "Sueldo tabular (002) + cpto. 011 (o en su caso cpto. 013 + 057 + 058 + 061) x factor correspondiente los años de servicio.",
    "warning": "Requiere tabla/factor vigente y revisión de precedencia."
  },
  {
    "concept": "029",
    "sourcePage": 24,
    "sourceText": "Salario Mensual Integrado entre 30 x número de días de vacaciones x 0.25",
    "warning": "Validar CCT vigente."
  },
  {
    "concept": "030",
    "sourcePage": 24,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 + (o en su caso, 012 + 013 + 014 + 015 + 016 + 022 + 023 + 054 + 057 + 058 + 061 + 063) + 020 + 050 entre 15, entre jornada reportada por horas y décimas por el 0.25%.",
    "warning": "Transcripción de fuente 2023; no implementar sin validación."
  },
  {
    "concept": "031",
    "sourcePage": 25,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 x cuatro quincenas (60 días de sueldo).",
    "warning": "Validar cláusula y precedencia."
  },
  {
    "concept": "032",
    "sourcePage": 25,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 (o en su caso cpto. 019 + 054 + 057 + 058 + 061) entre 15 x 3 días de estímulo.",
    "warning": "Usar motor vigente de La Veinte si ya existe."
  },
  {
    "concept": "033",
    "sourcePage": 25,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 (en su caso cpto. 019 + 054 + 057 + 058 + 061) entre 15 x 2 días de estímulo.",
    "warning": "Usar motor vigente de La Veinte si ya existe."
  },
  {
    "concept": "037",
    "sourcePage": 26,
    "sourceText": "Sueldo tabular (002) + cpto. 011 (o en su caso cpto. 019 + 023 + 054 + 057 + 058 + 061 + 063) + 020 + 050 entre 15 y entre jornada reportada x 2 x horas y décimas reportadas.",
    "warning": "Validar reglas de tiempo extraordinario vigentes."
  },
  {
    "concept": "044",
    "sourcePage": 26,
    "sourceText": "Sueldo tabular (002) + cpto. 011 (en su caso cpto. 019 + 023 + 054 + 057 + 058 + 061 + 063) + 020 + 050 entre 15 x días a pagar.",
    "warning": "El manual intercala fórmulas; validar asociación exacta antes de implementar."
  },
  {
    "concept": "042",
    "sourcePage": 26,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 x 2 x el número de meses solicitados. Importe máximo de 3 meses. Antigüedad 23 quincenas.",
    "warning": "Validar cláusula 97 vigente."
  },
  {
    "concept": "048",
    "sourcePage": 27,
    "sourceText": "Suma de los conceptos del Salario Mensual Integrado entre 30 x número de días de ayuda.",
    "warning": "Validar tabla de días vigente."
  },
  {
    "concept": "049",
    "sourcePage": 27,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 (en su caso cpto. 019 + 054 + 057 + 058 + 061) x 2 x 3",
    "warning": "La fórmula se conserva como aparece en la fuente; revisar antes de usar."
  },
  {
    "concept": "055",
    "sourcePage": 28,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 entre 15 x 46 días = cpto. 055",
    "warning": "Fuente menciona contrato 2021-2023; requiere actualización."
  },
  {
    "concept": "058",
    "sourcePage": 28,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 x 31% = cpto. 058",
    "warning": "Validar cláusula y porcentaje vigente."
  },
  {
    "concept": "107",
    "sourcePage": 30,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023 + 050 + 062 + 063 x 0.07",
    "warning": "No usar como regla sin validar agrupación y CCT/RJP vigentes."
  },
  {
    "concept": "108",
    "sourcePage": 31,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023 + 050 + 062 + 063 x 0.10",
    "warning": "No usar como regla sin validar agrupación y régimen aplicable."
  },
  {
    "concept": "111",
    "sourcePage": 31,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023 + 050 + 062 + 063 x 0.15",
    "warning": "No usar como regla sin validar agrupación y régimen aplicable."
  },
  {
    "concept": "152",
    "sourcePage": 31,
    "sourceText": "Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023 + 050 + 062 + 063 x 0.03",
    "warning": "No usar como regla sin validar agrupación y régimen aplicable."
  }
] as const;
