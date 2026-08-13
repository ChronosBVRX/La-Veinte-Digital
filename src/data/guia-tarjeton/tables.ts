// Índice provisional: tablas transcritas de una fuente de referencia no oficial. No usar como autoridad normativa.

export const occupationMarks = [
  {
    "code": "00",
    "description": "Definitiva",
    "use": "Asignada a trabajadores que figuran como titulares de plaza."
  },
  {
    "code": "01",
    "description": "Titular pasó a Confianza no Definitiva",
    "use": "Titulares de plaza de confianza o base que ocupan interinamente una plaza de confianza."
  },
  {
    "code": "02",
    "description": "Titular pasó a Base Interinas",
    "use": "Trabajadores de base promocionados interinamente en otra plaza de base."
  },
  {
    "code": "03",
    "description": "Titular pasó a Temporal",
    "use": "Trabajadores de base o confianza que ocupan una plaza temporal."
  },
  {
    "code": "20",
    "description": "Definitiva Estatuto A",
    "use": "Asignada a trabajadores que figuran como titulares de plaza."
  },
  {
    "code": "21",
    "description": "No Definitiva Estatuto A",
    "use": "Titulares de plaza de Estatuto A que ocupan interinamente otra plaza de Estatuto A."
  },
  {
    "code": "90",
    "description": "Titular con promoción escalafonaria No Definitiva por dictamen",
    "use": "Trabajadores de base promocionados interinamente en plaza superior de la misma rama por dictamen escalafonario."
  },
  {
    "code": "98",
    "description": "Titular con promoción escalafonaria No Definitiva por Interinato en tanto Dictamina Escalafón",
    "use": "Trabajadores de base promocionados interinamente en plaza superior de la misma rama por interinato en tanto dictamina escalafón."
  }
] as const;

export const incidence032033 = [
  {
    "incidence": "Beca con sueldo",
    "concept032": "con pago",
    "concept033": "con pago"
  },
  {
    "incidence": "Beca sin sueldo",
    "concept032": "sin pago",
    "concept033": "sin pago"
  },
  {
    "incidence": "Comisión",
    "concept032": "con pago",
    "concept033": "con pago"
  },
  {
    "incidence": "Falta",
    "concept032": "sin pago",
    "concept033": "sin pago"
  },
  {
    "incidence": "Incapacidad de enfermedad general",
    "concept032": "sin pago",
    "concept033": "sin pago"
  },
  {
    "incidence": "Incapacidad maternidad",
    "concept032": "con pago",
    "concept033": "con pago"
  },
  {
    "incidence": "Incapacidad riesgo de trabajo (no trayecto)",
    "concept032": "con pago",
    "concept033": "con pago",
    "note": "Trayecto: la fuente provisional indica solo pago del 032."
  },
  {
    "incidence": "Lactancia-Entrada",
    "concept032": "con pago",
    "concept033": "con pago"
  },
  {
    "incidence": "Licencia con sueldo",
    "concept032": "sin pago",
    "concept033": "sin pago"
  },
  {
    "incidence": "Licencia con sueldo por fallecimiento de padres, hijos, cónyuge o concubina/concubinario",
    "concept032": "con pago",
    "concept033": "sin pago"
  },
  {
    "incidence": "Pases de salida de más de 8 horas",
    "concept032": "sin pago",
    "concept033": "con pago"
  },
  {
    "incidence": "Vacaciones",
    "concept032": "con pago",
    "concept033": "con pago"
  }
] as const;

export const vacationContinuityMarks = [
  {
    "mark": "0",
    "enjoyment": "Continuo hasta 20 días, con pago de concepto 48 (completo).",
    "cycleClose": "Sin dato, disfruta de dos periodos."
  },
  {
    "mark": "1",
    "enjoyment": "1ra fracción, hasta 10 días, con pago de concepto 48 (50%).",
    "cycleClose": "Con 1, en 2da fracción, con pago de concepto 48 (50%)."
  },
  {
    "mark": "2",
    "enjoyment": "Hasta 20 días del primer periodo, sin pago del concepto 48.",
    "cycleClose": "Con 3, en segundo periodo, sin pago de concepto 48."
  },
  {
    "mark": "3",
    "enjoyment": "Hasta 15 días del segundo periodo, sin pago de concepto 48.",
    "cycleClose": "Sin dato, cierra ciclo."
  },
  {
    "mark": "4",
    "enjoyment": "1ra fracción, hasta 10 días, con pago de concepto 48 (completo).",
    "cycleClose": "Con 9, en segunda fracción del pago de concepto 48."
  },
  {
    "mark": "5",
    "enjoyment": "Del periodo 2 o 3, sin pago de concepto 48.",
    "cycleClose": "Con 5, segundo y tercer periodo sin pago de concepto 48."
  },
  {
    "mark": "9",
    "enjoyment": "1ra fracción, hasta 10 días, sí pago de concepto 48.",
    "cycleClose": "Con 4, 2da fracción con pago de concepto 48."
  }
] as const;
