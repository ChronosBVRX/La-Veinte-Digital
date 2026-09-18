import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const APPDATA_DIR = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const AGENT_DATA_DIR = path.join(APPDATA_DIR, "LaVeintePrintAgent");
const CREDENTIAL_FILE = path.join(AGENT_DATA_DIR, "station.dat");
const CONFIG_FILE = path.join(AGENT_DATA_DIR, "config.json");

function ensureDirExists() {
  if (!fs.existsSync(AGENT_DATA_DIR)) {
    fs.mkdirSync(AGENT_DATA_DIR, { recursive: true });
  }
}

/**
 * Cifra un texto sensible utilizando Windows Data Protection API (DPAPI)
 * anclado a la cuenta de usuario de Windows actual.
 */
export function encryptWithDpapi(plainText) {
  ensureDirExists();
  const b64Input = Buffer.from(plainText, "utf8").toString("base64");
  const psScript = `
    Add-Type -AssemblyName System.Security;
    $bytes = [System.Convert]::FromBase64String('${b64Input}');
    $enc = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser);
    [System.Convert]::ToBase64String($enc)
  `.trim();

  const out = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, " ")}"`, {
    encoding: "utf8",
  });
  return out.trim();
}

/**
 * Descifra el secreto protegido con Windows DPAPI.
 */
export function decryptWithDpapi(cipherTextBase64) {
  const psScript = `
    Add-Type -AssemblyName System.Security;
    $enc = [System.Convert]::FromBase64String('${cipherTextBase64}');
    $dec = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser);
    [System.Text.Encoding]::UTF8.GetString($dec)
  `.trim();

  const out = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, " ")}"`, {
    encoding: "utf8",
  });
  return out.trim();
}

/**
 * Guarda las credenciales de la estación de impresión de forma segura.
 */
export function saveStationCredentials({ serverUrl, token, printerName }) {
  ensureDirExists();

  // 1. Guardar token cifrado con DPAPI
  const encryptedToken = encryptWithDpapi(token.trim());
  fs.writeFileSync(CREDENTIAL_FILE, encryptedToken, { encoding: "utf8", mode: 0o600 });

  // 2. Guardar configuración no sensible
  const config = {
    serverUrl: (serverUrl || "http://localhost:3000").replace(/\/$/, ""),
    printerName: printerName || "",
    configuredAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
}

/**
 * Lee la configuración y descifra el token de estación.
 */
export function loadStationCredentials() {
  if (!fs.existsSync(CREDENTIAL_FILE) || !fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const configRaw = fs.readFileSync(CONFIG_FILE, "utf8");
    const config = JSON.parse(configRaw);
    const encryptedToken = fs.readFileSync(CREDENTIAL_FILE, "utf8").trim();
    const token = decryptWithDpapi(encryptedToken);

    return {
      serverUrl: config.serverUrl,
      printerName: config.printerName || "",
      token,
    };
  } catch (err) {
    console.error("Error al descifrar credenciales de Windows DPAPI:", err.message);
    return null;
  }
}

export function readConfigSummary() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return "La Veinte Print Agent NO está configurado. Ejecuta: npm run setup";
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  return `Estación configurada:\n Servidor: ${cfg.serverUrl}\n Impresora: ${cfg.printerName || "(Predeterminada de Windows)"}\n Archivo DPAPI: ${CREDENTIAL_FILE}`;
}
