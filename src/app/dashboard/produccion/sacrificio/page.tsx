import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/produccion?tab=carne");
}
