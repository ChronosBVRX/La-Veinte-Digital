import { execFileSync, execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GpuSnapshot {
  name: string | null;
  driver: string | null;
  cudaDriver: string | null;
  vramTotalMb: number | null;
  vramUsedMb: number | null;
  vramFreeMb: number | null;
  tempC: number | null;
  gpuUtil: number | null;
  powerW: number | null;
}

export type HardwareProfile = "LAPTOP_LOW_VRAM_NVIDIA" | "NVIDIA_GPU" | "CPU_ONLY" | "UNKNOWN";

export interface HardwareInfo {
  profile: HardwareProfile;
  cpu: string;
  ramTotalGb: number;
  ramFreeGb: number;
  diskFreeGb: number | null;
  gpu: GpuSnapshot;
  isBattery: boolean;
}

function nvidiaSmiAvailable(): boolean {
  try {
    execFileSync("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], { timeout: 8000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function readGpuSnapshot(): Promise<GpuSnapshot> {
  const snap: GpuSnapshot = {
    name: null, driver: null, cudaDriver: null, vramTotalMb: null, vramUsedMb: null,
    vramFreeMb: null, tempC: null, gpuUtil: null, powerW: null,
  };
  if (!nvidiaSmiAvailable()) return snap;
  try {
    const [basic, mem, dyn] = await Promise.all([
      execFileAsync("nvidia-smi", ["--query-gpu=name,driver_version", "--format=csv,noheader,nounits"], { timeout: 8000 }),
      execFileAsync("nvidia-smi", ["--query-gpu=memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"], { timeout: 8000 }),
      execFileAsync("nvidia-smi", ["--query-gpu=temperature.gpu,utilization.gpu,power.draw", "--format=csv,noheader,nounits"], { timeout: 8000 }),
    ]);
    const b = basic.stdout.trim().split(",");
    const m = mem.stdout.trim().split(",").map((x) => Number(x.trim()));
    const d = dyn.stdout.trim().split(",");
    snap.name = b[0]?.trim() ?? null;
    snap.driver = b[1]?.trim() ?? null;
    snap.vramTotalMb = Number.isFinite(m[0]) ? m[0] : null;
    snap.vramUsedMb = Number.isFinite(m[1]) ? m[1] : null;
    snap.vramFreeMb = Number.isFinite(m[2]) ? m[2] : null;
    snap.tempC = Number.isFinite(Number(d[0])) ? Number(d[0]) : null;
    snap.gpuUtil = Number.isFinite(Number(d[1])) ? Number(d[1]) : null;
    snap.powerW = Number.isFinite(Number(d[2])) ? Number(d[2]) : null;
  } catch {
    /* snapshot parcial */
  }
  return snap;
}

function cpuName(): string {
  try {
    const env = process.env;
    if (env.PROCESSOR_IDENTIFIER) return env.PROCESSOR_IDENTIFIER;
  } catch { /* noop */ }
  return "CPU desconocida";
}

function systemMemoryGb(): { total: number; free: number } {
  return {
    total: Math.round((os.totalmem() / 1e9) * 10) / 10,
    free: Math.round((os.freemem() / 1e9) * 10) / 10,
  };
}

function diskFreeGb(drive = "C"): number | null {
  try {
    const out = execFileSync("powershell", [
      "-NoProfile", "-NonInteractive", "-Command",
      `[math]::Round(([System.IO.DriveInfo]::new('${drive}:\\').AvailableFreeSpace/1GB),1)`,
    ], { timeout: 15000, encoding: "utf8" });
    const v = Number(out.trim());
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function isOnBattery(): boolean {
  try {
    const out = execFileSync("powershell", [
      "-NoProfile", "-NonInteractive", "-Command",
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus.ToString()",
    ], { timeout: 15000, encoding: "utf8" });
    return out.trim().toLowerCase() === "offline";
  } catch {
    return false;
  }
}

let cachedHardware: HardwareInfo | null = null;

export async function detectHardware(force = false): Promise<HardwareInfo> {
  if (cachedHardware && !force) return cachedHardware;
  const gpu = await readGpuSnapshot();
  const mem = systemMemoryGb();
  const vram = gpu.vramTotalMb ?? 0;

  let profile: HardwareProfile;
  if (gpu.name && /nvidia/i.test(gpu.name)) {
    profile = vram > 0 && vram <= 4608 ? "LAPTOP_LOW_VRAM_NVIDIA" : "NVIDIA_GPU";
  } else if (!gpu.name) {
    profile = "CPU_ONLY";
  } else {
    profile = "UNKNOWN";
  }

  cachedHardware = {
    profile,
    cpu: cpuName(),
    ramTotalGb: mem.total,
    ramFreeGb: mem.free,
    diskFreeGb: diskFreeGb(),
    gpu,
    isBattery: isOnBattery(),
  };
  return cachedHardware;
}

export type TtsPreset = "ECO" | "BALANCED" | "MAX_QUALITY";

export interface LaptopTtsConfig {
  preset: TtsPreset;
  devicePriority: "AUTO" | "GPU" | "CPU";
  concurrency: number;
  keepModelResident: boolean;
  chunkTargetMin: number;
  chunkTargetMax: number;
  minFreeDiskGb: number;
}

export function configForProfile(hw: HardwareInfo, preset: TtsPreset = "BALANCED"): LaptopTtsConfig {
  const base: LaptopTtsConfig = {
    preset,
    devicePriority: "AUTO",
    concurrency: 1,
    keepModelResident: preset !== "ECO",
    chunkTargetMin: preset === "ECO" ? 80 : 120,
    chunkTargetMax: preset === "MAX_QUALITY" ? 260 : 220,
    minFreeDiskGb: 15,
  };
  if (hw.profile === "LAPTOP_LOW_VRAM_NVIDIA") {
    base.concurrency = 1;
  }
  return base;
}

export function ttsStateDir(repoRoot: string): string {
  return path.join(repoRoot, "data", "tts");
}
