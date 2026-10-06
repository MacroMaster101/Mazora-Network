import { z } from "zod";

const encodedBytes = z.string().min(1).max(20_000).regex(/^[A-Za-z0-9_-]+={0,2}$/);

/**
 * Accept one spelling of every credential/response field. Supabase's Go JSON
 * decoder accepts case variants; forwarding extras could make its signed bytes
 * differ from the authenticatorData whose UV flag the application reads.
 */
export const passkeyAssertionSchema = z.object({
  id: encodedBytes,
  rawId: encodedBytes,
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).nullish().transform((value) => value ?? undefined),
  clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
  response: z.object({
    clientDataJSON: encodedBytes,
    authenticatorData: encodedBytes,
    signature: encodedBytes,
    userHandle: z.string().max(20_000).regex(/^[A-Za-z0-9_-]*={0,2}$/).nullish().transform((value) => value ?? undefined),
  }).strict(),
}).strict().refine((value) => {
  try {
    return JSON.stringify(value).length <= 20_000;
  } catch {
    return false;
  }
}, "Credential too large or not JSON serializable.");
