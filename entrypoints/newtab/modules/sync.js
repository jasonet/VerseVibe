import {
  generateSyncKey,
  extractSlimmedState,
  encryptSyncPayload,
  decryptSyncPayload,
} from "./syncCrypto.js";
import {
  getYddStorageEntries,
  validateYddStorageEntries,
} from "../core/storageKeys.js";
import { state } from "../core/state.js";

const DEFAULT_SERVER_URL = "https://api.hkez.com";
const STORAGE_SYNC_ENABLED = "ydd_sync_enabled";
const STORAGE_SERVER_URL = "ydd_sync_server_url";
const STORAGE_SYNC_KEY = "ydd_sync_key";
const STORAGE_SYNC_REV = "ydd_sync_rev";
const STORAGE_LAST_SYNCED = "ydd_sync_last_synced";

export class SyncClient {
  constructor(options = {}) {
    this.storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    this.debounceTimer = null;
    this.isSyncing = false;
    this.onStatusChange = options.onStatusChange || null;
  }

  isEnabled() {
    return this.storage?.getItem(STORAGE_SYNC_ENABLED) === "true";
  }

  getServerUrl() {
    return this.storage?.getItem(STORAGE_SERVER_URL) || DEFAULT_SERVER_URL;
  }

  getSyncKey() {
    return this.storage?.getItem(STORAGE_SYNC_KEY) || "";
  }

  getRevision() {
    return Number(this.storage?.getItem(STORAGE_SYNC_REV) || 0);
  }

  getLastSyncedAt() {
    return this.storage?.getItem(STORAGE_LAST_SYNCED) || "";
  }

  enable(serverUrl, syncKey) {
    if (!this.storage) return;
    this.storage.setItem(STORAGE_SYNC_ENABLED, "true");
    this.storage.setItem(STORAGE_SERVER_URL, serverUrl.replace(/\/+$/, ""));
    this.storage.setItem(STORAGE_SYNC_KEY, syncKey);
    this._notifyStatus();
  }

  disable() {
    if (!this.storage) return;
    this.storage.setItem(STORAGE_SYNC_ENABLED, "false");
    this._notifyStatus();
  }

  _notifyStatus(status = {}) {
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange({
        enabled: this.isEnabled(),
        serverUrl: this.getServerUrl(),
        syncKey: this.getSyncKey(),
        rev: this.getRevision(),
        lastSynced: this.getLastSyncedAt(),
        ...status,
      });
    }
  }

  async pullAndApply() {
    if (!this.isEnabled() || this.isSyncing) return false;
    const serverUrl = this.getServerUrl();
    const syncKey = this.getSyncKey();
    if (!syncKey) return false;

    this.isSyncing = true;
    try {
      const res = await fetch(`${serverUrl}/api/v1/sync`, {
        headers: {
          Authorization: `Bearer ${syncKey}`,
          "If-None-Match": String(this.getRevision()),
        },
      });

      if (res.status === 304) {
        return true;
      }

      if (!res.ok) {
        throw new Error(`Sync pull failed with status ${res.status}`);
      }

      const body = await res.json();
      if (!body?.data || typeof body.rev !== "number") return false;

      if (body.rev > this.getRevision()) {
        const decrypted = await decryptSyncPayload(body.data, syncKey);
        const validated = validateYddStorageEntries(decrypted);

        for (const [key, value] of Object.entries(validated)) {
          if (typeof this.storage?.setItem === "function") {
            this.storage.setItem(key, value);
          }
        }

        this.storage?.setItem(STORAGE_SYNC_REV, String(body.rev));
        this.storage?.setItem(
          STORAGE_LAST_SYNCED,
          body.updatedAt || new Date().toISOString(),
        );
        this._notifyStatus({ status: "success" });
        return true;
      }
    } catch (err) {
      console.warn("[YDD Sync] Pull failed:", err);
      this._notifyStatus({ status: "error", error: err.message });
      return false;
    } finally {
      this.isSyncing = false;
    }
    return false;
  }

  async pushCurrentState() {
    if (!this.isEnabled() || this.isSyncing) return false;
    const serverUrl = this.getServerUrl();
    const syncKey = this.getSyncKey();
    if (!syncKey) return false;

    this.isSyncing = true;
    try {
      const nextRev = this.getRevision() + 1;
      const slimmed = extractSlimmedState(() => getYddStorageEntries());
      const encrypted = await encryptSyncPayload(slimmed, syncKey);

      const res = await fetch(`${serverUrl}/api/v1/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncKey}`,
          "X-Sync-Rev": String(nextRev),
        },
        body: JSON.stringify({
          rev: nextRev,
          updatedAt: new Date().toISOString(),
          data: encrypted,
        }),
      });

      if (!res.ok) {
        throw new Error(`Sync push failed with status ${res.status}`);
      }

      const body = await res.json();
      this.storage?.setItem(STORAGE_SYNC_REV, String(body.rev));
      this.storage?.setItem(
        STORAGE_LAST_SYNCED,
        body.updatedAt || new Date().toISOString(),
      );
      this._notifyStatus({ status: "success" });
      return true;
    } catch (err) {
      console.warn("[YDD Sync] Push failed:", err);
      this._notifyStatus({ status: "error", error: err.message });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  scheduleDebouncedPush(delayMs = 3000) {
    if (!this.isEnabled()) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.pushCurrentState();
    }, delayMs);
  }

  async fetchContentPack(packName) {
    const serverUrl = this.getServerUrl();
    try {
      const res = await fetch(`${serverUrl}/api/v1/content/${packName}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn(`[YDD Sync] Content pack ${packName} fetch failed:`, err);
      return null;
    }
  }
}
