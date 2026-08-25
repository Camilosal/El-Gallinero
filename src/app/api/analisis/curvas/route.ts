import { NextRequest, NextResponse } from "next/server";
import { breedCurves } from "@/lib/breedCurves";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const breed = searchParams.get("breed");

  if (!breed) {
    return NextResponse.json(
      { error: "breed parameter is required" },
      { status: 400 }
    );
  }

  const curve = breedCurves[breed];

  if (!curve) {
    return NextResponse.json(
      { error: `Breed ${breed} not found` },
      { status: 404 }
    );
  }

  return NextResponse.json(curve);
});
