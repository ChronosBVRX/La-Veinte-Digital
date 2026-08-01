/**
 * Huella SHA-256 de archivos, calculada en el cliente con Web Crypto.
 * El servidor solo recibe la huella, nunca el archivo.
 */
export async function computeFileSha256(file: Blob | ArrayBuffer): Promise<string> {
  const data = file instanceof Blob ? await file.arrayBuffer() : file
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}
