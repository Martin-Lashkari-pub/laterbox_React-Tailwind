export const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const defaultTimePlus = (mins = 2) => {
  const d = new Date(Date.now() + mins * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const normalizeUrl = (u) =>
  /^(https?|chrome|edge|brave|file):\/\//i.test(u) ? u : `https://${u}`;

export function isValidUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  try {
    const u = new URL(normalizeUrl(trimmed));
    if (["chrome:", "edge:", "brave:", "file:"].includes(u.protocol))
      return Boolean(u.hostname || u.pathname);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (
      u.hostname === "localhost" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)
    )
      return true;
    const parts = u.hostname.split(".");
    return (
      parts.length >= 2 &&
      parts[parts.length - 1].length >= 2 &&
      parts.every((p) => p.length > 0)
    );
  } catch {
    return false;
  }
}

export const formatDomain = (u) =>
  (u || "")
    .split("?")[0]
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

export const formatReminderTime = (ts) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
};

export function getYouTubeThumb(url) {
  try {
    const u = new URL(url);
    const id = u.hostname.includes("youtu.be")
      ? u.pathname.slice(1).split("/")[0]
      : u.hostname.includes("youtube.com")
        ? u.searchParams.get("v") ||
          (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null)
        : null;
    return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
  } catch {
    return null;
  }
}

export function getFavicon(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}

export function getNextOccurrence(repeat, afterTs = Date.now()) {
  if (!repeat || repeat.type === "none") return null;
  const [hh, mm] = (repeat.time || "09:00").split(":").map(Number);
  const base = new Date(afterTs);

  for (let offset = 0; offset <= 400; offset++) {
    const c = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offset,
      hh,
      mm,
      0,
      0,
    );
    if (c.getTime() <= afterTs) continue;
    if (
      repeat.type === "weekly" &&
      (repeat.daysOfWeek || []).includes(c.getDay())
    )
      return c.getTime();
    if (repeat.type === "monthly") {
      const daysInMonth = new Date(
        c.getFullYear(),
        c.getMonth() + 1,
        0,
      ).getDate();
      if (repeat.lastDayOfMonth && c.getDate() === daysInMonth)
        return c.getTime();
      if (
        (repeat.daysOfMonth || []).some(
          (d) => Math.min(d, daysInMonth) === c.getDate(),
        )
      )
        return c.getTime();
    }
  }
  return null;
}

export function formatRepeatLabel(repeat) {
  if (!repeat || repeat.type === "none") return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (repeat.type === "weekly") {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const sorted = [...(repeat.daysOfWeek || [])].sort(
      (a, b) => order.indexOf(a) - order.indexOf(b),
    );
    if (sorted.length === 5 && !sorted.includes(0) && !sorted.includes(6))
      return `Weekdays · ${repeat.time}`;
    return `Every ${sorted.map((d) => days[d]).join(", ")} · ${repeat.time}`;
  }
  if (repeat.type === "monthly") {
    const list = [...(repeat.daysOfMonth || [])]
      .sort((a, b) => a - b)
      .map((d) => `${d}.`);
    if (repeat.lastDayOfMonth) list.push("Last day");
    return `Monthly (${list.join(", ")}) · ${repeat.time}`;
  }
  return "";
}

export function occursOnDate(item, dateKey) {
  if (item.reminderDate === dateKey && !item.dismissed) return true;
  if (!item.repeat || item.repeat.type === "none") return false;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (item.repeat.type === "weekly")
    return (item.repeat.daysOfWeek || []).includes(dt.getDay());
  if (item.repeat.type === "monthly") {
    const max = new Date(y, m, 0).getDate();
    return (
      (item.repeat.lastDayOfMonth && d === max) ||
      (item.repeat.daysOfMonth || []).some((t) => Math.min(t, max) === d)
    );
  }
  return false;
}

let audioCtx = null;
export function playTone(sound = "chime", repeatCount = 1) {
  if (sound === "mute") return;
  const playOnce = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && Ctx) audioCtx = new Ctx();
      if (audioCtx?.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = sound === "bell" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(
        sound === "bell" ? 659 : sound === "pulse" ? 523 : 880,
        now,
      );
      if (sound === "chime") osc.frequency.setValueAtTime(1175, now + 0.12);
      if (sound === "pulse") osc.frequency.setValueAtTime(1046, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + (sound === "bell" ? 0.8 : 0.4),
      );
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + (sound === "bell" ? 0.8 : 0.4));
    } catch {}
  };
  for (let i = 0; i < repeatCount; i++) setTimeout(playOnce, i * 550);
}

/* ============================================================================
   WEB CRYPTO API PRIVATE SPACE ENGINE (PBKDF2-SHA256 + AES-256-GCM)
   ============================================================================ */

const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const PBKDF2_ITERATIONS = 210000;

export const vaultCrypto = {
  async createLock(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"],
    );

    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      keyMaterial,
      512,
    );

    const aesRaw = bits.slice(0, 32);
    const verifierRaw = bits.slice(32, 64);

    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesRaw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    return {
      lockMeta: {
        salt: bufToB64(salt),
        verifier: bufToB64(verifierRaw),
        iterations: PBKDF2_ITERATIONS,
      },
      aesKey,
    };
  },

  async unlock(password, lockMeta) {
    const salt = b64ToBuf(lockMeta.salt);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: lockMeta.iterations || PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      512,
    );

    const aesRaw = bits.slice(0, 32);
    const verifierCandidate = new Uint8Array(bits.slice(32, 64));
    const storedVerifier = b64ToBuf(lockMeta.verifier);

    if (verifierCandidate.length !== storedVerifier.length) return null;
    let diff = 0;
    for (let i = 0; i < storedVerifier.length; i++) {
      diff |= verifierCandidate[i] ^ storedVerifier[i];
    }
    if (diff !== 0) return null;

    return crypto.subtle.importKey(
      "raw",
      aesRaw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  },

  async encryptPayload(aesKey, payloadObj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(payloadObj));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoded,
    );
    return {
      iv: bufToB64(iv),
      data: bufToB64(cipherBuf),
    };
  },

  async decryptPayload(aesKey, cipherObj) {
    const iv = b64ToBuf(cipherObj.iv);
    const data = b64ToBuf(cipherObj.data);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      data,
    );
    return JSON.parse(new TextDecoder().decode(plainBuf));
  },
};

export function sanitizeItems(rawList) {
  if (!Array.isArray(rawList)) return [];
  const valid = rawList.filter(
    (item) => item && typeof item === "object" && item.id && item.type,
  );
  const folderIds = new Set(
    valid.filter((i) => i.type === "folder").map((i) => i.id),
  );

  return valid.map((item) => ({
    ...item,
    parentId:
      item.parentId && folderIds.has(item.parentId) ? item.parentId : null,
  }));
}

export const storage = {
  async load() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const data = await chrome.storage.local.get([
        "laterBoxItems",
        "laterBoxBackup",
        "laterBoxPrefs",
        "laterBoxDraft",
        "tabVaultPrivateMeta",
      ]);
      const primary = sanitizeItems(data.laterBoxItems);
      const backup = sanitizeItems(data.laterBoxBackup);

      let resolvedItems = primary;
      if (primary.length === 0 && backup.length > 0) {
        resolvedItems = backup;
        await chrome.storage.local.set({ laterBoxItems: backup });
      } else {
        const primaryFolders = primary.filter(
          (i) => i.type === "folder",
        ).length;
        const backupFolders = backup.filter((i) => i.type === "folder").length;
        if (primaryFolders === 0 && backupFolders > 0) {
          const existingIds = new Set(primary.map((i) => i.id));
          const recoveredFolders = backup.filter(
            (i) => i.type === "folder" && !existingIds.has(i.id),
          );
          resolvedItems = sanitizeItems([...recoveredFolders, ...primary]);
          await chrome.storage.local.set({
            laterBoxItems: resolvedItems,
            laterBoxBackup: resolvedItems,
          });
        }
      }

      return {
        laterBoxItems: resolvedItems,
        laterBoxPrefs: data.laterBoxPrefs || null,
        laterBoxDraft: data.laterBoxDraft || null,
        tabVaultPrivateMeta: data.tabVaultPrivateMeta || null,
      };
    }

    return {
      laterBoxItems: sanitizeItems(
        JSON.parse(localStorage.getItem("laterBoxItems") || "[]"),
      ),
      laterBoxPrefs: JSON.parse(
        localStorage.getItem("laterBoxPrefs") || "null",
      ),
      laterBoxDraft: JSON.parse(
        localStorage.getItem("laterBoxDraft") || "null",
      ),
      tabVaultPrivateMeta: JSON.parse(
        localStorage.getItem("tabVaultPrivateMeta") || "null",
      ),
    };
  },

  async saveItems(items, allowEmpty = false) {
    const clean = sanitizeItems(items);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      if (clean.length === 0 && !allowEmpty) {
        const existing = await chrome.storage.local.get(["laterBoxItems"]);
        if (
          Array.isArray(existing.laterBoxItems) &&
          existing.laterBoxItems.length > 0
        ) {
          return;
        }
      }
      await chrome.storage.local.set({
        laterBoxItems: clean,
        laterBoxBackup: clean,
      });
    } else {
      localStorage.setItem("laterBoxItems", JSON.stringify(clean));
      localStorage.setItem("laterBoxBackup", JSON.stringify(clean));
    }
  },

  async savePrivateMeta(meta) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      if (meta) await chrome.storage.local.set({ tabVaultPrivateMeta: meta });
      else await chrome.storage.local.remove("tabVaultPrivateMeta");
    } else {
      if (meta)
        localStorage.setItem("tabVaultPrivateMeta", JSON.stringify(meta));
      else localStorage.removeItem("tabVaultPrivateMeta");
    }
  },

  async savePrefs(prefs) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ laterBoxPrefs: prefs });
    } else {
      localStorage.setItem("laterBoxPrefs", JSON.stringify(prefs));
    }
  },

  async saveDraft(draft) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ laterBoxDraft: draft });
    } else {
      localStorage.setItem("laterBoxDraft", JSON.stringify(draft));
    }
  },

  async clearDraft() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.remove("laterBoxDraft");
    } else {
      localStorage.removeItem("laterBoxDraft");
    }
  },
};
