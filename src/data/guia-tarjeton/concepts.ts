// ÍNDICE PROVISIONAL de conceptos para descubrimiento (códigos, nombres, temas).
// NO es autoridad normativa: es el punto de partida para investigar cada
// concepto ante las fuentes oficiales (CCT IMSS-SNTSS vigente, normas y
// procedimientos del IMSS). La autoridad vive en guideSources y en los
// motores de La Veinte Digital (nómina/calculadores).

export type GuideConceptKind = 'perception' | 'deduction';

export type GuideConcept = {
  code: string;
  name: string;
  kind: GuideConceptKind;
  status: 'reference-only';
  requiresCurrentValidation: boolean;
  searchTerms: string[];
  catalog: { listed: boolean; detail: Array<{ text: string }> };
};

export const guideConcepts: GuideConcept[] = [
  {
    "code": "104",
    "name": "CRÉDITO HIPOTECARIO FOVI",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "CONCEPTO\n\n104      CRÉDITO HIPOTECARIO FOVI                   151     IMPUESTOS SOBRE LA RENTA (ISR)\n\n106      ENGANCHE DE CASA HABITACIÓN E.S.M.I.       152     FONDO DE JUBILACIÓN\n\n107      PROVISIÓN FONDO DE JUBILACIÓN              153     DESCUENTO COMPLEMEN ISR AÑO\n                                                            ANTERIOR\n108      PROVISIÓN RJP                              154     DESCUENTO CRÉDITO INFONAVIT\n\n109      PRIMA DE SEGURO DAÑOS DE VIVIENDA          155     DISPOSICIÓN JUDICIAL (PENSIÓN\n         INFONAVIT                                          ALIMENTICIA)\n110      CRÉDITO DE AUTOMOVIL CON TERCEROS          156     VIÁTICOS NO COMPROBADOS\n\n111      APORTACIÓN COMPLEMENTARIA AFORE            160     RECUPERACIÓN CL. 97 DEL CCT\n\n112      FONDO DE AYUDA SINDICAL POR                161     SUSPENSIÓN TEMPORAL\n         DEFUNCIÓN\n113      SEGURO DE GUARDERÍAS                       162     RESPONSABILIDAD SOBRE INSTRUMENTOS\n                                                            DE TRABAJO\n114      SEG. IND. VOL. GASTOS MÉDICOS MAYORES      164     SUSPENSIÓN SINDICAL\n\n116      SERVICIO DE TELECOMUNICACIONES             166     CASAS COMERCIALES (COMISIÓN PARITARIA)\n\n119      PRIMA DE SEGURO DE AUTOMOVIL               167     VÍVERES\n\n120      SEGURO MÉDICO                              168     ROPA\n\n121      SEGURO DE ENFERMERÍA                       169     RECUPERACIÓN VALE A CUENTA DE SUELDO\n\n122      CRED. TRAB. CONF.                          170     FONACOT\n\n125      RETENCIÓN A CUENTA DE TERCEROS             171     LICENCIA SIN SUELDO MENOR A (4) DÍAS\n\n126      SEGURO DE CAMILLERO EN UMH                 172     FALTA INJUSTIFICADA\n\n129      LICENCIA SIN SUELDO MAYOR 3 DÍAS           173     PASES DE SALIDA\n\n                                                   29"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "104",
      "crédito hipotecario fovi",
      "fovi",
      "hipoteca",
      "hipotecario",
      "vivienda",
      "fondo de operación y descuento bancario a la vivienda"
    ]
  },
  {
    "code": "106",
    "name": "ENGANCHE DE CASA HABITACIÓN E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "106",
      "enganche de casa habitación e.s.m.i.",
      "enganche",
      "casa habitación",
      "esmi",
      "e.s.m.i.",
      "crédito hipotecario"
    ]
  },
  {
    "code": "107",
    "name": "PROVISIÓN FONDO DE JUBILACIÓN",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 107 Fondo de jubilación. El convenio adicional para las jubilaciones y pensiones de los\n       trabajadores de base de nuevo ingreso del 14 de octubre de 2005, estableció que los\n       trabajadores en activo aumentarán su aportación del 3 al 10% al fondo de jubilación. Dicho\n       incrcemento fue del 1% anual hasta llegar al 7% más. El 3% de descuento con el cpto 152 y el\n       7% se descuenta con el cpto 107.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023\n                  + 050 + 062 + 063 x 0.07 = importe de descuento del cpto. 107."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "107",
      "provisión fondo de jubilación",
      "jubilación",
      "retiro",
      "pensión"
    ]
  },
  {
    "code": "108",
    "name": "PROVISIÓN RJP",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 108 Fondo de jubilación. Provisión RJP 2005. Se establece que los trabajadores base de\n       nuevo ingreso que ingresarán a partir del 16 de octubre del 2005 y hasta el 31 de julio de 2008,\n       tendrían que aportar del 4 al 10% a un RJP modificado y cuyos requisitos principales son: el\n       derecho a la jubilación se obtendrá a partir de los 60 años de edad con 34 (mujeres) y 35\n       (varones) años de servicios, con una cuantía equivalente del 100%.\n\n                                                  30"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "108",
      "provisión rjp",
      "rjp",
      "régimen de jubilaciones y pensiones",
      "jubilación",
      "retiro"
    ]
  },
  {
    "code": "109",
    "name": "PRIMA DE SEGURO DAÑOS DE VIVIENDA INFONAVIT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "109",
      "prima de seguro daños de vivienda infonavit"
    ]
  },
  {
    "code": "110",
    "name": "CRÉDITO DE AUTOMÓVIL CON TERCEROS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "110",
      "crédito de automóvil con terceros"
    ]
  },
  {
    "code": "111",
    "name": "APORTACIÓN COMPLEMENTARIA AFORE",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 111 Aportación complementaria AFORE. Convenio del 27 de junio de 2008. Se estableció\n       que a partir del primero de agosto del 2008, los trabajadores de nuevo ingreso pertenecen a la\n       nueva generación, teniendo una aportación del 7% al 15% a un esquema de pensiones en la\n       Ley del Seguro Social.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023\n                  + 050 + 062 + 063 x 0.15 = importe de descuento del cpto. 111"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "111",
      "aportación complementaria afore"
    ]
  },
  {
    "code": "112",
    "name": "FONDO DE AYUDA SINDICAL POR DEFUNCIÓN",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 112 Fondo de ayuda sindical por defunción. Artículo 8 del Reglamento de Fondo de\n       Trabajo. Este concepto sustituye a los conceptos 182 y 183. Actualmente el importe es de\n       $42.12 pesos quincenales. En caso de defunción de algun trabajador miembro del sindicato,\n       jubilado o pensionado, el fondo de ayuda sindical será por la cantidad de $160, 000.00 pesos."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "112",
      "fondo de ayuda sindical por defunción"
    ]
  },
  {
    "code": "113",
    "name": "SEGURO DE GUARDERÍAS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "113",
      "seguro de guarderías"
    ]
  },
  {
    "code": "114",
    "name": "SEG. IND. VOL. GASTOS MÉDICOS MAYORES",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "114",
      "seg. ind. vol. gastos médicos mayores"
    ]
  },
  {
    "code": "116",
    "name": "SERVICIO DE TELECOMUNICACIONES",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "116",
      "servicio de telecomunicaciones"
    ]
  },
  {
    "code": "119",
    "name": "PRIMA DE SEGURO DE AUTOMÓVIL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "119",
      "prima de seguro de automóvil"
    ]
  },
  {
    "code": "120",
    "name": "SEGURO MÉDICO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "120",
      "seguro médico"
    ]
  },
  {
    "code": "121",
    "name": "SEGURO DE ENFERMERÍA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "121",
      "seguro de enfermería"
    ]
  },
  {
    "code": "122",
    "name": "CRED. TRAB. CONF.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "122",
      "cred. trab. conf."
    ]
  },
  {
    "code": "125",
    "name": "RETENCIÓN A CUENTA DE TERCEROS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "125",
      "retención a cuenta de terceros"
    ]
  },
  {
    "code": "126",
    "name": "SEGURO DE CAMILLERO EN UMH",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "126",
      "seguro de camillero en umh"
    ]
  },
  {
    "code": "129",
    "name": "LICENCIA SIN SUELDO MAYOR 3 DÍAS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "129",
      "licencia sin sueldo mayor 3 días"
    ]
  },
  {
    "code": "130",
    "name": "CRÉDITO HIPOTECARIO E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "130",
      "crédito hipotecario e.s.m.i.",
      "hipotecario",
      "hipoteca",
      "esmi",
      "e.s.m.i.",
      "vivienda"
    ]
  },
  {
    "code": "131",
    "name": "FINAN. DE SEGURO DE VIDA CRÉD. HIP. E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "131",
      "finan. de seguro de vida créd. hip. e.s.m.i."
    ]
  },
  {
    "code": "132",
    "name": "FINAN. DE SEGURO DE DAÑOS CRÉD. HIP. E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "132",
      "finan. de seguro de daños créd. hip. e.s.m.i."
    ]
  },
  {
    "code": "133",
    "name": "AYUDA DE GASTOS DE ESCRITURACIÓN E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "133",
      "ayuda de gastos de escrituración e.s.m.i.",
      "escrituración",
      "notarial",
      "gastos notariales"
    ]
  },
  {
    "code": "134",
    "name": "FINANCIAMIENTO DE AUTOMÓVIL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "134",
      "financiamiento de automóvil"
    ]
  },
  {
    "code": "136",
    "name": "PRÉSTAMOS PERSONALES A MEDIANO PLAZO E.S.M.I.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "136",
      "préstamos personales a mediano plazo e.s.m.i.",
      "préstamo personal",
      "mediano plazo"
    ]
  },
  {
    "code": "137",
    "name": "SEGURO DE VIDA PRES. PPMP",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "137",
      "seguro de vida pres. ppmp"
    ]
  },
  {
    "code": "140",
    "name": "CENTROS VACACIONALES COMISIÓN PARITARIA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "140",
      "centros vacacionales comisión paritaria"
    ]
  },
  {
    "code": "141",
    "name": "VELATORIOS COMISIÓN PARITARIA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "141",
      "velatorios comisión paritaria"
    ]
  },
  {
    "code": "142",
    "name": "ADEUDO DEL PERSONAL POR ACCIDENTES AUTOMOVILÍSTICOS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "142",
      "adeudo del personal por accidentes automovilísticos"
    ]
  },
  {
    "code": "143",
    "name": "ADEUDOS DEL PERSONAL POR FALTANTES DE CAJA O INVENTARIOS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "143",
      "adeudos del personal por faltantes de caja o inventarios"
    ]
  },
  {
    "code": "144",
    "name": "ADEUDOS DEL PERSONAL POR LLAMADAS TELEFÓNICAS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "144",
      "adeudos del personal por llamadas telefónicas"
    ]
  },
  {
    "code": "145",
    "name": "LÍNEA BLANCA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "145",
      "línea blanca"
    ]
  },
  {
    "code": "148",
    "name": "SEGURO DE VIDA COMISIÓN PARITARIA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "148",
      "seguro de vida comisión paritaria"
    ]
  },
  {
    "code": "150",
    "name": "COBROS INDEBIDOS SIN AFEC. AGUINALDOS E ISPT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "150",
      "cobros indebidos sin afec. aguinaldos e ispt"
    ]
  },
  {
    "code": "151",
    "name": "IMPUESTOS SOBRE LA RENTA (ISR)",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 151 Impuesto sobre la renta. Identifica el importe quincenal que retiene el instituto al\n       trabajador para su entrega a la Secretaría de Hacienda y Crédito Público, conforme a lo\n       establecido en la Ley de Impuesto sobre la Renta."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "151",
      "impuestos sobre la renta (isr)",
      "isr",
      "impuesto",
      "impuestos"
    ]
  },
  {
    "code": "152",
    "name": "FONDO DE JUBILACIÓN",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 152 Fondo de jubilación. Cláusula 110 CCT. Régimen de jubilaciones y pensiones. Los\n       trabajadores aportarán el 3% sobre los conceptos señalados en los incisos del a) al n) del\n       artículo 5 del régimen y además el mismo porcentaje del fondo de ahorro. Cuya aportación\n       será anual en a fecha de su pago (segunda quincena de julio).\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 al 019 + 057 + 058 x 1.25 (aguinaldo) + 020 + 022 + 023\n                  + 050 + 062 + 063 x 0.03 = importe de descuento del cpto. 152\n\n                                                  31"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "152",
      "fondo de jubilación",
      "jubilación",
      "retiro",
      "pensión"
    ]
  },
  {
    "code": "153",
    "name": "DESCUENTO COMPLEMEN ISR AÑO ANTERIOR",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "153",
      "descuento complemen isr año anterior"
    ]
  },
  {
    "code": "154",
    "name": "DESCUENTO CRÉDITO INFONAVIT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "154",
      "descuento crédito infonavit",
      "infonavit",
      "crédito",
      "vivienda"
    ]
  },
  {
    "code": "155",
    "name": "DISPOSICIÓN JUDICIAL (PENSIÓN ALIMENTICIA)",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "155",
      "disposición judicial (pensión alimenticia)",
      "pensión alimenticia",
      "alimenticia",
      "alimentos",
      "judicial"
    ]
  },
  {
    "code": "156",
    "name": "VIÁTICOS NO COMPROBADOS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "156",
      "viáticos no comprobados"
    ]
  },
  {
    "code": "160",
    "name": "RECUPERACIÓN CL. 97 DEL CCT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "160",
      "recuperación cl. 97 del cct",
      "cláusula 97",
      "cl. 97",
      "anticipo",
      "anticipo de sueldo"
    ]
  },
  {
    "code": "161",
    "name": "SUSPENSIÓN TEMPORAL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "161",
      "suspensión temporal"
    ]
  },
  {
    "code": "162",
    "name": "RESPONSABILIDAD SOBRE INSTRUMENTOS DE TRABAJO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "162",
      "responsabilidad sobre instrumentos de trabajo"
    ]
  },
  {
    "code": "164",
    "name": "SUSPENSIÓN SINDICAL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "164",
      "suspensión sindical"
    ]
  },
  {
    "code": "166",
    "name": "CASAS COMERCIALES (COMISIÓN PARITARIA)",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "166",
      "casas comerciales (comisión paritaria)",
      "casas comerciales",
      "comisión paritaria",
      "tienda",
      "compras"
    ]
  },
  {
    "code": "167",
    "name": "VÍVERES",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "167",
      "víveres"
    ]
  },
  {
    "code": "168",
    "name": "ROPA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "168",
      "ropa"
    ]
  },
  {
    "code": "169",
    "name": "RECUPERACIÓN VALE A CUENTA DE SUELDO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "169",
      "recuperación vale a cuenta de sueldo"
    ]
  },
  {
    "code": "170",
    "name": "FONACOT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "170",
      "fonacot",
      "fondo de fomento y garantía para el consumo de los trabajadores",
      "credito nómina"
    ]
  },
  {
    "code": "171",
    "name": "LICENCIA SIN SUELDO MENOR A (4) DÍAS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "171",
      "licencia sin sueldo menor a (4) días"
    ]
  },
  {
    "code": "172",
    "name": "FALTA INJUSTIFICADA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "172",
      "falta injustificada"
    ]
  },
  {
    "code": "173",
    "name": "PASES DE SALIDA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "173",
      "pases de salida"
    ]
  },
  {
    "code": "174",
    "name": "RETARDOS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "174",
      "retardos"
    ]
  },
  {
    "code": "175",
    "name": "BECAS SIN SUELDO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "175",
      "becas sin sueldo"
    ]
  },
  {
    "code": "176",
    "name": "DESCUENTO CONVENIO T.A.T.",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "176",
      "descuento convenio t.a.t."
    ]
  },
  {
    "code": "177",
    "name": "SALIDA ANTES",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "177",
      "salida antes"
    ]
  },
  {
    "code": "178",
    "name": "REDUCCIÓN DE JORNADA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "178",
      "reducción de jornada"
    ]
  },
  {
    "code": "179",
    "name": "NOTAS DE DEMÉRITO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "179",
      "notas de demérito"
    ]
  },
  {
    "code": "180",
    "name": "CUOTA SINDICAL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "180",
      "cuota sindical",
      "sindical",
      "sindicato",
      "sntss"
    ]
  },
  {
    "code": "187",
    "name": "CUOTA EXTRAORDINARIA SINDICAL",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "187",
      "cuota extraordinaria sindical"
    ]
  },
  {
    "code": "189",
    "name": "APORTACIÓN AL INFONAVIT",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "189",
      "aportación al infonavit",
      "infonavit",
      "subcuenta de vivienda",
      "vivienda"
    ]
  },
  {
    "code": "190",
    "name": "CAJA DE AHORRO (PRÉSTAMO)",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "190",
      "caja de ahorro (préstamo)"
    ]
  },
  {
    "code": "192",
    "name": "CAJA DE AHORRO (AHORRO)",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "192",
      "caja de ahorro (ahorro)"
    ]
  },
  {
    "code": "194",
    "name": "MUTUALIDAD DE BECARIOS",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "194",
      "mutualidad de becarios"
    ]
  },
  {
    "code": "195",
    "name": "SEGURO INDIVIDUAL VOLUNTARIO VIDA",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "195",
      "seguro individual voluntario vida"
    ]
  },
  {
    "code": "197",
    "name": "RECUP. ANTICIPO DE AGUINALDO ENERO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "197",
      "recup. anticipo de aguinaldo enero"
    ]
  },
  {
    "code": "199",
    "name": "RECUPERACIÓN VALE A CUENTA AGUINALDO",
    "kind": "deduction",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "199",
      "recuperación vale a cuenta aguinaldo"
    ]
  },
  {
    "code": "001",
    "name": "SUELDO CONFIANZA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "CONCEPTO\n\n 001     SUELDO CONFIANZA                               041   COMPLEMENTO DE AYUDA A BECARIO\n\n 002     SUELDO BASE                                    042   ANTICIPO DE SUELDO CL. 97 CCT\n\n 003     SUELDO TEMPORAL                                043   VALE A CUENTA DE AGUINALDO\n\n 005     SUELDO BECARIOS                                044   AYUDA PARA REFRIGERIO\n\n 007     SUELDO BECADOS                                 046   AYUDA DE ALOJAMIENTO A BECARIOS\n\n 008     SUELDO SUSTITUTOS                              047   ANTICIPO DE AGUINALDO DE ENERO\n\n                                                   21"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "001",
      "sueldo confianza"
    ]
  },
  {
    "code": "002",
    "name": "SUELDO BASE",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 002 Sueldo Base. Tabulador de Sueldos del personal de base del IMSS que considera 339\ncategorías. Vigente a partir del 16 de octubre de cada año."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "002",
      "sueldo base"
    ]
  },
  {
    "code": "003",
    "name": "SUELDO TEMPORAL",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "003",
      "sueldo temporal"
    ]
  },
  {
    "code": "005",
    "name": "SUELDO BECARIOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "005",
      "sueldo becarios"
    ]
  },
  {
    "code": "007",
    "name": "SUELDO BECADOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "007",
      "sueldo becados"
    ]
  },
  {
    "code": "008",
    "name": "SUELDO SUSTITUTOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "008",
      "sueldo sustitutos"
    ]
  },
  {
    "code": "009",
    "name": "SUELDO MÉDICO RESIDENTES",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "009",
      "sueldo médico residentes"
    ]
  },
  {
    "code": "010",
    "name": "NIVELACIÓN PLAZA SUPERIOR",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "010",
      "nivelación plaza superior"
    ]
  },
  {
    "code": "011",
    "name": "AYUDA DE RENTA CL. 63 BIS INC. B",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 011 Ayuda de Renta. Cláusula 63 Bis Inc. B. – Ayuda para pago de renta de Casa-\nHabitación\n\n                                           ¿Cómo calcularlo?\n                                         Sueldo tabular (002) x 72.15\n\n        El porcentaje del concepto 011 por lo regular actualiza en cada revisión contractual y es vigente\n        a partir del 16 de octubre de cada año.\n\n                                                        22"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "011",
      "ayuda de renta cl. 63 bis inc. b"
    ]
  },
  {
    "code": "012",
    "name": "JORNADA DISCONTINUA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 012 Jornada Discontinua. Cláusula 28 – jornadas y horarios CCT\n       Las horas de trabajo serán continuas a menos que por necesidad del servicio tuviere que\n       laborarse horario discontinuo, en cuyo caso se requerirá de la aceptación previa del Sindicato,\n       percibiendo el trabajador que la labore en forma discontinua, un 15% más del sueldo de lo\n       normal.\n\n                                       ¿Cómo calcularlo?\n                                Sueldo tabular (002) + cpto. 011 x 15%"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "012",
      "jornada discontinua"
    ]
  },
  {
    "code": "013",
    "name": "SOBRESUELDO A MÉDICOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "013",
      "sobresueldo a médicos"
    ]
  },
  {
    "code": "014",
    "name": "INFECTOCONTAGIOSIDAD NO MÉDICA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "014",
      "infectocontagiosidad no médica"
    ]
  },
  {
    "code": "015",
    "name": "ZONA AISLADA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "015",
      "zona aislada"
    ]
  },
  {
    "code": "016",
    "name": "ALTO COSTO DE VIDA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "016",
      "alto costo de vida"
    ]
  },
  {
    "code": "020",
    "name": "AYUDA DE RENTA CL. 63 BIS INC. A",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 020 Ayuda de Renta. Cláusula 63 Bis Inc. A. – Ayuda para pago de renta casa-habitación\n                       Importe mensual: $500.00 pesos, $250.00 quincenales."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "020",
      "ayuda de renta cl. 63 bis inc. a"
    ]
  },
  {
    "code": "021",
    "name": "GASTOS DE MANUTENCIÓN",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "021",
      "gastos de manutención"
    ]
  },
  {
    "code": "022",
    "name": "AYUDA DE RENTA CL. 63 BIS INC. C",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 022 Ayuda de renta. Cláusula 63 Bis Inc. c. – Ayuda para pago de renta casa-habitación. El\n       factor para pago de antigüedad se calcula diviendo los días de estímulo entre 360. La\n       antigüedad se determina con base en la cláusula 30.\n\n                                       ¿Cómo calcularlo?\n        Sueldo tabular (002)   + cpto. 011 (o en su caso cpto. 013 + 057 + 058 + 061) x factor\n                                    correspondiente los años de servicio.\n\nEl Instituto otorgará a sus trabajadores, anualmente, una cantidad equivalente al número de días de\nsueldo señalados en la tabla siguiente, de acuerdo con su antigüedad efectiva:\n\n                                                  23"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "022",
      "ayuda de renta cl. 63 bis inc. c"
    ]
  },
  {
    "code": "024",
    "name": "COMPENSACIÓN",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "024",
      "compensación"
    ]
  },
  {
    "code": "025",
    "name": "PAGO SUPLETORIO DE GUARDERÍA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 025 Pago supletorio de guardería. Cláusula 76 CCT. En aquellas guarderías en que no\n       hubiere cupo, el Instituto cubrirá al trabajador la cantidad de $1000.00 pesos mensuales por\n       cada hijo al que debiera dársele este servicio, previa comprobación de su derecho. Por lo\n       anterior, el importe quincenal es de $500.00 pesos."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "025",
      "pago supletorio de guardería"
    ]
  },
  {
    "code": "026",
    "name": "PASAJES FIJOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 026 Pasajes fijos. Cláusula 103 CCT. Los trabajadores que deban desempeñar sus tareas\n       fuera de los centros de trabajo, disfrutarán de una compensación mensual de $600.00 pesos\n       para pasajes. Estas prestaciones, no serán suspendidas en las vacaciones, en las licencias por\n       enfermedad o en aquellas menos de quince días. Por lo anterior, el importe quincenal es de\n       $300.00 pesos."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "026",
      "pasajes fijos"
    ]
  },
  {
    "code": "027",
    "name": "COMPENSACIÓN DE PASAJES",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 027 Compensación por pasajes. Pago a los trabajadores que prestan sus servicios en un\n       municipio diferente al de su lugar de residencia, siempre y cuando sea colindante. El importe lo\n       determina la Comisión Nacional o Subcomisiones mixtas de Pasajes."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "027",
      "compensación de pasajes"
    ]
  },
  {
    "code": "029",
    "name": "PRIMA VACACIONAL",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 029 Prima de vacaciones. Cláusula 47- Vacaciones. Por cada año efectivo de servicios, los\n       trabajadores disfrutarán de un período mínimo de vacaciones que será de 16 días hábiles. Por\n       cada año de servicios, se aumentará en un día el período mínimo anual, el cual no podrá\n       exceder de 20 días hábiles. Los trabajadores tendrán derecho a percibir una prima de un 25%\n       sobre los salarios que les correspondan durante su periodo vacacional.\n\n                                        ¿Cómo calcularlo?\n             Salario Mensual Integrado entre 30 x número de días de vacaciones x 0.25"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "029",
      "prima vacacional"
    ]
  },
  {
    "code": "030",
    "name": "PRIMA DOMINICAL",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 030 Prima dominical. Cláusula 46 fracción II.- Descanso diario, semanal y obligatorio. Los\n       trabajadores que laboren los domingos disfrutarán de una prima dominical de un 25% sobre el\n       salario de un día ordinario de trabajo.\n\n                                        ¿Cómo calcularlo?\n        Sueldo tabular (002) + Cpto. 011 + (o en su caso, 012 + 013 + 014 + 015 + 016 + 022 +\n        023 + 054 + 057 + 058 + 061 + 063) + 020 + 050 entre 15, entre jornada reportada por\n                                   horas y décimas por el 0.25%.\n\n                                                  24"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "030",
      "prima dominical"
    ]
  },
  {
    "code": "031",
    "name": "CL. 99 CAMBIO DE LUGAR",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 031 Cambio de lugar. Cláusula 99 CCT. Cuando para el desempeño de labores, el\n      sindicato acepte que un trabajador, previo su conocimiento, sea movilizado por necesidades\n      del servicio, del lugar donde reside a otro distinto, el instituto proporcionará lo mismo que a su\n      esposa o concubina, hijos y a sus padres que dependan económicamente del trabajador, el\n      impore del pasaje en primera clase, los gastos para el transporte de su menaje y el importe de\n      sesenta días de sueldo.\n\n                                       ¿Cómo calcularlo?\n              Sueldo tabular (002) + Cpto. 011 x cuatro quincenas (60 días de sueldo)."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "031",
      "cl. 99 cambio de lugar"
    ]
  },
  {
    "code": "032",
    "name": "ESTÍMULO POR ASISTENCIA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 032 Estímulo por asistencia. Artículo 91 Reglamento Interior de Trabajo del CCT. Cuando\n      el trabajador asista a laborar todos los días hábiles de una quincena, tendrá como estímulo 3\n      días de aguinaldo, cuyo pago se hará en la nómina de la siguiente quincena de aquella en la\n      que esto hubiere ocurrido. Se afecta el pago por faltas injustificadas, licencia sin sueldo,\n      incapacidades por enfermedad general, licencias con sueldo a excepción por fallecimiento de\n      padres, hijos o cónyuge.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 (o en su caso cpto. 019 + 054 + 057 + 058 + 061) entre\n                                      15 x 3 días de estímulo."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "032",
      "estímulo por asistencia"
    ]
  },
  {
    "code": "033",
    "name": "ESTÍMULO POR PUNTUALIDAD",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 033 Estímulo por puntualidad. Cláusula 38 y Artículo 93 Reglamento Interior de Trabajo\n      del CCT. Cuando el trabajador registre 10 veces su asistencia diaria hasta el minuto cinco, se le\n      otorgará como estímulo de puntualidad 2 días de aguinaldo.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 (en su caso cpto. 019 + 054 + 057 + 058 + 061) entre\n                                     15 x 2 días de estímulo."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "033",
      "estímulo por puntualidad"
    ]
  },
  {
    "code": "037",
    "name": "TIEMPO EXTRAORDINARIO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 037 Tiempo extraordinario. Cláusula 32 y Cláusula 33. Se considera como tiempo\n      extraordinario empleado al servicio del instituto el que exceda los límites de la jornada diaria\n      contratada y todo el tiempo laborado en días de descanso semanal y en días no laborales.\n\n                                                  25"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "037",
      "tiempo extraordinario"
    ]
  },
  {
    "code": "038",
    "name": "PAGO EN EFECTIVO DE VACACIONES",
    "kind": "perception",
    "catalog": {
      "listed": false,
      "detail": [
        {
          "text": "Concepto 038 Pago en efectivo de vacaciones. Este concepto se paga únicamente al personal\n       comisionado del SNTSS por periodo anual el tiempo que dure la Comisión Sindical por\n       cláusula 42.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + cpto. 011 (en su caso cpto. 019 + 023 + 054 + 057 + 058 + 061 +\n                             063) + 020 + 050 entre 15 x días a pagar."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "038",
      "pago en efectivo de vacaciones"
    ]
  },
  {
    "code": "039",
    "name": "BONIFICACIÓN DE GUARDERÍAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 039 Bonificaciones de guarderías. $5.21 quincenal. Seguro de Responsabilidad Civil para\n       la rama de guarderías."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "039",
      "bonificación de guarderías"
    ]
  },
  {
    "code": "040",
    "name": "BONIFICACIÓN DE SEGURO MÉDICO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 040 Bonificación de Seguro Médico. $20.20 quincenal. Bonificación al personal médico\n       como protección a la práctica médica."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "040",
      "bonificación de seguro médico"
    ]
  },
  {
    "code": "041",
    "name": "COMPLEMENTO DE AYUDA A BECARIO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "041",
      "complemento de ayuda a becario"
    ]
  },
  {
    "code": "042",
    "name": "ANTICIPO DE SUELDO CL. 97 CCT",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 042 Anticipo de Sueldo. Cláusula 97 del CCT. Es hasta por cuatro meses de sueldo una sola\n       vez al año. Es facultativo para el trabajador de base, usar en una sola ocasión o en forma\n       fraccionada, el derecho que le otorga esta cláusula. Estos anticipos no devengarán intereses.\n\n                                       ¿Cómo calcularlo?\n               Sueldo tabular (002) + Cpto. 011 x 2 x el número de meses solicitados.\n                       Importe máximo de 4 meses. Recuperación: 1 mes en 10 qnas, 2 meses en 20 qnas, 3 meses en 30 qnas, 4 meses en 40 qnas."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "042",
      "anticipo de sueldo cl. 97 cct",
      "anticipo",
      "anticipo de sueldo",
      "cláusula 97"
    ]
  },
  {
    "code": "043",
    "name": "VALE A CUENTA DE AGUINALDO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 043 Vale a cuenta de aguinaldo. Cláusula 107. El aguinaldo anual de los trabajadores será\n       de tres meses de sueldo nominal y proporcional a los sueldos percibidos. El pago se hará\n       anticipando medio mes en la quincena de enero (cpto. 047), un mes más en la primera\n       quincena de agosto a solicitud del trabajador (cpto. 043) y el saldo en la primera quincena del\n       mes de diciembre (cpto. 49). El aguinaldo se paga libre de impuestos, absorbiéndolos en\n       instituto."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "043",
      "vale a cuenta de aguinaldo"
    ]
  },
  {
    "code": "044",
    "name": "AYUDA PARA REFRIGERIO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 044 Ayuda para refrigerio. A los trabajadores de guarderías que no perciben alimentos\n       en especie. Se afecta con las siguientes incidencias: incapacidades, comisiones, licencias con\n\n                                                  26"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "044",
      "ayuda para refrigerio"
    ]
  },
  {
    "code": "046",
    "name": "AYUDA DE ALOJAMIENTO A BECARIOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "046",
      "ayuda de alojamiento a becarios"
    ]
  },
  {
    "code": "047",
    "name": "ANTICIPO DE AGUINALDO DE ENERO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 047 Anticipo de aguinaldo de enero. El aguinaldo anual de los trabajadores será de tres\n       meses de sueldo nominal y proporcional a los sueldos percibidos; el pago se hará anticipando\n       medio mes en la primera quincena de enero (cpto. 047). Es un pago automático."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "047",
      "anticipo de aguinaldo de enero"
    ]
  },
  {
    "code": "048",
    "name": "AYUDA PARA ACTIVIDADES CULTURALES Y RECREATIVAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 048 Ayuda para actividades culturales y recreativas. Cláusula 47. Los trabajadores\n       percibirán por concepto de “ayuda para actividades culturales y recreativas” los días de salario\n       que se indican en la siguiente tabla, de acuerdo a su antigüedad efectiva:\n\n                         ANTIGÜEDAD EFECTIVA EN AÑOS            DÍAS A PAGAR\n                                            1                         23\n\n                                            2                         25\n\n                                            3                         27\n                                            4                         29\n\n                                      5 y más                         31\n\n                                       ¿Cómo calcularlo?\n         Suma de los conceptos del Salario Mensual Integrado entre 30 x número de días de\n                                             ayuda."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "048",
      "ayuda para actividades culturales y recreativas"
    ]
  },
  {
    "code": "049",
    "name": "AGUINALDO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 049 Aguinaldo. Cláusula 107. El aguinaldo anual de los trabajadores será de tres meses de\n       sueldo nominal y proporcional a los sueldos percibidos. El pago se hará anticipando medio mes\n       en la primera quincena del mes de diciembre.\n\n                                       ¿Cómo calcularlo?\n       Sueldo tabular (002) + Cpto. 011 (en su caso cpto. 019 + 054 + 057 + 058 + 061) x 2 x 3"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "049",
      "aguinaldo"
    ]
  },
  {
    "code": "050",
    "name": "AYUDA PARA DESPENSA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 050 Ayuda para despensa. Cláusula 142 Bis. El importe mensual es de: $400.00."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "050",
      "ayuda para despensa"
    ]
  },
  {
    "code": "052",
    "name": "NOTAS DE MÉRITO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 052 Notas de merito. Cláusula 126 y Artículo 97 Reglamento Interior de Trabajo del CCT.\n       Por cada nota de mérito que el trabajador obtenga dentro de un año calendario, tendrá\n       derecho a que se aumente un día adicional de aguinaldo."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "052",
      "notas de mérito"
    ]
  },
  {
    "code": "053",
    "name": "LIQUIDACIONES FONDO DE RETIRO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 053 Liquidaciones fondo de retiro. Cláusula 143 y Capítulo V del Reglamento del fondo de\n       retiro para trabajadores del IMSS.\n\n                                                   27"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "053",
      "liquidaciones fondo de retiro"
    ]
  },
  {
    "code": "054",
    "name": "EMANACIONES RADIOACTIVAS NO MÉDICAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "054",
      "emanaciones radioactivas no médicas"
    ]
  },
  {
    "code": "055",
    "name": "FONDO DE AHORRO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 055 Fondo de ahorro. Cláusula 144 y Artículo 18 del Régimen de jubilaciones y pensiones\n       del CCT. El Instituto entregará a todos los trabajadores en la segunda quincena de julio de cada\n       año, el equivalente a 39 días de sueldo tabular, por concepto de Fondo de Ahorro, así como\n       cinco días adicionales de sueldo tabular en relación con los meses del año que tienen más de\n       treinta días, más dos días de sueldo tabular a partir de la vigencia del contrato 2021-2023\n       (dando un total de 46 días). La cantidad que por este concepto se entregue será libre de\n       impuestos y proporcional al tiempo laborado computado del 1ro de julio al 30 de junio del año\n       siguiente.\n\nLas incidencias que afectan el fondo de ahorro:\n\n    Lic. sin sueldo mayor a 3 días   cpto. 129\n    Lic. sin sueldo de 1 a 3 días    cpto. 171\n    Faltas                           cpto. 172\n    Becas sin sueldo                 cpto. 175\n\n                                        ¿Cómo calcularlo?\n                     Sueldo tabular (002) + Cpto. 011 entre 15 x 46 días = cpto. 055"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "055",
      "fondo de ahorro"
    ]
  },
  {
    "code": "056",
    "name": "INTERESES DEL FONDO DE AHORRO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "056",
      "intereses del fondo de ahorro"
    ]
  },
  {
    "code": "057",
    "name": "ATENCIÓN INTEGRAL",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "057",
      "atención integral"
    ]
  },
  {
    "code": "058",
    "name": "SOBRESUELDO DOCENCIA ENFERMERÍA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 058 Sobresueldo docencia enfermería. Cláusula 151. Los trabajadores en ciertas\n       categorías de enfermería recibirán un aumento del 31% en su salario base debido a su\n       participación en actividades docentes, de enseñanza e investigación.\n\n                                        ¿Cómo calcularlo?\n                           Sueldo tabular (002) + Cpto. 011 x 31% = cpto. 058"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "058",
      "sobresueldo docencia enfermería"
    ]
  },
  {
    "code": "059",
    "name": "COMPLEMENTO DE BECAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "059",
      "complemento de becas"
    ]
  },
  {
    "code": "062",
    "name": "AYUDA PARA LIBROS A MÉDICOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "062",
      "ayuda para libros a médicos"
    ]
  },
  {
    "code": "063",
    "name": "EMANACIONES RADIOACTIVAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "063",
      "emanaciones radioactivas"
    ]
  },
  {
    "code": "064",
    "name": "MATERIAL DIDÁCTICO A MÉDICOS RESIDENTES",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "064",
      "material didáctico a médicos residentes"
    ]
  },
  {
    "code": "066",
    "name": "AYUDA PARA TRANSPORTE",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "066",
      "ayuda para transporte"
    ]
  },
  {
    "code": "067",
    "name": "ESTÍMULOS INSTRUCTORES TÉCNICOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "067",
      "estímulos instructores técnicos"
    ]
  },
  {
    "code": "070",
    "name": "DEVOLUCIONES ISPT AÑO ANTERIOR",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 070 Devoluciones ISPT año anterior. Este concepto se genera de acuerdo a la mecánica\n       del cálculo del ISPT anual, si procede devolución de este concepto, se efectuará en la segunda\n       quincena de marzo del siguiente año correspondiente al ejercicio fiscal del año anterior."
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "070",
      "devoluciones ispt año anterior"
    ]
  },
  {
    "code": "071",
    "name": "SUBSIDIO PARA EL EMPLEO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "071",
      "subsidio para el empleo"
    ]
  },
  {
    "code": "072",
    "name": "AYUDA PARA LIBROS NO MÉDICOS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "072",
      "ayuda para libros no médicos"
    ]
  },
  {
    "code": "076",
    "name": "REINTEGRO CONVENIO T.A.T.",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "076",
      "reintegro convenio t.a.t."
    ]
  },
  {
    "code": "078",
    "name": "ACTIVIDADES ACADÉMICAS",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "078",
      "actividades académicas"
    ]
  },
  {
    "code": "080",
    "name": "PAGO DE SALARIO NO COBRADO",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "080",
      "pago de salario no cobrado"
    ]
  },
  {
    "code": "083",
    "name": "SOBRESUELDO POR INVESTIGACIÓN Y DOCENCIA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": []
    },
    "status": "reference-only",
    "requiresCurrentValidation": false,
    "searchTerms": [
      "083",
      "sobresueldo por investigación y docencia"
    ]
  },
  {
    "code": "084",
    "name": "ESTÍMULO A LA CALIDAD Y EFICIENCIA",
    "kind": "perception",
    "catalog": {
      "listed": true,
      "detail": [
        {
          "text": "Concepto 084 Estímulo a la calidad y eficiencia. Cláusula 18a Transitoria. Todos los trabajadores de\n       base del instituto tendrán derecho a un bono que incentive la productividad, eficiencia y\n       calidad de su trabajo, premiando los resultados excepcionales de acuerdo a sus funciones,\n       según lo establecido en el contrato.\n\n                                                   28"
        }
      ]
    },
    "status": "reference-only",
    "requiresCurrentValidation": true,
    "searchTerms": [
      "084",
      "estímulo a la calidad y eficiencia"
    ]
  }
];
