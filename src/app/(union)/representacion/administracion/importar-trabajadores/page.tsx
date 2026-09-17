import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ImportarTrabajadoresRedirect(): never {
  redirect("/representacion/administracion/actualizar-base");
}
