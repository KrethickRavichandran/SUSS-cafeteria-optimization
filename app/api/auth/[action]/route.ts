import { env } from "cloudflare:workers";
import { handleAuth } from "../../../../lib/auth-service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
type AuthEnvironment = { DB: D1Database; GOOGLE_CLIENT_ID?: string };
async function route(request: Request, context: Context) {
  const { action } = await context.params;
  const runtime = env as unknown as AuthEnvironment;
  return handleAuth(request,action,runtime.DB,runtime.GOOGLE_CLIENT_ID || "");
}
export const GET = route;
export const POST = route;
