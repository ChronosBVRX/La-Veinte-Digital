#!/usr/bin/env node
/**
 * Puente cifrado para mover archivos gitignored (secretos) entre equipos vía git.
 * Cifra con AES-256-GCM + PBKDF2 (600k iteraciones, sal aleatoria). Sin dependencias.
 *
 * Uso:
 *   BRIDGE_PASSWORD='...' node scripts/env-bridge.mjs encrypt
 *   BRIDGE_PASSWORD='...' node scripts/env-bridge.mjs decrypt
 *
 * Si BRIDGE_PASSWORD no está definida, la pide de forma oculta.
 * decrypt rehúsa sobrescribir archivos existentes salvo BRIDGE_FORCE=1.
 */
import {
  pbkdf2Sync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"

const BUNDLE_DIR = join(process.cwd(), "env-bridge")
const BUNDLE_PATH = join(BUNDLE_DIR, "secrets.enc")
const FILES = [".env.local", "bot-api/.env"]
const ITERATIONS = 600_000
const AAD = Buffer.from("lvd-env-bridge-v1")

function hiddenPrompt(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const { stdin } = process
    if (!stdin.isTTY) {
      console.error(
        "\nError: BRIDGE_PASSWORD no definida y no hay terminal interactiva."
      )
      process.exit(2)
    }
    stdin.setRawMode(true)
    stdin.resume()
    let buf = ""
    const onData = (chunk) => {
      const ch = chunk.toString()
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.off("data", onData)
        process.stdout.write("\n")
        resolve(buf)
      } else if (ch === "\u0003" || ch === "\u0004") {
        stdin.setRawMode(false)
        stdin.pause()
        process.exit(130)
      } else {
        buf += ch
      }
    }
    stdin.on("data", onData)
  })
}

async function getPassword() {
  if (process.env.BRIDGE_PASSWORD) return process.env.BRIDGE_PASSWORD
  const p1 = await hiddenPrompt("Contraseña del puente: ")
  const p2 = await hiddenPrompt("Repite la contraseña: ")
  if (p1 !== p2) {
    console.error("Las contraseñas no coinciden.")
    process.exit(2)
  }
  return p1
}

function deriveKey(password, salt) {
  return pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256")
}

async function encrypt() {
  const missing = FILES.filter((f) => !existsSync(join(process.cwd(), f)))
  if (missing.length > 0) {
    console.error(`Faltan archivos por cifrar: ${missing.join(", ")}`)
    process.exit(2)
  }
  const password = await getPassword()
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(password, salt)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(AAD)
  const bundle = JSON.stringify({
    v: 1,
    files: Object.fromEntries(
      FILES.map((f) => [
        f,
        readFileSync(join(process.cwd(), f), "utf8"),
      ])
    ),
  })
  const data = Buffer.concat([cipher.update(bundle, "utf8"), cipher.final()])
  mkdirSync(BUNDLE_DIR, { recursive: true })
  writeFileSync(
    BUNDLE_PATH,
    JSON.stringify(
      {
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      },
      null,
      2
    )
  )
  console.log(`Cifrado OK -> ${BUNDLE_PATH} (${FILES.length} archivos)`)
}

async function decrypt() {
  if (!existsSync(BUNDLE_PATH)) {
    console.error(`No existe ${BUNDLE_PATH}. ¿Falta git pull?`)
    process.exit(2)
  }
  const password = await getPassword()
  const payload = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"))
  const key = deriveKey(password, Buffer.from(payload.salt, "base64"))
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  )
  decipher.setAAD(AAD)
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"))
  let bundle
  try {
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payload.data, "base64")),
      decipher.final(),
    ])
    bundle = JSON.parse(plain.toString("utf8"))
  } catch {
    console.error("Contraseña incorrecta o archivo dañado.")
    process.exit(2)
  }
  const targetBase = process.env.BRIDGE_TARGET_DIR || process.cwd()
  for (const [rel, content] of Object.entries(bundle.files)) {
    const target = join(targetBase, rel)
    if (existsSync(target) && process.env.BRIDGE_FORCE !== "1") {
      console.error(
        `${rel} ya existe. No se sobrescribe (usa BRIDGE_FORCE=1 si quieres reemplazarlo).`
      )
      process.exit(2)
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content, "utf8")
    console.log(`Restaurado ${rel}`)
  }
  console.log("Desencriptado OK.")
}

const cmd = process.argv[2]
if (cmd === "encrypt") await encrypt()
else if (cmd === "decrypt") await decrypt()
else {
  console.error("Uso: node scripts/env-bridge.mjs encrypt|decrypt")
  process.exit(2)
}
