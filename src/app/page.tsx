import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_VALUE } from "@/lib/session";

export default async function Home() {
  const jar = await cookies();
  redirect(jar.get(SESSION_COOKIE)?.value === SESSION_VALUE ? "/panel" : "/ingresar");
}
