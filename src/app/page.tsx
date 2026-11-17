import { redirect } from "next/navigation";
import { getPanelUser } from "@/server/panel-auth";

export default async function Home() {
  const user = await getPanelUser();
  redirect(user ? "/panel" : "/ingresar");
}