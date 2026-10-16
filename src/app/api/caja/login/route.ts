import { NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { requireCajaAccess } from "@/lib/caja/auth-guard"
import { CajaClient } from "@/lib/caja/client"
import { getCajaSession, setCajaSession } from "@/lib/caja/session"

export async function POST(req: Request) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  // Solo accesible si la caja está abierta o el usuario es admin
  const authCheck = await requireCajaAccess(auth.user)
  if (authCheck.response) return authCheck.response

  try {
    const body = (await req.json()) as { matricula?: string; password?: string }
    const matricula = body.matricula?.trim()
    const password = body.password

    if (!matricula || !password) {
      return NextResponse.json(
        { error: "Matrícula y contraseña son requeridas", code: "validation_error" },
        { status: 400 },
      )
    }

    const client = new CajaClient()

    // 1. Validar existencia de matrícula
    try {
      await client.validateMatricula(matricula)
    } catch (valErr: unknown) {
      const err = valErr as { httpStatus?: number; code?: string; message?: string }
      if (err.httpStatus === 404 || err.code === "1040") {
        return NextResponse.json(
          { error: "Matrícula no encontrada en Caja de Ahorro. Verifique sus datos.", code: "1040" },
          { status: 404 },
        )
      }
    }

    // 2. Realizar autenticación (con auto-recovery réplica de Contrasenia$f.smali:292)
    let loginRes
    try {
      loginRes = await client.login({ matricula, password })
    } catch (firstErr: unknown) {
      const e = firstErr as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
      const msg = e.apiMessage || e.message || ""
      const isAct = /sesi[oó]n.*activa/i.test(msg)

      if (isAct) {
        // Si teníamos sesión previa en cookie, intentar logout en servidor y reintentar
        const prevSession = await getCajaSession()
        if (prevSession?.authToken) {
          try {
            const recoveryClient = new CajaClient({ getToken: () => prevSession.authToken })
            await recoveryClient.logoutServer(matricula)
            await new Promise((r) => setTimeout(r, 2000))
            loginRes = await client.login({ matricula, password })
          } catch {
            throw firstErr
          }
        } else {
          throw firstErr
        }
      } else {
        throw firstErr
      }
    }

    const payload = loginRes.payload

    if (!payload?.authToken) {
      return NextResponse.json(
        { error: "No se recibió token de autenticación del API de Caja", code: "auth_failed" },
        { status: 502 },
      )
    }

    const authToken = payload.authToken

    // sessionTime devuelto por Caja SNTSS viene en HORAS (ej. 3 = 3 horas).
    // Si viene <= 24, convertir a segundos (horas * 3600). Si viene > 24, usar directamente o minutos.
    let sessionSeconds = 3600 * 8 // 8 horas por defecto
    if (typeof payload.sessionTime === "number" && payload.sessionTime > 0) {
      if (payload.sessionTime <= 24) {
        sessionSeconds = payload.sessionTime * 3600
      } else if (payload.sessionTime <= 1440) {
        sessionSeconds = payload.sessionTime * 60
      } else {
        sessionSeconds = payload.sessionTime
      }
    }

    // 3. Obtener perfil de cuenta con el token obtenido
    const authClient = new CajaClient({ getToken: () => authToken })
    let profile = null
    try {
      const accRes = await authClient.getAccount(matricula)
      profile = accRes.payload ?? null
    } catch {
      // Perfil no bloqueante
      profile = null
    }

    const fullName = profile
      ? [profile.nombre, profile.paterno, profile.materno].filter(Boolean).join(" ")
      : undefined

    // 4. Guardar en cookie HTTP-Only cifrada (prohibido localStorage plano)
    await setCajaSession(
      {
        authToken,
        accountId: matricula,
        matricula,
        nombre: fullName,
      },
      sessionSeconds,
    )

    return NextResponse.json({
      ok: true,
      matricula,
      nombre: fullName,
      sessionTime: sessionSeconds,
      profile,
    })
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
    const status = e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500
    const message = e.apiMessage || e.message || "Error al autenticar con Caja SNTSS"

    const isSessionActive =
      /sesi[oó]n.*activa/i.test(message) ||
      (e.code === "1040" && /sesi[oó]n/i.test(message)) ||
      e.code === "1041"

    return NextResponse.json(
      {
        error: message,
        code: e.code || "1040",
        isSessionActive: Boolean(isSessionActive),
      },
      { status },
    )
  }
}
