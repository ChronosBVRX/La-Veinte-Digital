import { describe, expect, it } from "vitest";
import {
  normalizeMatricula,
  parseAltaRegistrosRows,
  parseBuscarRegistroRows,
  parseConfigUsuarioDetail,
  parseLoginSessionId,
  parseWorkerLookupResponse,
} from "../services/parking/cav-hgr1-parser";
import {
  getCavAreaLabel,
  getCavParkingLotCode,
  getCavParkingLotLabel,
  getCavShiftLabel,
  getCavVehicleModelLabel,
} from "../services/parking/catalogs";
import { linkParkingRowsWithWorkers } from "../services/parking/cav-hgr1-client";
import { classifyRequestPath } from "@/shared/server/routing/route-policy";

describe("CAV HGR 1 Parking Integration & Padrón Sindical Linker", () => {
  it("parseLoginSessionId extracts UserSess value from validar.php response", () => {
    const html = `<form><input type="text" id="UserSess" name="UserSess" value="16" style="display:none"></form>`;
    expect(parseLoginSessionId(html)).toBe("16");
    expect(parseLoginSessionId("<html></html>")).toBeNull();
  });

  it("parseBuscarRegistroRows parses active and suspended rows from buscar_registro.php", () => {
    const sampleHtml = `
      <table id="dataTables-example">
        <tbody>
          <tr class='odd gradeX'>
            <td><button type="button" class="btn btn-outline btn-warning" onclick="Send_Auxiliar2('../fpdf/print/gen_code_qr_encript_hgr1.php','1','1792');"><i class="fa fa-file-pdf-o fa-fw"></i></button></td>
            <td><div class='c12'><div class='c10'>
              <label class='switch' onChange='select_campos_show("1","1792");'>
                <input type='checkbox' id='Chk_Pto_Rep[1]' name=Chk_Pto_Rep[1]' value='1' checked='checked'> <span class='sliderV round'></span>
              </label>
              <label class='left'>31</label>
            </div></div></td>
            <td>BEATRIZ SARAHI BALTAZAR ROSALES // 97170668<br>200216</td>
            <td class='center'>UKF482G</td>
            <td>BASE</td>
          </tr>
          <tr class='odd gradeX'>
            <td><button type="button" class="btn btn-outline btn-warning" onclick="Send_Auxiliar2('../fpdf/print/gen_code_qr_encript_hgr1.php','1','2049');"><i class="fa fa-file-pdf-o fa-fw"></i></button></td>
            <td><div class='c12'><div class='c10'>
              <label class='switch' onChange='select_campos_show("5","2049");'>
                <input type='checkbox' id='Chk_Pto_Rep[5]' name=Chk_Pto_Rep[5]' value='5' > <span class='sliderV round'></span>
              </label>
              <label class='left'>0</label>
            </div></div></td>
            <td>OSCAR MEDRANO DIAZ // 98177799<br>200217</td>
            <td class='center'>pjj556c</td>
            <td>CONFIANZA</td>
          </tr>
        </tbody>
      </table>
    `;

    const rows = parseBuscarRegistroRows(sampleHtml);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      external_id_reg: 1792,
      status: "A",
      cajon_number: "31",
      full_name: "BEATRIZ SARAHI BALTAZAR ROSALES",
      matricula: "97170668",
      area_code: "200216",
      area_label: "Anatomía Patológica",
      placas: "UKF482G",
      parking_lot: "1",
      parking_lot_label: "BASE",
    });

    expect(rows[1]).toEqual({
      external_id_reg: 2049,
      status: "X",
      cajon_number: "0",
      full_name: "OSCAR MEDRANO DIAZ",
      matricula: "98177799",
      area_code: "200217",
      area_label: "Hospitalización",
      placas: "PJJ556C",
      parking_lot: "2",
      parking_lot_label: "CONFIANZA",
    });
  });

  it("parseAltaRegistrosRows extracts rows from alta_registros.php table", () => {
    const html = `
      <tr class='odd gradeX'>
        <td><button type='button' class='btn btn-outline btn-success' onclick='Send_Auxiliar("config_usuarios.php","2730");'>30 </button></td>
        <td><span>AARON CUAUHTEMOC<br><em>99177916</em></span></td>
        <td>PJJ556C</td>
        <td>200219</td>
      </tr>
    `;
    const rows = parseAltaRegistrosRows(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      external_id_reg: 2730,
      cajon_number: "30",
      full_name: "AARON CUAUHTEMOC",
      matricula: "99177916",
      placas: "PJJ556C",
      area_code: "200219",
      area_label: "Quirofanos",
    });
  });

  it("parseConfigUsuarioDetail extracts full form details from config_usuarios.php", () => {
    const html = `
      <input type="text" id="Cmpo_12" name="Cmpo_12" value="99177916">
      <input type="text" id="Cmpo_2" name="Cmpo_2" value="AARON CUAUHTEMOC">
      <input type="text" id="Cmpo_2A" name="Cmpo_2A" value="REBOLLO">
      <input type="text" id="Cmpo_2B" name="Cmpo_2B" value="GARCIA">
      <input type="text" id="Cmpo_4" name="Cmpo_4" value="MEDICO NO FAMILIAR">
      <select name="Cmpo_5" id="Cmpo_5">
        <option value='200219'>Quirofanos</option>
        <option value='200217'>Hospitalización</option>
      </select>
      <input type="text" id="Cmpo_1" name="Cmpo_1" value="PJJ556C">
      <select name="Cmpo_6" id="Cmpo_6">
        <option value='19'>Mazda) 3 Sedan</option>
        <option value='1'>Nissan) Versa</option>
      </select>
      <select name="Cmpo_11" id="Cmpo_11">
        <option value='1'>BASE</option>
      </select>
      <select name="Cmpo_7" id="Cmpo_7">
        <option value='V'>Vespertino</option>
      </select>
      <input type="text" id="Cmpo_3" name="Cmpo_3" value="aaron.rebollo@imss.gob.mx">
      <h1><span id="SpanIdReg">2730</span></h1>
      <h1><span id="SpanIdReg2">170501-1-30-2730</span></h1>
    `;

    const detail = parseConfigUsuarioDetail(html);
    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      external_id_reg: 2730,
      cajon_key: "170501-1-30-2730",
      cajon_number: "30",
      matricula: "99177916",
      nombre: "AARON CUAUHTEMOC",
      apellido_paterno: "REBOLLO",
      apellido_materno: "GARCIA",
      full_name: "AARON CUAUHTEMOC REBOLLO GARCIA",
      cargo: "MEDICO NO FAMILIAR",
      area_code: "200219",
      area_label: "Quirofanos",
      placas: "PJJ556C",
      vehicle_model_id: 19,
      vehicle_model_label: "Mazda) 3 Sedan",
      parking_lot: "1",
      parking_lot_label: "BASE",
      shift: "V",
      email: "aaron.rebollo@imss.gob.mx",
    });
  });

  it("parseWorkerLookupResponse parses list_trab.php JS assignments", () => {
    const jsHtml = `
      <script>
        parent.document.getElementById("Cmpo_2").value = "BLADIMIR";
        parent.document.getElementById("Cmpo_2A").value = "TERA";
        parent.document.getElementById("Cmpo_2B").value = "MARTINEZ";
        parent.document.getElementById("Cmpo_4").value = "ENFERMERA GENERAL";
      </script>
    `;
    expect(parseWorkerLookupResponse(jsHtml)).toEqual({
      nombre: "BLADIMIR",
      apellido_paterno: "TERA",
      apellido_materno: "MARTINEZ",
      cargo: "ENFERMERA GENERAL",
    });
  });

  it("linkParkingRowsWithWorkers links CAV records with union_workers by normalized matricula and preserves baja status", () => {
    const cavRows = [
      {
        external_id_reg: 1792,
        status: "A" as const,
        cajon_number: "31",
        full_name: "BEATRIZ SARAHI BALTAZAR ROSALES",
        matricula: "97170668",
        area_code: "200216",
        area_label: "Anatomía Patológica",
        placas: "UKF482G",
        parking_lot: "1" as const,
        parking_lot_label: "BASE",
      },
      {
        external_id_reg: 2049,
        status: "X" as const,
        cajon_number: "0",
        full_name: "OSCAR MEDRANO DIAZ",
        matricula: "98177799",
        area_code: "200217",
        area_label: "Hospitalización",
        placas: "PJJ556C",
        parking_lot: "1" as const,
        parking_lot_label: "BASE",
      },
    ];

    const workers = [
      { id: "worker-uuid-1", employee_number: "97170668" },
    ];

    const existingMap = new Map([
      [2049, { internal_status: "baja", worker_id: "worker-uuid-2" }],
    ]);

    const linked = linkParkingRowsWithWorkers(
      "delegation-uuid",
      cavRows,
      workers,
      existingMap,
      "2026-09-29T04:00:00.000Z",
    );

    expect(linked).toHaveLength(2);
    expect(linked[0].worker_id).toBe("worker-uuid-1");
    expect(linked[0].internal_status).toBe("activo");
    expect(linked[1].worker_id).toBe("worker-uuid-2");
    expect(linked[1].internal_status).toBe("baja");
  });

  it("resolves official HGR 1 catalogs and registers API routes in route-policy", () => {
    expect(normalizeMatricula(" 99173930 ")).toBe("99173930");
    expect(getCavAreaLabel("200219")).toBe("Quirofanos");
    expect(getCavVehicleModelLabel(19)).toBe("Mazda) 3 Sedan");
    expect(getCavParkingLotLabel("1")).toBe("BASE");
    expect(getCavParkingLotCode("CONFIANZA")).toBe("2");
    expect(getCavShiftLabel("M")).toBe("Matutino");

    expect(classifyRequestPath("/api/union/parking")).toBe("authenticated-api");
    expect(classifyRequestPath("/api/union/parking/sync")).toBe("authenticated-api");
    expect(classifyRequestPath("/api/union/parking/1792/qr")).toBe("authenticated-api");
  });

  it("Print Agent parking-bridge.cjs uses official unit code 170501 and parses 5-cell buscar_registro.php rows identically", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bridgeMod = require("../../../../apps/print-agent/src/parking-bridge.cjs") as {
      CAV_HGR1_UNIT_CODE: string;
      parseBuscarRegistroRows: typeof parseBuscarRegistroRows;
    };
    expect(bridgeMod.CAV_HGR1_UNIT_CODE).toBe("170501");

    const sampleHtml = `
      <table id="dataTables-example">
        <tbody>
          <tr class='odd gradeX'>
            <td><button type="button" class="btn btn-outline btn-warning" onclick="Send_Auxiliar2('../fpdf/print/gen_code_qr_encript_hgr1.php','1','1792');"><i class="fa fa-file-pdf-o fa-fw"></i></button></td>
            <td><div class='c12'><div class='c10'>
              <label class='switch' onChange='select_campos_show("1","1792");'>
                <input type='checkbox' id='Chk_Pto_Rep[1]' name=Chk_Pto_Rep[1]' value='1' checked='checked'> <span class='sliderV round'></span>
              </label>
              <label class='left'>31</label>
            </div></div></td>
            <td>BEATRIZ SARAHI BALTAZAR ROSALES // 97170668<br>200216</td>
            <td class='center'>UKF482G</td>
            <td>BASE</td>
          </tr>
        </tbody>
      </table>
    `;

    const rows = bridgeMod.parseBuscarRegistroRows(sampleHtml);
    expect(rows).toEqual(parseBuscarRegistroRows(sampleHtml));
  });

  it("getParkingBridgeStatus considers stations seen within 90s as online", async () => {
    const { getParkingBridgeStatus } = await import("../services/parking/cav-hgr1-client");
    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "station-1",
                      name: "Oficina Sindical",
                      is_active: true,
                      agent_version: "1.2.0",
                      last_seen_at: new Date(Date.now() - 60_000).toISOString(), // 60s ago (within 90s tolerance)
                    },
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const status = await getParkingBridgeStatus(mockSupabase as never, "dep-1");
    expect(status.stationOnline).toBe(true);
    expect(status.bridgeCapable).toBe(true);
  });

  it("getCavConfig never contains hardcoded default credentials and fails safely without env", async () => {
    const { getCavConfig, loginToCavHgr1 } = await import("../services/parking/cav-hgr1-client");
    const prevUser = process.env.CAV_HGR1_USERNAME;
    const prevPass = process.env.CAV_HGR1_PASSWORD;
    try {
      delete process.env.CAV_HGR1_USERNAME;
      delete process.env.CAV_HGR1_PASSWORD;

      const cfg = getCavConfig();
      expect(cfg.username).toBe("");
      expect(cfg.password).toBe("");

      await expect(loginToCavHgr1()).rejects.toThrow("CAV_CREDENTIALS_NOT_CONFIGURED");
    } finally {
      if (prevUser !== undefined) process.env.CAV_HGR1_USERNAME = prevUser;
      if (prevPass !== undefined) process.env.CAV_HGR1_PASSWORD = prevPass;
    }
  });
});

