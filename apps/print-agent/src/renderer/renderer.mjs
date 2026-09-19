// Lógica del cliente gráfico de La Veinte Print

const viewEnroll = document.getElementById("view-enroll");
const viewSetupPrinter = document.getElementById("view-setup-printer");
const viewDashboard = document.getElementById("view-dashboard");
const badge = document.getElementById("connection-badge");

// Inputs de dígitos
const digitInputs = [
  document.getElementById("code-1"),
  document.getElementById("code-2"),
  document.getElementById("code-3"),
  document.getElementById("code-4"),
  document.getElementById("code-5"),
  document.getElementById("code-6"),
];

const btnEnroll = document.getElementById("btn-enroll");
const enrollError = document.getElementById("enroll-error");
const btnToggleAdvanced = document.getElementById("btn-toggle-advanced");
const advancedFields = document.getElementById("advanced-fields");
const inputServerUrl = document.getElementById("input-server-url");

// Elementos de configuración de impresora
const setupStationName = document.getElementById("setup-station-name");
const selectPrinter = document.getElementById("select-printer");
const btnTestPrintSetup = document.getElementById("btn-test-print-setup");
const btnFinishSetup = document.getElementById("btn-finish-setup");
const testPrintMsg = document.getElementById("test-print-msg");

// Elementos de Dashboard
const dashStatusText = document.getElementById("dash-status-text");
const dashLastSeen = document.getElementById("dash-last-seen");
const statusDot = document.getElementById("status-dot");
const dashStationName = document.getElementById("dash-station-name");
const dashPrinterName = document.getElementById("dash-printer-name");
const recentJobBox = document.getElementById("recent-job-box");
const recentJobText = document.getElementById("recent-job-text");
const btnDashTestPrint = document.getElementById("btn-dash-test-print");
const btnDashMinimize = document.getElementById("btn-dash-minimize");
const btnDashDiagnostics = document.getElementById("btn-dash-diagnostics");
const btnDashDisconnect = document.getElementById("btn-dash-disconnect");

function showView(view) {
  viewEnroll.style.display = "none";
  viewSetupPrinter.style.display = "none";
  viewDashboard.style.display = "none";
  view.style.display = "block";
}

function updateConnectionBadge(isOnline) {
  if (isOnline) {
    badge.className = "badge badge-online";
    badge.textContent = "● Conectado";
    statusDot.className = "dot dot-online";
    dashStatusText.textContent = "Estación en línea y operativa";
    dashLastSeen.textContent = "Escuchando cola de impresión automática en tiempo real";
  } else {
    badge.className = "badge badge-offline";
    badge.textContent = "○ Desconectado";
    statusDot.className = "dot";
    dashStatusText.textContent = "Estación desconectada";
    dashLastSeen.textContent = "Reintentando conexión con La Veinte Digital...";
  }
}

// ------------------------------------------------------------
// 1. Manejo amigable de los 6 inputs numéricos (Auto-Focus & Paste)
// ------------------------------------------------------------
digitInputs.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    const val = e.target.value.replace(/\D/g, "");
    input.value = val ? val[val.length - 1] : "";

    if (input.value && index < digitInputs.length - 1) {
      digitInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      digitInputs[index - 1].focus();
    } else if (e.key === "Enter") {
      handleEnroll();
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData).getData("text");
    const digits = pasteData.replace(/\D/g, "").slice(0, 6);

    for (let i = 0; i < digitInputs.length; i++) {
      digitInputs[i].value = digits[i] || "";
    }

    if (digits.length === 6) {
      btnEnroll.focus();
    } else if (digits.length > 0 && digits.length < 6) {
      digitInputs[digits.length].focus();
    }
  });
});

function getEnteredCode() {
  return digitInputs.map((inp) => inp.value.trim()).join("");
}

// ------------------------------------------------------------
// 2. Vinculación con Código de 6 Dígitos
// ------------------------------------------------------------
async function handleEnroll() {
  const code = getEnteredCode();
  if (code.length !== 6) {
    showEnrollError("Por favor introduce los 6 números del código de vinculación.");
    return;
  }

  btnEnroll.disabled = true;
  btnEnroll.textContent = "Vinculando con La Veinte Digital...";
  hideEnrollError();

  const serverUrl = inputServerUrl.value.trim() || "https://la20.com.mx";
  const result = await window.api.enrollWithCode(code, serverUrl);

  btnEnroll.disabled = false;
  btnEnroll.textContent = "Vincular Estación de Oficina";

  if (!result.success) {
    showEnrollError(result.error || "No se pudo vincular con el código.");
    return;
  }

  // Éxito: pasar a selección de impresora
  setupStationName.textContent = result.station_name || "Oficina Sindical";
  await populatePrinters(result.printer_name);
  showView(viewSetupPrinter);
}

btnEnroll.addEventListener("click", handleEnroll);

btnToggleAdvanced.addEventListener("click", () => {
  const isHidden = advancedFields.style.display === "none";
  advancedFields.style.display = isHidden ? "block" : "none";
});

function showEnrollError(msg) {
  enrollError.textContent = msg;
  enrollError.style.display = "block";
}

function hideEnrollError() {
  enrollError.style.display = "none";
}

// ------------------------------------------------------------
// 3. Poblado y Configuración de Impresoras
// ------------------------------------------------------------
async function populatePrinters(preselectedName = "") {
  selectPrinter.innerHTML = "";
  const printers = await window.api.getInstalledPrinters();

  if (printers.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(Predeterminada de Windows)";
    selectPrinter.appendChild(opt);
    return;
  }

  printers.forEach((pName) => {
    const opt = document.createElement("option");
    opt.value = pName;
    opt.textContent = pName;
    if (preselectedName && pName.toLowerCase() === preselectedName.toLowerCase()) {
      opt.selected = true;
    }
    selectPrinter.appendChild(opt);
  });
}

btnTestPrintSetup.addEventListener("click", async () => {
  btnTestPrintSetup.disabled = true;
  btnTestPrintSetup.textContent = "Enviando al spooler de Windows...";
  testPrintMsg.style.display = "block";
  testPrintMsg.textContent = "Imprimiendo página de prueba...";

  const res = await window.api.runTestPrint();
  btnTestPrintSetup.disabled = false;
  btnTestPrintSetup.textContent = "📄 Imprimir página de prueba";

  if (res.success) {
    testPrintMsg.textContent = "✓ Página de prueba enviada con éxito a la impresora.";
  } else {
    testPrintMsg.textContent = `⚠ Fallo al imprimir: ${res.error}`;
  }
});

btnFinishSetup.addEventListener("click", async () => {
  const selected = selectPrinter.value;
  btnFinishSetup.disabled = true;
  btnFinishSetup.textContent = "Guardando...";

  await window.api.savePreferredPrinter(selected);
  btnFinishSetup.disabled = false;
  btnFinishSetup.textContent = "Finalizar configuración";

  // Cambiar a vista dashboard y minimizar a bandeja
  renderDashboardData({
    printerName: selected,
    stationName: setupStationName.textContent,
  });
  showView(viewDashboard);
  await window.api.minimizeToTray();
});

// ------------------------------------------------------------
// 4. Panel de Estado (Dashboard)
// ------------------------------------------------------------
function renderDashboardData({ stationName, printerName }) {
  if (stationName) dashStationName.textContent = stationName;
  if (printerName) {
    dashPrinterName.textContent = printerName;
  } else {
    dashPrinterName.textContent = "(Predeterminada de Windows)";
  }
}

btnDashTestPrint.addEventListener("click", async () => {
  btnDashTestPrint.disabled = true;
  btnDashTestPrint.textContent = "Imprimiendo prueba...";
  const res = await window.api.runTestPrint();
  btnDashTestPrint.disabled = false;
  btnDashTestPrint.textContent = "📄 Imprimir página de prueba";

  if (res.success) {
    alert("✓ Página de prueba enviada exitosamente a la impresora.");
  } else {
    alert(`⚠ Error al imprimir: ${res.error}`);
  }
});

btnDashMinimize.addEventListener("click", () => {
  window.api.minimizeToTray();
});

btnDashDiagnostics.addEventListener("click", async () => {
  await window.api.copyDiagnostics();
  const prevText = btnDashDiagnostics.textContent;
  btnDashDiagnostics.textContent = "¡Copiado al portapapeles!";
  setTimeout(() => {
    btnDashDiagnostics.textContent = prevText;
  }, 2000);
});

btnDashDisconnect.addEventListener("click", async () => {
  const confirmed = confirm(
    "¿Seguro que deseas desvincular esta estación? La computadora dejará de recibir impresiones automáticas hasta que se vuelva a emparejar."
  );
  if (confirmed) {
    await window.api.disconnectStation();
    digitInputs.forEach((i) => (i.value = ""));
    showView(viewEnroll);
    digitInputs[0].focus();
  }
});

// ------------------------------------------------------------
// 5. Notificaciones IPC en Tiempo Real
// ------------------------------------------------------------
window.api.onStatusUpdate((data) => {
  if (data.isDisconnected) {
    showView(viewEnroll);
    updateConnectionBadge(false);
    return;
  }

  updateConnectionBadge(data.isOnline);
  if (data.stationName) dashStationName.textContent = data.stationName;
  if (data.printerName) dashPrinterName.textContent = data.printerName;
});

window.api.onJobUpdate((job) => {
  recentJobBox.style.display = "block";
  if (job.status === "printing") {
    recentJobText.textContent = `Imprimiendo expediente ${job.folio || job.id}...`;
  } else if (job.status === "printed") {
    recentJobText.textContent = `✓ Expediente ${job.folio || job.id} impreso con éxito.`;
  } else if (job.status === "failed") {
    recentJobText.textContent = `✕ Error en expediente ${job.folio || job.id}: ${job.error || "Fallo en spooler"}`;
  }
});

// ------------------------------------------------------------
// 6. Carga Inicial
// ------------------------------------------------------------
async function init() {
  const state = await window.api.getInitialState();

  updateConnectionBadge(state.isOnline);

  if (state.isPaired) {
    renderDashboardData(state);
    showView(viewDashboard);
  } else {
    showView(viewEnroll);
    digitInputs[0].focus();
  }
}

init();
