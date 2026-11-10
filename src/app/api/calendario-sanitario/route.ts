// Legacy API path kept for compatibility. Business logic lives in the canonical
// /api/sanidad/calendario route so both entry points share validation and delete semantics.
import { NextRequest } from "next/server";
import {
  GET as canonicalGet,
  POST as canonicalPost,
  PUT as canonicalPut,
  DELETE as canonicalDelete,
} from "../sanidad/calendario/route";

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest) => canonicalGet(req);
export const POST = (req: NextRequest) => canonicalPost(req);
export const PUT = (req: NextRequest) => canonicalPut(req);
export const DELETE = (req: NextRequest) => canonicalDelete(req);
