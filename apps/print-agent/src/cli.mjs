import readline from "node:readline";
import { saveStationCredentials } from "./security.mjs";
import { getInstalledPrinters } from "./spooler.mjs";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("=================================================");
  console.log("  CONFIGURACIÓN DE LA VEINTE PRINT AGENT        ");
  console.log("=================================================\n");

  console.log("Paso 1: Dirección de La Veinte Digital");
  const serverInput = await ask("URL del servidor [http://localhost:3000]: ");
  const serverUrl = (serverInput.trim() || "http://localhost:3000").replace(/\/$/, "");

  console.log("\nPaso 2: Token secreto de la estación");
  console.log("(Este token lo generó el administrador en /representacion/impresion)");
  const token = await ask("Token de la estación: ");

  if (!token || token.trim().length < 16) {
    console.error("\n[ERROR] El token ingresado es inválido o demasiado corto.");
    rl.close();
    process.exit(1);
  }

  console.log("\nPaso 3: Selección de Impresora en Windows");
  console.log("Detectando impresoras instaladas en este equipo...");
  const printers = await getInstalledPrinters();

  let selectedPrinter = "";
  if (printers.length > 0) {
    console.log("\nImpresoras detectadas:");
    printers.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p}`);
    });
    console.log(`  [0] Usar impresora predeterminada de Windows`);

    const choice = await ask(`\nSelecciona el número de impresora [0-${printers.length}]: `);
    const num = parseInt(choice.trim(), 10);
    if (!isNaN(num) && num > 0 && num <= printers.length) {
      selectedPrinter = printers[num - 1];
    }
  } else {
    console.log("No se pudieron detectar impresoras automáticamente.");
    const custom = await ask("Escribe el nombre exacto de la impresora (o enter para predeterminada): ");
    selectedPrinter = custom.trim();
  }

  console.log(`\nImpresora asignada: "${selectedPrinter || "Predeterminada de Windows"}"`);

  // Paso 4: Probar conexión
  console.log("\nPaso 4: Verificando conexión con el servidor...");
  try {
    const res = await fetch(`${serverUrl}/api/union/print-agent/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-station-token": token.trim(),
      },
      body: JSON.stringify({
        printer_name: selectedPrinter,
        agent_version: "1.0.0-setup",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`\n[ERROR] El servidor rechazó la autenticación (${res.status}): ${err.error || "Token inválido"}`);
      rl.close();
      process.exit(1);
    }

    const data = await res.json();
    console.log(`✓ Conexión exitosa. Estación reconocida: "${data.station_name}"`);

    // Paso 5: Guardar credenciales cifradas con Windows DPAPI
    saveStationCredentials({
      serverUrl,
      token: token.trim(),
      printerName: selectedPrinter,
    });

    console.log("\n=================================================");
    console.log("  ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!           ");
    console.log("=================================================");
    console.log("El secreto se ha guardado cifrado mediante Windows DPAPI.");
    console.log("Para arrancar el agente manualmente ejecuta:");
    console.log("  npm start");
    console.log("\nPara configurar el inicio automático con Windows ejecuta:");
    console.log("  powershell -ExecutionPolicy Bypass -File .\\install-autostart.ps1\n");
  } catch (err) {
    console.error(`\n[ERROR] No se pudo conectar con ${serverUrl}: ${err.message}`);
  } finally {
    rl.close();
  }
}

main();
