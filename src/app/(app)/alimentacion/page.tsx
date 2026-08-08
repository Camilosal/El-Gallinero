import { redirect } from "next/navigation";

export default function Page() {
  redirect("/produccion?tab=alimentacion");
}
