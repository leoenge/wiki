import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "./env.js";
import { HttpError } from "./http.js";

const jwks = createRemoteJWKSet(
  new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

export function parseBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

export async function verifySupabaseToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      audience: "authenticated",
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new HttpError(401, "Invalid token");
    }
    return payload.sub;
  } catch {
    throw new HttpError(401, "Invalid token");
  }
}
