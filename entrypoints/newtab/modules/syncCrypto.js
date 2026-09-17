const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = "SHA-256";

export const SLIM_SYNC_WHITELIST = new Set([
  "userShortcuts",
  "customAiTools",
  "customSocialLinks",
  "customApps",
  "customSearchEngines",
  "googleAppOverrides",
  "hiddenApps",
  "hiddenTools",
  "aiToolsOrder",
  "googleAppsOrder",
  "socialToolsOrder",
  "todos",
  "defaultTasksPinned",
  "completedDefaultTaskIds",
  "userName",
  "fontFamily",
  "clockFormat",
  "clockType",
  "tempUnit",
  "widgetControl",
  "shortcutsPosition",
  "shortcutsDisplayMode",
  "glowEffect",
  "disableAnimations",
  "showTodo",
  "showApps",
  "showAiTools",
  "showDate",
  "showEditableText",
  "showShortcuts",
  "userSavedThemes",
  "normalThemeId",
  "gradientModeActive",
  "gradientThemeId",
  "keyMap",
]);

export function generateSyncKey() {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extractSlimmedState(getEntriesFn) {
  const all = getEntriesFn() || {};
  const slimmed = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("custom---") || SLIM_SYNC_WHITELIST.has(key)) {
      slimmed[key] = value;
    }
  }
  return slimmed;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptSyncPayload(payloadObject, syncKey) {
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(payloadObject));

  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveKey(syncKey, salt);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );

  return JSON.stringify({
    v: 1,
    s: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    d: bufferToBase64(ciphertext),
  });
}

export async function decryptSyncPayload(envelopeString, syncKey) {
  const parsed = JSON.parse(envelopeString);
  if (!parsed || parsed.v !== 1 || !parsed.s || !parsed.iv || !parsed.d) {
    throw new Error("Invalid encrypted payload envelope");
  }

  const salt = new Uint8Array(base64ToBuffer(parsed.s));
  const iv = new Uint8Array(base64ToBuffer(parsed.iv));
  const ciphertext = base64ToBuffer(parsed.d);

  const key = await deriveKey(syncKey, salt);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
}
