import { notFound, permanentRedirect } from "next/navigation";
import { getCyclePlanBySlug } from "@/lib/landing-showcase";

export default async function LegacyPlanRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getCyclePlanBySlug(slug)) notFound();
  permanentRedirect("/planes#calculadora");
}
