import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getInitialState: () => ipcRenderer.invoke("get-initial-state"),
  enrollWithCode: (code, serverUrl) => ipcRenderer.invoke("enroll-with-code", { code, serverUrl }),
  getInstalledPrinters: () => ipcRenderer.invoke("get-installed-printers"),
  savePreferredPrinter: (printerName) => ipcRenderer.invoke("save-preferred-printer", { printerName }),
  runTestPrint: () => ipcRenderer.invoke("run-test-print"),
  minimizeToTray: () => ipcRenderer.invoke("minimize-to-tray"),
  disconnectStation: () => ipcRenderer.invoke("disconnect-station"),
  copyDiagnostics: () => ipcRenderer.invoke("copy-diagnostics"),
  onStatusUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("status-update", handler);
    return () => ipcRenderer.removeListener("status-update", handler);
  },
  onJobUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("job-update", handler);
    return () => ipcRenderer.removeListener("job-update", handler);
  },
});
