/**
 * The browser half of a passkey ceremony.
 *
 * Supabase Auth hands out WebAuthn options as JSON (binary fields base64url
 * encoded) and expects the browser's answer back as JSON. The browser API works
 * in ArrayBuffers. Newer browsers convert both ways natively
 * (PublicKeyCredential.parse*OptionsFromJSON, credential.toJSON()); this file
 * uses those when present and does the same conversion by hand otherwise, so
 * Safari and Firefox versions without them still work.
 *
 * auth-js has equivalent helpers, but they are not exported from the package.
 * Everything here is pure apart from the two `navigator.credentials` calls, so
 * the conversions are unit tested.
 */

type Json = Record<string, unknown>;

/** base64url (no padding) → bytes. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** bytes → base64url (no padding). */
export function bytesToBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function descriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.map((item: Json) => ({
    ...(item as object),
    type: "public-key",
    id: base64UrlToBytes(String(item.id)),
  })) as PublicKeyCredentialDescriptor[];
}

/** Registration options from Supabase → what navigator.credentials.create() takes. */
export function toCreationOptions(json: Json): PublicKeyCredentialCreationOptions {
  const user = (json.user ?? {}) as Json;
  return {
    ...(json as object),
    challenge: base64UrlToBytes(String(json.challenge)),
    user: { ...(user as object), id: base64UrlToBytes(String(user.id)) },
    excludeCredentials: descriptors(json.excludeCredentials),
  } as unknown as PublicKeyCredentialCreationOptions;
}

/** Sign-in options from Supabase → what navigator.credentials.get() takes. */
export function toRequestOptions(json: Json): PublicKeyCredentialRequestOptions {
  return {
    ...(json as object),
    challenge: base64UrlToBytes(String(json.challenge)),
    allowCredentials: descriptors(json.allowCredentials),
  } as unknown as PublicKeyCredentialRequestOptions;
}

type CredentialLike = {
  id: string;
  rawId: ArrayBuffer;
  type: string;
  authenticatorAttachment?: string | null;
  response: Record<string, unknown>;
  getClientExtensionResults?: () => unknown;
};

/** The browser's answer to create() or get() → the JSON Supabase verifies. */
export function credentialToJson(credential: CredentialLike): Json {
  const response = credential.response;
  const out: Json = {};
  for (const key of ["clientDataJSON", "attestationObject", "authenticatorData", "signature", "userHandle"]) {
    const value = response[key];
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) out[key] = bytesToBase64Url(value as ArrayBuffer);
  }
  const transports = typeof response.getTransports === "function" ? (response.getTransports as () => string[])() : undefined;
  if (transports) out.transports = transports;
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    response: out,
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

type NativeJson = {
  parseCreationOptionsFromJSON?: (json: Json) => PublicKeyCredentialCreationOptions;
  parseRequestOptionsFromJSON?: (json: Json) => PublicKeyCredentialRequestOptions;
};

/** True when this browser can use passkeys at all. */
export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && Boolean(navigator.credentials);
}

/** Run the browser's "create a passkey" prompt and return Supabase's JSON. */
export async function createPasskeyCredential(options: Json, signal?: AbortSignal): Promise<Json> {
  const native = window.PublicKeyCredential as unknown as NativeJson;
  const publicKey = native.parseCreationOptionsFromJSON ? native.parseCreationOptionsFromJSON(options) : toCreationOptions(options);
  const credential = (await navigator.credentials.create({ publicKey, signal })) as (CredentialLike & { toJSON?: () => Json }) | null;
  if (!credential) throw new DOMException("No passkey was created.", "NotAllowedError");
  return typeof credential.toJSON === "function" ? credential.toJSON() : credentialToJson(credential);
}

/** Run the browser's "use a passkey" prompt and return Supabase's JSON. */
export async function getPasskeyCredential(options: Json, signal?: AbortSignal): Promise<Json> {
  const native = window.PublicKeyCredential as unknown as NativeJson;
  const publicKey = native.parseRequestOptionsFromJSON ? native.parseRequestOptionsFromJSON(options) : toRequestOptions(options);
  const credential = (await navigator.credentials.get({ publicKey, signal })) as (CredentialLike & { toJSON?: () => Json }) | null;
  if (!credential) throw new DOMException("No passkey was chosen.", "NotAllowedError");
  return typeof credential.toJSON === "function" ? credential.toJSON() : credentialToJson(credential);
}

/**
 * A browser-side failure as a sentence for the member.
 *
 * Signing in: NotAllowedError is what every browser throws when the prompt is
 * dismissed or times out, so it is treated as "cancelled" and says nothing.
 *
 * Adding: a device that already holds a passkey for the account refuses to make
 * another (excludeCredentials). Chrome reports that as InvalidStateError, but
 * Windows Hello and some password managers report it as NotAllowedError, the
 * same as a dismissed prompt. Saying nothing there made it look as if a second
 * passkey had been added, so adding always explains what happened.
 */
export function passkeyErrorMessage(error: unknown, action: "sign in" | "add"): string | null {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (action === "add" && name === "NotAllowedError") {
    return "No passkey was created. If this device already has one for your account, it can't add a second: use another device or password manager.";
  }
  if (name === "NotAllowedError" || name === "AbortError") return null;
  if (name === "InvalidStateError") {
    return "This device already has a passkey for your account. To add another, use a different device or password manager.";
  }
  if (name === "SecurityError") return "Passkeys can't be used on this address. Open the site at its usual address and try again.";
  return action === "add" ? "The passkey couldn't be created on this device." : "The passkey couldn't be used on this device.";
}
