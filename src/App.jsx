import { useEffect, useMemo, useRef, useState } from "react";
import RepeatPicker from "./RepeatPicker";
import {
  defaultTimePlus,
  formatDomain,
  formatReminderTime,
  formatRepeatLabel,
  genId,
  getFavicon,
  getNextOccurrence,
  getYouTubeThumb,
  isValidUrl,
  normalizeUrl,
  occursOnDate,
  playTone,
  sanitizeItems,
  storage,
  toDateKey,
  vaultCrypto,
} from "./utils";

const THEMES = {
  light: "bg-slate-50 text-slate-900",
  dark: "bg-slate-950 text-slate-100",
  forest: "bg-[#0b1913] text-emerald-50",
};

const CARD_BG = {
  light: "bg-white border-slate-200",
  dark: "bg-slate-900 border-slate-800",
  forest: "bg-[#11241c] border-[#234738]",
};

const SIZES = {
  compact: { w: 420, h: 500 },
  standard: { w: 460, h: 560 },
  large: { w: 520, h: 600 },
};

const resolveFontScale = (fontPref) => {
  if (typeof fontPref === "number" && fontPref >= 80 && fontPref <= 150)
    return fontPref;
  if (fontPref === "small") return 90;
  if (fontPref === "large") return 115;
  return 100;
};

const createDefaultRepeat = () => ({
  type: "none",
  date: toDateKey(new Date()),
  time: defaultTimePlus(2),
  daysOfWeek: [1],
  daysOfMonth: [new Date().getDate()],
  lastDayOfMonth: false,
});

export default function App() {
  const [items, setItems] = useState([]);
  const [prefs, setPrefs] = useState({
    theme: "light",
    size: "standard",
    font: 100,
    sound: "chime",
  });
  const [storageReady, setStorageReady] = useState(false);

  const [privateMeta, setPrivateMeta] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [decryptedMap, setDecryptedMap] = useState({});

  const [privateModal, setPrivateModal] = useState(null);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalErrorField, setModalErrorField] = useState("");
  const [modalShake, setModalShake] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);

  // Wipe-all-data modal state: null | 'confirm' | 'progress'
  const [wipeStage, setWipeStage] = useState(null);
  const [wipeProgress, setWipeProgress] = useState(0);
  const [wipePass, setWipePass] = useState("");
  const [wipeError, setWipeError] = useState("");
  const [wipeShake, setWipeShake] = useState(false);
  const [wipeVerifying, setWipeVerifying] = useState(false);

  const [view, setView] = useState("home");
  const [previousView, setPreviousView] = useState("home");
  const [folderId, setFolderId] = useState(null);
  const [detailItemId, setDetailItemId] = useState(null);
  const [search, setSearch] = useState("");
  const [folderSearch, setFolderSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState("all");
  const [toast, setToast] = useState({ msg: "", error: false });
  const [shakeForm, setShakeForm] = useState(false);
  const [dragId, setDragId] = useState(null);

  const [urlInput, setUrlInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saveTargetFolder, setSaveTargetFolder] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [pickerBrowseFolderId, setPickerBrowseFolderId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCreatingFolder, setPickerCreatingFolder] = useState(false);
  const [pickerNewFolderName, setPickerNewFolderName] = useState("");
  const [useReminder, setUseReminder] = useState(false);
  const [repeatCfg, setRepeatCfg] = useState(createDefaultRepeat);

  const [editingItemId, setEditingItemId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [editUseReminder, setEditUseReminder] = useState(false);
  const [editRepeatCfg, setEditRepeatCfg] = useState(createDefaultRepeat);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameFolderVal, setRenameFolderVal] = useState("");

  const [calMonth, setCalMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calAddOpen, setCalAddOpen] = useState(false);

  const fileImportRef = useRef(null);

  const isPrivateMode = Boolean(privateKey);

  const notify = (msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast({ msg: "", error: false }), 2800);
  };

  const triggerFormError = (msg) => {
    setShakeForm(true);
    notify(msg, true);
    setTimeout(() => setShakeForm(false), 350);
  };

  const triggerModalError = (msg, field = "both") => {
    setModalError(msg);
    setModalErrorField(field);
    setModalShake(false);
    requestAnimationFrame(() => setModalShake(true));
    setTimeout(() => setModalShake(false), 400);
  };

  const openPrivateModal = (mode) => {
    setPass1("");
    setPass2("");
    setModalError("");
    setModalErrorField("");
    setModalShake(false);
    setPrivateModal(mode);
  };

  const closePrivateModal = () => {
    setPrivateModal(null);
    setPass1("");
    setPass2("");
    setModalError("");
    setModalErrorField("");
    setModalShake(false);
  };

  const openFoldersRoot = () => {
    setFolderId(null);
    setFolderSearch("");
    setCreatingFolder(false);
    setRenamingFolderId(null);
    setView("folders");
  };

  const closeFolderPicker = () => {
    setFolderPickerOpen(false);
    setPickerSearch("");
    setPickerCreatingFolder(false);
    setPickerBrowseFolderId(null);
  };

  const selectFolderInPicker = (targetId) => {
    setSaveTargetFolder(targetId);
    closeFolderPicker();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const alarmParamId = params.get("alarm");

    storage
      .load()
      .then(
        ({
          laterBoxItems,
          laterBoxPrefs,
          laterBoxDraft,
          tabVaultPrivateMeta,
        }) => {
          const loadedItems = laterBoxItems || [];
          setItems(loadedItems);
          setPrivateMeta(tabVaultPrivateMeta || null);
          if (laterBoxPrefs) setPrefs((p) => ({ ...p, ...laterBoxPrefs }));

          const alarmTarget =
            (alarmParamId &&
              loadedItems.find(
                (i) => i.id === alarmParamId && !i.isPrivate && !i.dismissed,
              )) ||
            loadedItems.find(
              (i) =>
                i.type === "link" &&
                !i.isPrivate &&
                i.reminderTime &&
                i.reminderTime <= Date.now() &&
                !i.dismissed,
            );

          if (alarmTarget && alarmParamId) {
            setDetailItemId(alarmTarget.id);
            setView("detail");
          } else if (laterBoxDraft) {
            if (
              laterBoxDraft.view &&
              ["home", "links", "folders", "calendar", "reminders"].includes(
                laterBoxDraft.view,
              )
            ) {
              setView(laterBoxDraft.view);
            }
            if (laterBoxDraft.folderId) {
              const folderObj = loadedItems.find(
                (i) => i.type === "folder" && i.id === laterBoxDraft.folderId,
              );
              setFolderId(
                folderObj && !folderObj.isPrivate ? folderObj.id : null,
              );
            }
            if (laterBoxDraft.urlInput) setUrlInput(laterBoxDraft.urlInput);
            if (laterBoxDraft.noteInput) setNoteInput(laterBoxDraft.noteInput);
            if (laterBoxDraft.saveTargetFolder)
              setSaveTargetFolder(laterBoxDraft.saveTargetFolder);
            if (laterBoxDraft.useReminder)
              setUseReminder(laterBoxDraft.useReminder);
            if (laterBoxDraft.repeatCfg) setRepeatCfg(laterBoxDraft.repeatCfg);
            if (laterBoxDraft.selectedDate) {
              setSelectedDate(laterBoxDraft.selectedDate);
              const [y, m] = laterBoxDraft.selectedDate.split("-").map(Number);
              if (y && m) setCalMonth(new Date(y, m - 1, 1));
            }
            if (laterBoxDraft.calAddOpen)
              setCalAddOpen(laterBoxDraft.calAddOpen);
          }
          setStorageReady(true);
        },
      );

    const msgListener = (msg) => {
      if (msg?.type === "OPEN_ALARM_DETAIL" && msg.itemId) {
        setDetailItemId(msg.itemId);
        setView("detail");
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(msgListener);
    }

    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      const listener = (c, area) => {
        if (
          area === "local" &&
          c.laterBoxItems &&
          Array.isArray(c.laterBoxItems.newValue)
        ) {
          setItems(sanitizeItems(c.laterBoxItems.newValue));
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => {
        chrome.storage.onChanged.removeListener(listener);
        chrome.runtime?.onMessage?.removeListener(msgListener);
      };
    }
  }, []);

  useEffect(() => {
    if (!storageReady || isPrivateMode) return;
    storage.saveDraft({
      view: ["settings", "detail", "edit"].includes(view) ? "home" : view,
      folderId,
      urlInput,
      noteInput,
      saveTargetFolder,
      useReminder,
      repeatCfg,
      selectedDate,
      calAddOpen,
    });
  }, [
    storageReady,
    isPrivateMode,
    view,
    folderId,
    urlInput,
    noteInput,
    saveTargetFolder,
    useReminder,
    repeatCfg,
    selectedDate,
    calAddOpen,
  ]);

  useEffect(() => {
    const base = SIZES[prefs.size] || SIZES.standard;
    const scalePct = resolveFontScale(prefs.font);
    const scaleFactor = Math.max(1, scalePct / 100);

    const effectiveBaseW = scalePct > 105 ? Math.max(base.w, 480) : base.w;
    const scaledWidth = Math.min(780, Math.round(effectiveBaseW * scaleFactor));
    const scaledHeight = Math.min(600, Math.round(base.h * scaleFactor));

    const params = new URLSearchParams(window.location.search);
    const isAlarmWin = Boolean(params.get("alarm"));

    if (isAlarmWin && window.innerWidth >= 320) {
      document.documentElement.style.width = "100vw";
      document.documentElement.style.height = "100vh";
    } else {
      document.documentElement.style.width = `${scaledWidth}px`;
      document.documentElement.style.height = `${scaledHeight}px`;
    }
    document.documentElement.style.fontSize = `${(16 * scalePct) / 100}px`;
  }, [prefs]);

  useEffect(() => {
    if (!storageReady) return;
    const timer = setInterval(() => {
      const now = Date.now();
      let newlyDueId = null;
      const updated = items.map((i) => {
        const matchesSpace = isPrivateMode
          ? Boolean(i.isPrivate)
          : !i.isPrivate;
        if (
          i.type === "link" &&
          matchesSpace &&
          i.reminderTime &&
          i.reminderTime <= now &&
          !i.dismissed &&
          !i.alertedInPopup
        ) {
          newlyDueId = i.id;
          return { ...i, alertedInPopup: true };
        }
        return i;
      });
      if (newlyDueId) {
        playTone(prefs.sound, 3);
        persistItems(updated);
        setDetailItemId(newlyDueId);
        setView("detail");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [storageReady, items, prefs.sound, isPrivateMode]);

  useEffect(() => {
    if (wipeStage !== "progress") return;
    const durationMs = 5000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setWipeProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        executeFullWipe();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [wipeStage]);

  const handleStartWipe = async () => {
    if (privateMeta) {
      if (!wipePass) {
        setWipeError(
          "Enter your Private Mode password to authorize full deletion.",
        );
        setWipeShake(false);
        requestAnimationFrame(() => setWipeShake(true));
        setTimeout(() => setWipeShake(false), 400);
        return;
      }
      setWipeVerifying(true);
      try {
        const validKey = await vaultCrypto.unlock(wipePass, privateMeta);
        if (!validKey) {
          setWipeError("Incorrect password. Deletion denied.");
          setWipeShake(false);
          requestAnimationFrame(() => setWipeShake(true));
          setTimeout(() => setWipeShake(false), 400);
          return;
        }
      } finally {
        setWipeVerifying(false);
      }
    }

    setWipeError("");
    setWipePass("");
    setWipeProgress(0);
    setWipeStage("progress");
  };

  const executeFullWipe = async () => {
    if (typeof chrome !== "undefined" && chrome.alarms) {
      await chrome.alarms.clearAll();
    }
    if (typeof chrome !== "undefined" && chrome.action) {
      chrome.action.setBadgeText({ text: "" });
    }

    await storage.saveItems([], true);
    await storage.savePrivateMeta(null);
    await storage.clearDraft();

    setItems([]);
    setPrivateMeta(null);
    setPrivateKey(null);
    setDecryptedMap({});
    setFolderId(null);
    setDetailItemId(null);
    setEditingItemId(null);
    setUrlInput("");
    setNoteInput("");
    setSaveTargetFolder("");
    setUseReminder(false);
    setWipeStage(null);
    setWipeProgress(0);
    setView("home");
    notify("All data permanently deleted");
  };

  const persistItems = async (next, allowEmpty = false) => {
    if (!storageReady) return;
    const clean = sanitizeItems(next);
    setItems(clean);
    await storage.saveItems(clean, allowEmpty);
  };

  const updatePref = async (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    await storage.savePrefs(next);
    if (key === "sound" && val !== "mute") playTone(val, 1);
  };

  const scheduleChromeAlarm = (item) => {
    if (typeof chrome !== "undefined" && chrome.alarms && item.reminderTime) {
      chrome.alarms.create(`tabvault_${item.id}`, {
        when: Math.max(item.reminderTime, Date.now() + 1000),
      });
    }
  };

  const resetFormAndDraft = async () => {
    setUrlInput("");
    setNoteInput("");
    setSaveTargetFolder("");
    setUseReminder(false);
    setRepeatCfg(createDefaultRepeat());
    if (!isPrivateMode) await storage.clearDraft();
  };

  const resolveItem = (item) => {
    if (!item) return item;
    if ((item.isPrivate || item.encrypted) && decryptedMap[item.id]) {
      return { ...item, ...decryptedMap[item.id] };
    }
    return item;
  };

  const handleSetupPrivate = async () => {
    if (pass1.length < 4) {
      triggerModalError(
        "Password must be at least 4 characters long.",
        "pass1",
      );
      return;
    }
    if (!pass2) {
      triggerModalError("Please re-enter your password to confirm.", "pass2");
      return;
    }
    if (pass1 !== pass2) {
      triggerModalError(
        "Passwords do not match. Re-enter the same password.",
        "pass2",
      );
      return;
    }

    setModalBusy(true);
    try {
      const { lockMeta, aesKey } = await vaultCrypto.createLock(pass1);
      await storage.savePrivateMeta(lockMeta);
      setPrivateMeta(lockMeta);
      setPrivateKey(aesKey);
      setFolderId(null);
      setSaveTargetFolder("");
      setSearch("");
      setFolderSearch("");
      closePrivateModal();
      notify("Private Mode enabled");
    } finally {
      setModalBusy(false);
    }
  };

  const handleUnlockPrivate = async () => {
    if (!pass1) {
      triggerModalError("Enter your Private Mode password.", "pass1");
      return;
    }
    if (!privateMeta) return;

    setModalBusy(true);
    try {
      const aesKey = await vaultCrypto.unlock(pass1, privateMeta);
      if (!aesKey) {
        triggerModalError("Incorrect password. Please try again.", "pass1");
        return;
      }

      const nextDecrypted = {};
      for (const item of items) {
        if ((item.isPrivate || item.encrypted) && item.cipher) {
          try {
            nextDecrypted[item.id] = await vaultCrypto.decryptPayload(
              aesKey,
              item.cipher,
            );
          } catch {}
        }
      }

      setDecryptedMap(nextDecrypted);
      setPrivateKey(aesKey);
      setFolderId(null);
      setSaveTargetFolder("");
      setSearch("");
      setFolderSearch("");
      closePrivateModal();
      notify("Private Mode unlocked");
    } finally {
      setModalBusy(false);
    }
  };

  const exitPrivateMode = () => {
    setPrivateKey(null);
    setDecryptedMap({});
    setFolderId(null);
    setSaveTargetFolder("");
    setSearch("");
    setFolderSearch("");
    setEditingItemId(null);
    setDetailItemId(null);
    setView("home");
    notify("Private Mode locked");
  };

  const handleDisablePrivateMode = async () => {
    if (!pass1) {
      triggerModalError("Enter your password to confirm.", "pass1");
      return;
    }
    if (!privateMeta) return;

    setModalBusy(true);
    try {
      const aesKey = await vaultCrypto.unlock(pass1, privateMeta);
      if (!aesKey) {
        triggerModalError(
          "Incorrect password. Cannot reset Private Space.",
          "pass1",
        );
        return;
      }

      items.forEach((i) => {
        if (i.isPrivate || i.encrypted)
          chrome?.alarms?.clear(`tabvault_${i.id}`);
      });

      const publicOnly = items.filter((i) => !i.isPrivate && !i.encrypted);
      await persistItems(publicOnly, publicOnly.length === 0);
      await storage.savePrivateMeta(null);
      setPrivateMeta(null);
      setPrivateKey(null);
      setDecryptedMap({});
      setFolderId(null);
      setSaveTargetFolder("");
      closePrivateModal();
      notify("Private Space reset & data deleted");
    } finally {
      setModalBusy(false);
    }
  };

  const downloadBackupFile = () => {
    const payload = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        items,
        privateMeta,
        prefs,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tabvault-backup-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  };

  const handleVerifyAndExport = async () => {
    if (!pass1) {
      triggerModalError(
        "Enter your password to authorize data export.",
        "pass1",
      );
      return;
    }
    if (!privateMeta) return;

    setModalBusy(true);
    try {
      const aesKey = await vaultCrypto.unlock(pass1, privateMeta);
      if (!aesKey) {
        triggerModalError("Incorrect password. Data export denied.", "pass1");
        return;
      }
      closePrivateModal();
      downloadBackupFile();
    } finally {
      setModalBusy(false);
    }
  };

  const exportBackup = () => {
    const hasPrivateItems = items.some((i) => i.isPrivate || i.encrypted);
    if (hasPrivateItems && privateMeta) {
      openPrivateModal("export");
      return;
    }
    downloadBackupFile();
  };

  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const importedItems = sanitizeItems(parsed.items || parsed);
        if (importedItems.length === 0) {
          notify("No valid items in backup file", true);
          return;
        }

        if (!privateMeta && parsed.privateMeta) {
          await storage.savePrivateMeta(parsed.privateMeta);
          setPrivateMeta(parsed.privateMeta);
        }

        const activeMeta = privateMeta || parsed.privateMeta;
        const canAcceptEncrypted =
          activeMeta &&
          (!parsed.privateMeta ||
            parsed.privateMeta.verifier === activeMeta.verifier);

        const compatibleItems = importedItems.filter(
          (i) => (!i.isPrivate && !i.encrypted) || canAcceptEncrypted,
        );

        const existingIds = new Set(items.map((i) => i.id));
        const merged = sanitizeItems([
          ...items,
          ...compatibleItems.filter((i) => !existingIds.has(i.id)),
        ]);

        await persistItems(merged);
        notify(`Restored ${compatibleItems.length} items`);
      } catch {
        notify("Invalid backup JSON file", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const saveLink = async ({
    rawUrl,
    fallbackTitle = "",
    withSchedule = false,
    targetFolder = null,
    customDate = null,
  }) => {
    if (!isValidUrl(rawUrl)) {
      triggerFormError("Enter a valid URL (e.g. youtube.com or https://...)");
      return false;
    }

    const resolvedFolderId = targetFolder || null;
    const cleanUrl = normalizeUrl(rawUrl.trim());
    let reminderTime = null;
    let reminderDate = null;
    const repeat = withSchedule ? { ...repeatCfg } : { type: "none" };

    if (withSchedule) {
      if (repeat.type !== "none") {
        reminderTime = getNextOccurrence(repeat, Date.now());
        if (reminderTime) reminderDate = toDateKey(new Date(reminderTime));
      } else {
        const dStr = customDate || repeat.date;
        const parsed = new Date(
          `${dStr}T${repeat.time || "09:00"}:00`,
        ).getTime();
        if (isNaN(parsed) || parsed <= Date.now()) {
          triggerFormError("Pick a future time today or a later date!");
          return false;
        }
        reminderTime = parsed;
        reminderDate = dStr;
      }
    }

    const manualNote = (noteInput.trim() || fallbackTitle)
      .replace(/ - YouTube$/, "")
      .trim();
    const id = genId();

    let newItem;
    if (isPrivateMode) {
      const secretPayload = {
        url: cleanUrl,
        note: manualNote || formatDomain(cleanUrl),
        favorite: false,
      };
      const cipher = await vaultCrypto.encryptPayload(
        privateKey,
        secretPayload,
      );
      setDecryptedMap((prev) => ({ ...prev, [id]: secretPayload }));
      newItem = {
        id,
        type: "link",
        isPrivate: true,
        encrypted: true,
        cipher,
        url: "",
        note: "",
        favorite: false,
        parentId: resolvedFolderId,
        createdAt: Date.now(),
        reminderDate,
        reminderTime,
        repeat,
        fetchingTitle: false,
        dismissed: false,
        alertedInPopup: false,
      };
    } else {
      newItem = {
        id,
        type: "link",
        isPrivate: false,
        encrypted: false,
        url: cleanUrl,
        parentId: resolvedFolderId,
        createdAt: Date.now(),
        reminderDate,
        reminderTime,
        repeat,
        note: manualNote,
        favorite: false,
        fetchingTitle: !manualNote,
        dismissed: false,
        alertedInPopup: false,
      };
    }

    const next = [...items, newItem];
    await persistItems(next);
    if (reminderTime) {
      scheduleChromeAlarm(newItem);
      notify(`Next alert: ${formatReminderTime(reminderTime)}`);
    } else {
      notify(
        resolvedFolderId
          ? `Saved to "${getFolderName(resolvedFolderId)}"`
          : isPrivateMode
            ? "Saved to Private Space"
            : "Link saved",
      );
    }

    if (
      !isPrivateMode &&
      !manualNote &&
      typeof chrome !== "undefined" &&
      chrome.runtime?.sendMessage
    ) {
      chrome.runtime.sendMessage({
        type: "FETCH_LINK_TITLE",
        itemId: newItem.id,
        url: cleanUrl,
      });
    }

    await resetFormAndDraft();
    return true;
  };

  const fillCurrentTabAddress = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (tab?.url) {
          setUrlInput(tab.url);
          if (!noteInput.trim() && tab.title) {
            setNoteInput(tab.title.replace(/ - YouTube$/, "").trim());
          }
          notify("Current tab address pasted");
        }
      });
    }
  };

  const handleCreateFolderFromPicker = async () => {
    const trimmed = pickerNewFolderName.trim();
    if (!trimmed) {
      setPickerCreatingFolder(false);
      return;
    }
    const id = genId();
    const parentForNew = pickerBrowseFolderId || null;
    if (isPrivateMode) {
      const cipher = await vaultCrypto.encryptPayload(privateKey, {
        name: trimmed,
      });
      setDecryptedMap((prev) => ({ ...prev, [id]: { name: trimmed } }));
      await persistItems([
        ...items,
        {
          id,
          type: "folder",
          isPrivate: true,
          encrypted: true,
          cipher,
          name: "",
          parentId: parentForNew,
        },
      ]);
    } else {
      await persistItems([
        ...items,
        {
          id,
          type: "folder",
          isPrivate: false,
          name: trimmed,
          parentId: parentForNew,
        },
      ]);
    }
    setPickerNewFolderName("");
    setPickerCreatingFolder(false);
    selectFolderInPicker(id);
    notify(`Folder "${trimmed}" selected`);
  };

  const openEditor = (rawItem) => {
    const item = resolveItem(rawItem);
    setPreviousView(view);
    setEditingItemId(item.id);
    setEditUrl(item.url || "");
    setEditNote(item.note || "");
    setEditParentId(item.parentId || "");

    const hasSchedule = Boolean(
      (item.reminderTime && !item.dismissed) ||
      (item.repeat && item.repeat.type !== "none"),
    );
    setEditUseReminder(hasSchedule);

    const existingDateObj = item.reminderTime
      ? new Date(item.reminderTime)
      : new Date();
    const fallbackDate = item.reminderDate || toDateKey(existingDateObj);
    const fallbackTime =
      item.repeat?.time ||
      (item.reminderTime
        ? `${String(existingDateObj.getHours()).padStart(2, "0")}:${String(existingDateObj.getMinutes()).padStart(2, "0")}`
        : defaultTimePlus(5));

    setEditRepeatCfg({
      type: item.repeat?.type || "none",
      date: fallbackDate,
      time: fallbackTime,
      daysOfWeek: item.repeat?.daysOfWeek?.length
        ? item.repeat.daysOfWeek
        : [existingDateObj.getDay()],
      daysOfMonth: item.repeat?.daysOfMonth?.length
        ? item.repeat.daysOfMonth
        : [existingDateObj.getDate()],
      lastDayOfMonth: Boolean(item.repeat?.lastDayOfMonth),
    });

    setView("edit");
  };

  const saveEditedItem = async () => {
    if (!isValidUrl(editUrl)) {
      triggerFormError("Enter a valid URL (e.g. youtube.com or https://...)");
      return;
    }

    const cleanUrl = normalizeUrl(editUrl.trim());
    let reminderTime = null;
    let reminderDate = null;
    const repeat = editUseReminder ? { ...editRepeatCfg } : { type: "none" };

    if (editUseReminder) {
      if (repeat.type !== "none") {
        reminderTime = getNextOccurrence(repeat, Date.now());
        if (reminderTime) reminderDate = toDateKey(new Date(reminderTime));
      } else {
        const parsed = new Date(
          `${repeat.date}T${repeat.time || "09:00"}:00`,
        ).getTime();
        if (isNaN(parsed) || parsed <= Date.now()) {
          triggerFormError(
            "Pick a future date & time or switch to Weekly/Monthly!",
          );
          return;
        }
        reminderTime = parsed;
        reminderDate = repeat.date;
      }
    }

    let updatedRecord = null;
    const next = await Promise.all(
      items.map(async (raw) => {
        if (raw.id !== editingItemId) return raw;
        const resolved = resolveItem(raw);

        if (isPrivateMode) {
          const plain = {
            url: cleanUrl,
            note: editNote.trim() || formatDomain(cleanUrl),
            favorite: Boolean(resolved.favorite),
          };
          const cipher = await vaultCrypto.encryptPayload(privateKey, plain);
          setDecryptedMap((prev) => ({ ...prev, [raw.id]: plain }));
          updatedRecord = {
            ...raw,
            isPrivate: true,
            encrypted: true,
            cipher,
            url: "",
            note: "",
            favorite: false,
            parentId: editParentId || null,
            reminderTime,
            reminderDate,
            repeat,
            dismissed: false,
            alertedInPopup: false,
          };
          return updatedRecord;
        }

        updatedRecord = {
          ...raw,
          url: cleanUrl,
          note: editNote.trim(),
          parentId: editParentId || null,
          reminderTime,
          reminderDate,
          repeat,
          dismissed: false,
          alertedInPopup: false,
        };
        return updatedRecord;
      }),
    );

    await persistItems(next);
    if (updatedRecord) {
      if (updatedRecord.reminderTime) {
        scheduleChromeAlarm(updatedRecord);
      } else {
        chrome?.alarms?.clear(`tabvault_${updatedRecord.id}`);
      }
    }

    setEditingItemId(null);
    setView(previousView || "home");
    notify("Changes saved");
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreatingFolder(false);
      return;
    }
    const id = genId();
    if (isPrivateMode) {
      const cipher = await vaultCrypto.encryptPayload(privateKey, {
        name: trimmed,
      });
      setDecryptedMap((prev) => ({ ...prev, [id]: { name: trimmed } }));
      await persistItems([
        ...items,
        {
          id,
          type: "folder",
          isPrivate: true,
          encrypted: true,
          cipher,
          name: "",
          parentId: folderId,
        },
      ]);
    } else {
      await persistItems([
        ...items,
        {
          id,
          type: "folder",
          isPrivate: false,
          name: trimmed,
          parentId: folderId,
        },
      ]);
    }
    setNewFolderName("");
    setCreatingFolder(false);
    notify(`Folder "${trimmed}" created`);
  };

  const handleRenameFolder = async (id) => {
    const trimmed = renameFolderVal.trim();
    if (!trimmed) {
      setRenamingFolderId(null);
      return;
    }
    if (isPrivateMode) {
      const cipher = await vaultCrypto.encryptPayload(privateKey, {
        name: trimmed,
      });
      setDecryptedMap((prev) => ({ ...prev, [id]: { name: trimmed } }));
      await persistItems(
        items.map((x) => (x.id === id ? { ...x, cipher, name: "" } : x)),
      );
    } else {
      await persistItems(
        items.map((x) => (x.id === id ? { ...x, name: trimmed } : x)),
      );
    }
    setRenamingFolderId(null);
    notify("Folder renamed");
  };

  const toggleFavorite = async (rawItem) => {
    const item = resolveItem(rawItem);
    const nextFav = !item.favorite;

    if (isPrivateMode) {
      const plain = { url: item.url, note: item.note, favorite: nextFav };
      const cipher = await vaultCrypto.encryptPayload(privateKey, plain);
      setDecryptedMap((prev) => ({ ...prev, [item.id]: plain }));
      await persistItems(
        items.map((x) => (x.id === item.id ? { ...x, cipher } : x)),
      );
    } else {
      await persistItems(
        items.map((x) => (x.id === item.id ? { ...x, favorite: nextFav } : x)),
      );
    }
    notify(nextFav ? "Added to favorites" : "Removed from favorites");
  };

  const snoozeMinutes = async (item, mins) => {
    const nextTs = Date.now() + mins * 60000;
    const updated = {
      ...item,
      reminderTime: nextTs,
      reminderDate: toDateKey(new Date(nextTs)),
      dismissed: false,
      alertedInPopup: false,
    };
    scheduleChromeAlarm(updated);
    await persistItems(items.map((x) => (x.id === item.id ? updated : x)));
    notify(`Snoozed ${mins} min`);
  };

  const advanceOrDismiss = async (item) => {
    const nextTs = getNextOccurrence(item.repeat, Date.now());
    const next = items.map((i) => {
      if (i.id !== item.id) return i;
      if (nextTs) {
        const updated = {
          ...i,
          reminderTime: nextTs,
          reminderDate: toDateKey(new Date(nextTs)),
          dismissed: false,
          alertedInPopup: false,
        };
        scheduleChromeAlarm(updated);
        return updated;
      }
      chrome?.alarms?.clear(`tabvault_${i.id}`);
      return { ...i, dismissed: true };
    });
    await persistItems(next);
    notify(
      nextTs ? `Next repeat: ${formatReminderTime(nextTs)}` : "Marked as done",
    );
  };

  const deleteItem = async (id) => {
    const toDelete = new Set([id]);
    let added = true;
    while (added) {
      added = false;
      items.forEach((i) => {
        if (toDelete.has(i.parentId) && !toDelete.has(i.id)) {
          toDelete.add(i.id);
          added = true;
        }
      });
    }
    toDelete.forEach((delId) => chrome?.alarms?.clear(`tabvault_${delId}`));
    const remaining = items.filter((i) => !toDelete.has(i.id));
    await persistItems(remaining, remaining.length === 0);
    if (toDelete.has(folderId)) setFolderId(null);
    if (toDelete.has(saveTargetFolder)) setSaveTargetFolder("");
    if (detailItemId === id) setView("home");
    if (editingItemId === id) setView("home");
  };

  const spaceItems = useMemo(
    () =>
      items
        .filter((i) =>
          isPrivateMode ? Boolean(i.isPrivate) : !i.isPrivate && !i.encrypted,
        )
        .map(resolveItem),
    [items, isPrivateMode, decryptedMap],
  );

  const spaceLinks = useMemo(
    () => spaceItems.filter((i) => i.type === "link"),
    [spaceItems],
  );
  const spaceFolders = useMemo(
    () =>
      spaceItems
        .filter((i) => i.type === "folder")
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [spaceItems],
  );

  const regularLinks = useMemo(
    () => spaceLinks.filter((i) => !i.reminderTime || i.dismissed),
    [spaceLinks],
  );

  const getFolderName = (parentId) => {
    if (!parentId) return "";
    const f = spaceFolders.find((i) => i.id === parentId);
    return f ? f.name : "";
  };

  const getFolderPath = (targetId) => {
    const parts = [];
    let cur = targetId;
    while (cur) {
      const f = spaceFolders.find((i) => i.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parentId;
    }
    return parts.join(" / ");
  };

  const dueItem = spaceLinks.find(
    (i) => i.reminderTime && i.reminderTime <= Date.now() && !i.dismissed,
  );
  const detailItem = spaceLinks.find((i) => i.id === detailItemId);

  const favoriteCount = useMemo(
    () => regularLinks.filter((i) => i.favorite).length,
    [regularLinks],
  );

  const searchedLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regularLinks
      .filter((i) => {
        if (linkFilter === "favorites") return Boolean(i.favorite);
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        return (
          (i.note || "").toLowerCase().includes(q) ||
          (i.url || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [regularLinks, search, linkFilter]);

  const matchingFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return [];
    return spaceFolders.filter((f) => (f.name || "").toLowerCase().includes(q));
  }, [spaceFolders, folderSearch]);

  const upcomingReminders = useMemo(() => {
    return spaceLinks
      .filter((i) => i.reminderTime && !i.dismissed)
      .sort((a, b) => a.reminderTime - b.reminderTime);
  }, [spaceLinks]);

  const isUrlInvalid = urlInput.trim().length > 0 && !isValidUrl(urlInput);
  const isEditUrlInvalid = editUrl.trim().length > 0 && !isValidUrl(editUrl);

  const isHomePast =
    useReminder &&
    repeatCfg.type === "none" &&
    new Date(`${repeatCfg.date}T${repeatCfg.time || "09:00"}:00`).getTime() <=
      Date.now();

  const isEditPast =
    editUseReminder &&
    editRepeatCfg.type === "none" &&
    new Date(
      `${editRepeatCfg.date}T${editRepeatCfg.time || "09:00"}:00`,
    ).getTime() <= Date.now();

  const isCalPast =
    calAddOpen &&
    repeatCfg.type === "none" &&
    new Date(`${selectedDate}T${repeatCfg.time || "09:00"}:00`).getTime() <=
      Date.now();

  const hasUnsavedDraft = Boolean(
    urlInput.trim() ||
    noteInput.trim() ||
    saveTargetFolder ||
    useReminder ||
    calAddOpen,
  );
  const currentFontScale = resolveFontScale(prefs.font);

  const renderLinkRow = (item, draggable = false, showFolderTag = false) => {
    const isDue =
      item.reminderTime && item.reminderTime <= Date.now() && !item.dismissed;
    const thumb = getYouTubeThumb(item.url);
    const repeatTxt = formatRepeatLabel(item.repeat);
    const folderLabel = showFolderTag ? getFolderName(item.parentId) : "";

    return (
      <li
        key={item.id}
        draggable={draggable}
        onDragStart={() => setDragId(item.id)}
        className={`flex items-center justify-between gap-2 p-2.5 mb-2 rounded-lg border ${CARD_BG[prefs.theme]} ${
          isDue ? "border-l-4 border-l-red-500" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="w-16 h-10 object-cover rounded shrink-0 bg-black"
            />
          ) : (
            <img
              src={getFavicon(item.url)}
              alt=""
              className="w-4 h-4 rounded shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold line-clamp-2 hover:text-emerald-500 leading-snug"
            >
              {item.note ||
                (item.fetchingTitle
                  ? "Fetching title..."
                  : formatDomain(item.url))}
            </a>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs opacity-85">
              {item.reminderTime && !item.dismissed && (
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${isDue ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-600"}`}
                >
                  {isDue ? "DUE · " : ""}
                  {formatReminderTime(item.reminderTime)}
                </span>
              )}
              {repeatTxt && (
                <span className="px-1.5 py-0.5 rounded bg-current/10 font-medium">
                  ↻ {repeatTxt}
                </span>
              )}
              {folderLabel && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
                  📁 {folderLabel}
                </span>
              )}
              {!repeatTxt && (
                <span className="truncate">{formatDomain(item.url)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => toggleFavorite(item)}
            aria-label={
              item.favorite ? "Remove from favorites" : "Add to favorites"
            }
            aria-pressed={Boolean(item.favorite)}
            title={item.favorite ? "Remove from favorites" : "Add to favorites"}
            className={`px-2 py-1 text-xs rounded border border-current/20 transition ${
              item.favorite
                ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
                : "opacity-75 hover:opacity-100"
            }`}
          >
            {item.favorite ? "★" : "☆"}
          </button>
          {isDue && (
            <button
              onClick={() => {
                setDetailItemId(item.id);
                setView("detail");
              }}
              className="px-2 py-1 text-xs font-bold rounded bg-emerald-600 text-white"
            >
              View
            </button>
          )}
          <button
            onClick={() => openEditor(item)}
            aria-label={`Edit ${item.note || formatDomain(item.url)}`}
            className="px-2 py-1 text-xs font-semibold rounded border border-current/20 opacity-85 hover:opacity-100 hover:border-emerald-500"
          >
            Edit
          </button>
          <button
            onClick={() => deleteItem(item.id)}
            aria-label={`Delete ${item.note || formatDomain(item.url)}`}
            className="px-2 py-1 text-xs font-semibold rounded border border-current/20 hover:bg-red-500/15 hover:text-red-500"
          >
            Del
          </button>
        </div>
      </li>
    );
  };

  const breadcrumbs = [];
  let tempFolder = folderId;
  while (tempFolder) {
    const f = spaceFolders.find((i) => i.id === tempFolder);
    if (f) {
      breadcrumbs.unshift(f);
      tempFolder = f.parentId;
    } else break;
  }

  const folderChildren = spaceItems
    .filter((i) => {
      if (i.parentId !== folderId) return false;
      if (!folderId && i.type !== "folder") return false;
      return true;
    })
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "folder" ? -1 : 1));

  // Level-by-level drill-down data for the Location Picker
  const pickerBrowsedFolder = pickerBrowseFolderId
    ? spaceFolders.find((f) => f.id === pickerBrowseFolderId)
    : null;
  const pickerBreadcrumbs = [];
  let tempPickerId = pickerBrowseFolderId;
  while (tempPickerId) {
    const f = spaceFolders.find((i) => i.id === tempPickerId);
    if (f) {
      pickerBreadcrumbs.unshift(f);
      tempPickerId = f.parentId;
    } else break;
  }
  const pickerSubfolders = spaceFolders.filter(
    (f) => (f.parentId || null) === (pickerBrowseFolderId || null),
  );
  const pickerFilteredFolders = pickerSearch.trim()
    ? spaceFolders.filter((f) =>
        (f.name || "")
          .toLowerCase()
          .includes(pickerSearch.trim().toLowerCase()),
      )
    : [];

  const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(
    calMonth.getFullYear(),
    calMonth.getMonth() + 1,
    0,
  ).getDate();
  const isCalMonthlyMulti = calAddOpen && repeatCfg.type === "monthly";
  const todayKey = toDateKey(new Date());

  return (
    <div
      className={`w-full h-full flex flex-col relative ${THEMES[prefs.theme]}`}
    >
      {/* DRILL-DOWN ROOT FOLDER LOCATION PICKER */}
      {folderPickerOpen && (
        <div
          onClick={closeFolderPicker}
          className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose destination folder"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[84%] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${CARD_BG[prefs.theme]}`}
          >
            {/* Header with Back button */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-current/10 shrink-0">
              {pickerBrowsedFolder && !pickerSearch.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setPickerBrowseFolderId(
                      pickerBrowsedFolder.parentId || null,
                    );
                    setPickerCreatingFolder(false);
                  }}
                  className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                >
                  <span>‹ Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={closeFolderPicker}
                  className="text-xs font-semibold opacity-75 hover:opacity-100"
                >
                  Cancel
                </button>
              )}

              <span className="text-xs font-bold truncate max-w-[50%]">
                {pickerBrowsedFolder && !pickerSearch.trim()
                  ? pickerBrowsedFolder.name
                  : "Root"}
              </span>

              <button
                type="button"
                onClick={() => {
                  setPickerCreatingFolder((v) => !v);
                  setPickerNewFolderName("");
                }}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                + Folder
              </button>
            </div>

            {/* Clickable Breadcrumb Trail */}
            {!pickerSearch.trim() && pickerBreadcrumbs.length > 0 && (
              <nav
                aria-label="Picker path"
                className="flex items-center gap-1 px-3.5 py-1.5 border-b border-current/10 text-[11px] font-semibold overflow-x-auto bg-black/5 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setPickerBrowseFolderId(null)}
                  className="hover:text-emerald-600 shrink-0"
                >
                  Root
                </button>
                {pickerBreadcrumbs.map((f, idx) => (
                  <span key={f.id} className="flex items-center gap-1 shrink-0">
                    <span className="opacity-50">/</span>
                    <button
                      type="button"
                      onClick={() => setPickerBrowseFolderId(f.id)}
                      className={
                        idx === pickerBreadcrumbs.length - 1
                          ? "text-emerald-600 font-bold"
                          : "hover:text-emerald-600"
                      }
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </nav>
            )}

            {/* Inline Quick Create Folder */}
            {pickerCreatingFolder && (
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-current/10 bg-emerald-500/5 shrink-0">
                <span className="text-xs">📁</span>
                <input
                  type="text"
                  autoFocus
                  value={pickerNewFolderName}
                  onChange={(e) => setPickerNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolderFromPicker();
                    if (e.key === "Escape") setPickerCreatingFolder(false);
                  }}
                  placeholder={
                    pickerBrowsedFolder
                      ? `New subfolder in ${pickerBrowsedFolder.name}...`
                      : "New folder name..."
                  }
                  className="flex-1 px-2 py-1 text-xs rounded border border-emerald-500 bg-transparent outline-none"
                />
                <button
                  type="button"
                  disabled={!pickerNewFolderName.trim()}
                  onClick={handleCreateFolderFromPicker}
                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}

            {/* Instant Search Bar */}
            <div className="p-2.5 border-b border-current/10 shrink-0">
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-xs opacity-60">🔍</span>
                <input
                  type="text"
                  autoFocus={!pickerCreatingFolder}
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search all folders..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch("")}
                    className="absolute right-2 text-xs opacity-70 hover:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Primary "Save in [Current Folder]" Action when inside a subfolder */}
            {pickerBrowsedFolder && !pickerSearch.trim() && (
              <div className="px-2.5 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => selectFolderInPicker(pickerBrowsedFolder.id)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center justify-between shadow-xs"
                >
                  <span className="truncate">
                    Save in "{pickerBrowsedFolder.name}"
                  </span>
                  <span>Select ✓</span>
                </button>
              </div>
            )}

            {/* Single-Level Folder List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {pickerSearch.trim() ? (
                <div>
                  <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider opacity-65">
                    Search Results ({pickerFilteredFolders.length})
                  </div>
                  {pickerFilteredFolders.length === 0 ? (
                    <div className="text-center text-xs opacity-70 py-6">
                      No folders matching "{pickerSearch.trim()}"
                    </div>
                  ) : (
                    pickerFilteredFolders.map((f) => {
                      const path = getFolderPath(f.parentId);
                      const isSelected = saveTargetFolder === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => selectFolderInPicker(f.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition ${
                            isSelected
                              ? "bg-emerald-600/15 text-emerald-600 font-bold"
                              : "hover:bg-current/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span>📁</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{f.name}</div>
                              {path && (
                                <div className="text-[11px] opacity-65 truncate">
                                  Root / {path}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <>
                  {/* Root-level default option */}
                  {!pickerBrowsedFolder && (
                    <button
                      type="button"
                      onClick={() => selectFolderInPicker("")}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition ${
                        saveTargetFolder === ""
                          ? "bg-emerald-600/15 text-emerald-600 font-bold"
                          : "hover:bg-current/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🔗</span>
                        <span>Links (No folder)</span>
                      </span>
                      {saveTargetFolder === "" && <span>✓</span>}
                    </button>
                  )}

                  <div className="px-2 pt-1 pb-0.5 text-[11px] font-bold uppercase tracking-wider opacity-65">
                    {pickerBrowsedFolder
                      ? `Subfolders (${pickerSubfolders.length})`
                      : `Folders (${pickerSubfolders.length})`}
                  </div>

                  {pickerSubfolders.length === 0 ? (
                    <div className="px-2.5 py-4 text-center text-xs opacity-65">
                      {pickerBrowsedFolder
                        ? "No subfolders here. Tap the green button above to save here."
                        : "No folders yet. Tap + Folder above to create one."}
                    </div>
                  ) : (
                    pickerSubfolders.map((folder) => {
                      const subFolders = spaceFolders.filter(
                        (x) => x.parentId === folder.id,
                      );
                      const hasSubfolders = subFolders.length > 0;
                      const isSelected = saveTargetFolder === folder.id;

                      return (
                        <div
                          key={folder.id}
                          onClick={() => {
                            if (hasSubfolders) {
                              setPickerBrowseFolderId(folder.id);
                              setPickerCreatingFolder(false);
                            } else {
                              selectFolderInPicker(folder.id);
                            }
                          }}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer select-none transition ${
                            isSelected
                              ? "bg-emerald-600/15 text-emerald-600 font-bold"
                              : "hover:bg-current/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span>📁</span>
                            <span className="truncate font-semibold">
                              {folder.name}
                            </span>
                            {hasSubfolders && (
                              <span className="text-[11px] opacity-60 shrink-0">
                                ({subFolders.length})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasSubfolders ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectFolderInPicker(folder.id);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                                    isSelected
                                      ? "bg-emerald-600 text-white"
                                      : "bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                                  }`}
                                >
                                  {isSelected ? "Selected ✓" : "Select"}
                                </button>
                                <span className="opacity-65 text-sm leading-none pl-0.5">
                                  ›
                                </span>
                              </>
                            ) : (
                              isSelected && <span className="font-bold">✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WIPE ALL DATA MODAL */}
      {wipeStage && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wipe-modal-title"
            className={`w-full max-w-sm p-4 rounded-2xl border border-red-500/60 shadow-2xl space-y-3.5 ${CARD_BG[prefs.theme]} ${
              wipeShake ? "animate-shake" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                id="wipe-modal-title"
                className="flex items-center gap-2 font-bold text-sm text-red-500"
              >
                <span>🗑️</span>
                <span>
                  {wipeStage === "confirm"
                    ? "Delete All TabVault Data?"
                    : "Deleting All Data..."}
                </span>
              </div>
              {wipeStage === "confirm" && (
                <button
                  onClick={() => setWipeStage(null)}
                  aria-label="Close"
                  className="text-xs opacity-75 hover:opacity-100 px-1.5 py-0.5 rounded"
                >
                  ✕
                </button>
              )}
            </div>

            {wipeStage === "confirm" ? (
              <>
                <div className="p-3 rounded-xl bg-red-600/12 border border-red-500/35 text-xs space-y-1.5">
                  <div className="font-bold text-red-500">
                    ⚠️ This action cannot be undone!
                  </div>
                  <p className="opacity-90 leading-relaxed">
                    All saved links, folders, scheduled reminders, and your
                    encrypted Private Space will be permanently erased.
                  </p>
                </div>

                {wipeError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-red-600/15 border border-red-500 text-red-600 text-xs font-semibold"
                  >
                    <span className="shrink-0">⚠️</span>
                    <span>{wipeError}</span>
                  </div>
                )}

                {privateMeta && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold opacity-85">
                      Enter your Private Mode password to confirm:
                    </label>
                    <input
                      type="password"
                      autoFocus
                      value={wipePass}
                      onChange={(e) => {
                        setWipePass(e.target.value);
                        if (wipeError) setWipeError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleStartWipe();
                      }}
                      placeholder="Private Mode password..."
                      className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent outline-none transition ${
                        wipeError
                          ? "border-red-500 ring-2 ring-red-500/35 bg-red-500/5"
                          : "border-current/25 focus:border-red-500"
                      }`}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={wipeVerifying}
                    onClick={handleStartWipe}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {wipeVerifying ? "Verifying..." : "Yes, Delete Everything"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWipeStage(null)}
                    className="px-3.5 py-2 rounded-lg border border-current/20 text-xs font-semibold hover:opacity-100"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs opacity-85 leading-relaxed">
                  Erasing {items.length} items and clearing all reminders. Click{" "}
                  <strong>Cancel Deletion</strong> before the bar reaches 100%
                  to stop.
                </p>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-red-500">Wiping storage...</span>
                    <span>{wipeProgress}%</span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-black/20 overflow-hidden border border-current/15 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 via-red-500 to-red-600 transition-all duration-75"
                      style={{ width: `${wipeProgress}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setWipeStage(null);
                    setWipeProgress(0);
                    notify("Deletion cancelled — your data is safe");
                  }}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-md transition"
                >
                  Cancel Deletion (
                  {Math.max(1, Math.ceil((100 - wipeProgress) / 20))}s left)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* GLOBAL PRIVATE MODE MODAL */}
      {privateModal && (
        <div className="absolute inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="private-modal-title"
            className={`w-full max-w-sm p-4 rounded-2xl border shadow-2xl space-y-3 transition-colors ${
              modalError ? "border-red-500 ring-2 ring-red-500/25" : ""
            } ${CARD_BG[prefs.theme]} ${modalShake ? "animate-shake" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                id="private-modal-title"
                className="flex items-center gap-2 font-bold text-sm"
              >
                <span>
                  {privateModal === "unlock"
                    ? "🔒"
                    : privateModal === "setup"
                      ? "🛡️"
                      : privateModal === "export"
                        ? "🔐"
                        : "⚠️"}
                </span>
                <span>
                  {privateModal === "unlock"
                    ? "Enter Private Mode"
                    : privateModal === "setup"
                      ? "Set Up Private Mode"
                      : privateModal === "export"
                        ? "Verify Password to Export"
                        : "Reset Private Mode"}
                </span>
              </div>
              <button
                onClick={closePrivateModal}
                aria-label="Close"
                className="text-xs opacity-75 hover:opacity-100 px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            {modalError ? (
              <div
                role="alert"
                className="flex items-start gap-2 p-2.5 rounded-lg bg-red-600/15 border border-red-500 text-red-600 text-xs font-semibold"
              >
                <span className="shrink-0">⚠️</span>
                <span>{modalError}</span>
              </div>
            ) : (
              <p className="text-xs opacity-80 leading-relaxed">
                {privateModal === "unlock"
                  ? "Enter your password to switch to your encrypted Private Space."
                  : privateModal === "setup"
                    ? "Create a password for your Private Space. Everything saved in Private Mode is encrypted with AES-256-GCM and completely hidden from Standard mode."
                    : privateModal === "export"
                      ? "Your backup includes encrypted Private Mode data. Enter your password to verify your identity before downloading the backup file."
                      : "Enter your current password to permanently delete all Private Space items and remove the password."}
              </p>
            )}

            <div className="space-y-2">
              <input
                type="password"
                autoFocus
                aria-invalid={
                  modalErrorField === "pass1" || modalErrorField === "both"
                }
                value={pass1}
                onChange={(e) => {
                  setPass1(e.target.value);
                  if (modalError) {
                    setModalError("");
                    setModalErrorField("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (privateModal === "unlock") handleUnlockPrivate();
                    else if (privateModal === "export") handleVerifyAndExport();
                    else if (privateModal === "remove")
                      handleDisablePrivateMode();
                  }
                }}
                placeholder={
                  privateModal === "setup"
                    ? "Create password (min 4 chars)..."
                    : "Enter password..."
                }
                className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent outline-none transition ${
                  modalErrorField === "pass1" || modalErrorField === "both"
                    ? "border-red-500 ring-2 ring-red-500/35 bg-red-500/5"
                    : "border-current/25 focus:border-indigo-500"
                }`}
              />

              {privateModal === "setup" && (
                <input
                  type="password"
                  aria-invalid={
                    modalErrorField === "pass2" || modalErrorField === "both"
                  }
                  value={pass2}
                  onChange={(e) => {
                    setPass2(e.target.value);
                    if (modalError) {
                      setModalError("");
                      setModalErrorField("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetupPrivate();
                  }}
                  placeholder="Re-enter password to confirm..."
                  className={`w-full px-3 py-2 text-xs rounded-lg border bg-transparent outline-none transition ${
                    modalErrorField === "pass2" || modalErrorField === "both"
                      ? "border-red-500 ring-2 ring-red-500/35 bg-red-500/5"
                      : "border-current/25 focus:border-indigo-500"
                  }`}
                />
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                disabled={modalBusy}
                onClick={() => {
                  if (privateModal === "setup") handleSetupPrivate();
                  else if (privateModal === "unlock") handleUnlockPrivate();
                  else if (privateModal === "export") handleVerifyAndExport();
                  else handleDisablePrivateMode();
                }}
                className={`flex-1 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50 ${
                  privateModal === "remove"
                    ? "bg-red-600 hover:bg-red-700"
                    : privateModal === "export"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {modalBusy
                  ? "Verifying..."
                  : privateModal === "setup"
                    ? "Create & Enter Private"
                    : privateModal === "unlock"
                      ? "Unlock Private"
                      : privateModal === "export"
                        ? "Verify & Download JSON"
                        : "Reset Private Space"}
              </button>
              <button
                onClick={closePrivateModal}
                className="px-3 py-2 rounded-lg border border-current/20 text-xs font-semibold hover:opacity-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL INLINE LINK & REMINDER EDITOR VIEW */}
      {view === "edit" && editingItemId ? (
        <>
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 ${CARD_BG[prefs.theme]}`}
          >
            <button
              onClick={() => {
                setEditingItemId(null);
                setView(previousView || "home");
              }}
              className="text-xs font-bold text-emerald-600 bg-emerald-500/15 px-3 py-1.5 rounded-md"
            >
              ← Cancel
            </button>
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">
              Edit Link &amp; Reminder
            </span>
          </div>

          <div
            className={`p-3.5 space-y-3 overflow-y-auto flex-1 ${shakeForm ? "animate-shake" : ""}`}
          >
            <div
              className={`p-3 rounded-xl border space-y-2.5 ${CARD_BG[prefs.theme]}`}
            >
              <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider opacity-80">
                Title / Note
                <input
                  type="text"
                  autoFocus
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Enter title or note..."
                  className="px-2.5 py-1.5 text-xs font-normal rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider opacity-80">
                Website URL
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={`px-2.5 py-1.5 text-xs font-normal rounded-lg border bg-transparent outline-none ${
                    isEditUrlInvalid
                      ? "border-red-500 ring-1 ring-red-500"
                      : "border-current/20 focus:border-emerald-500"
                  }`}
                />
              </label>
              {isEditUrlInvalid && (
                <div role="alert" className="text-xs text-red-500 font-medium">
                  ⚠️ Enter a valid web link (must include a domain like .com or
                  .se)
                </div>
              )}

              <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider opacity-80">
                Folder
                <select
                  value={editParentId}
                  onChange={(e) => setEditParentId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-normal rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                >
                  <option value="" className="text-slate-900">
                    Links (No folder)
                  </option>
                  {spaceFolders.map((f) => (
                    <option key={f.id} value={f.id} className="text-slate-900">
                      {getFolderPath(f.id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-2.5 ${CARD_BG[prefs.theme]}`}
            >
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs font-bold">
                  Reminder &amp; Repeat Schedule
                </span>
                <input
                  type="checkbox"
                  checked={editUseReminder}
                  onChange={(e) => setEditUseReminder(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4"
                />
              </label>

              {editUseReminder ? (
                <RepeatPicker
                  value={editRepeatCfg}
                  onChange={setEditRepeatCfg}
                />
              ) : (
                <div className="text-xs opacity-75">
                  No reminder active. Enable the toggle above to schedule an
                  alert.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEditedItem}
                disabled={!editUrl.trim() || isEditUrlInvalid || isEditPast}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                  !editUrl.trim() || isEditUrlInvalid || isEditPast
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                Save Changes
              </button>
              <button
                onClick={() => deleteItem(editingItemId)}
                className="px-3.5 py-2 rounded-lg bg-red-500/15 text-red-500 text-xs font-bold hover:bg-red-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      ) : view === "reminders" ? (
        /* DEDICATED ALL UPCOMING REMINDERS VIEW */
        <>
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 ${CARD_BG[prefs.theme]}`}
          >
            <button
              onClick={() => setView("home")}
              className="text-xs font-bold text-emerald-600 bg-emerald-500/15 px-3 py-1.5 rounded-md"
            >
              ← Back to Home
            </button>
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">
              All Reminders ({upcomingReminders.length})
            </span>
          </div>

          <ul className="flex-1 overflow-y-auto p-3">
            {upcomingReminders.length === 0 ? (
              <li className="text-center text-xs opacity-75 py-10">
                No upcoming reminders scheduled.
              </li>
            ) : (
              upcomingReminders.map((i) => renderLinkRow(i, false, true))
            )}
          </ul>
        </>
      ) : view === "settings" ? (
        /* SETTINGS VIEW */
        <>
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 ${CARD_BG[prefs.theme]}`}
          >
            <button
              onClick={() => setView("home")}
              className="text-xs font-bold text-emerald-600 bg-emerald-500/15 px-3 py-1.5 rounded-md"
            >
              ← Back to Home
            </button>
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">
              Settings
            </span>
          </div>

          <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
            {[
              {
                label: "Color Theme",
                key: "theme",
                opts: ["light", "dark", "forest"],
              },
              {
                label: "Window Size",
                key: "size",
                opts: ["compact", "standard", "large"],
              },
            ].map((group) => (
              <div
                key={group.key}
                className={`p-3 rounded-xl border ${CARD_BG[prefs.theme]}`}
              >
                <div className="text-xs font-bold mb-2">{group.label}</div>
                <div
                  role="group"
                  aria-label={group.label}
                  className="grid grid-flow-col auto-cols-fr gap-1 bg-black/10 p-1 rounded-lg"
                >
                  {group.opts.map((opt) => (
                    <button
                      key={opt}
                      aria-pressed={prefs[group.key] === opt}
                      onClick={() => updatePref(group.key, opt)}
                      className={`py-1.5 text-xs font-semibold capitalize rounded-md ${
                        prefs[group.key] === opt
                          ? "bg-emerald-600 text-white"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div
              className={`p-3 rounded-xl border space-y-2.5 ${CARD_BG[prefs.theme]}`}
            >
              <div className="text-xs font-bold">Alert Sound</div>
              <div
                role="group"
                aria-label="Alert Sound"
                className="grid grid-flow-col auto-cols-fr gap-1 bg-black/10 p-1 rounded-lg"
              >
                {["chime", "bell", "pulse", "mute"].map((opt) => (
                  <button
                    key={opt}
                    aria-pressed={prefs.sound === opt}
                    onClick={() => updatePref("sound", opt)}
                    className={`py-1.5 text-xs font-semibold capitalize rounded-md ${
                      prefs.sound === opt
                        ? "bg-emerald-600 text-white"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  playTone(prefs.sound, 2);
                  chrome?.notifications?.create(`test_${Date.now()}`, {
                    type: "basic",
                    iconUrl: "icon48.png",
                    title: "TabVault Test Alert",
                    message: `Sound mode: ${prefs.sound}`,
                  });
                  notify("Test alert sent");
                }}
                className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
              >
                Test Alert &amp; Sound
              </button>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-2.5 ${CARD_BG[prefs.theme]}`}
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="text-scale-slider"
                  className="text-xs font-bold"
                >
                  Text Size
                </label>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-600">
                  {currentFontScale}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease text size"
                  onClick={() =>
                    updatePref("font", Math.max(85, currentFontScale - 5))
                  }
                  className="px-2.5 py-1 rounded border border-current/20 text-xs font-bold hover:border-emerald-500"
                >
                  A-
                </button>
                <input
                  id="text-scale-slider"
                  type="range"
                  min="85"
                  max="140"
                  step="5"
                  value={currentFontScale}
                  onChange={(e) => updatePref("font", Number(e.target.value))}
                  className="flex-1 accent-emerald-600 cursor-pointer"
                />
                <button
                  type="button"
                  aria-label="Increase text size"
                  onClick={() =>
                    updatePref("font", Math.min(140, currentFontScale + 5))
                  }
                  className="px-2.5 py-1 rounded border border-current/20 text-xs font-bold hover:border-emerald-500"
                >
                  A+
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 bg-black/10 p-1 rounded-lg">
                {[
                  { label: "85%", val: 85 },
                  { label: "100%", val: 100 },
                  { label: "120%", val: 120 },
                  { label: "140%", val: 140 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    aria-pressed={currentFontScale === preset.val}
                    onClick={() => updatePref("font", preset.val)}
                    className={`py-1 text-xs font-semibold rounded-md ${
                      currentFontScale === preset.val
                        ? "bg-emerald-600 text-white"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-2 ${CARD_BG[prefs.theme]}`}
            >
              <div className="text-xs font-bold">Private Mode Security</div>
              <div className="text-xs opacity-75">
                {privateMeta
                  ? "Private Space is protected with an AES-256-GCM password."
                  : "Set up a password to unlock a separate encrypted space like iOS Safari."}
              </div>
              {privateMeta ? (
                <button
                  type="button"
                  onClick={() => openPrivateModal("remove")}
                  className="w-full py-1.5 rounded-lg border border-red-500/40 text-red-500 text-xs font-semibold hover:bg-red-500/10"
                >
                  Reset Private Space &amp; Delete Private Data
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openPrivateModal("setup")}
                  className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                >
                  Set Up Private Mode
                </button>
              )}
            </div>

            <div
              className={`p-3 rounded-xl border space-y-2 ${CARD_BG[prefs.theme]}`}
            >
              <div className="text-xs font-bold">Data &amp; Backup</div>
              <div className="text-xs opacity-75">
                {items.filter((i) => !i.isPrivate).length} standard items
                {items.some((i) => i.isPrivate)
                  ? ` · ${items.filter((i) => i.isPrivate).length} encrypted private items (password required to export)`
                  : ""}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={exportBackup}
                  className="py-1.5 rounded-lg border border-current/20 text-xs font-semibold hover:border-emerald-500"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => fileImportRef.current?.click()}
                  className="py-1.5 rounded-lg border border-current/20 text-xs font-semibold hover:border-emerald-500"
                >
                  Import JSON
                </button>
                <input
                  ref={fileImportRef}
                  type="file"
                  accept=".json"
                  onChange={importBackup}
                  className="hidden"
                />
              </div>
            </div>

            {/* DANGER ZONE: Delete All Data */}
            <div
              className={`p-3 rounded-xl border border-red-500/35 space-y-2 ${CARD_BG[prefs.theme]}`}
            >
              <div className="text-xs font-bold text-red-500">Danger Zone</div>
              <div className="text-xs opacity-75">
                Permanently remove all links, folders, reminders, and Private
                Mode data from this browser.
              </div>
              <button
                type="button"
                disabled={items.length === 0 && !privateMeta}
                onClick={() => {
                  setWipePass("");
                  setWipeError("");
                  setWipeShake(false);
                  setWipeStage("confirm");
                }}
                className={`w-full py-2 rounded-lg text-xs font-bold transition ${
                  items.length === 0 && !privateMeta
                    ? "bg-slate-400/30 text-slate-400 cursor-not-allowed"
                    : "bg-red-600/15 border border-red-500/40 text-red-500 hover:bg-red-600 hover:text-white"
                }`}
              >
                Delete All Data
              </button>
            </div>
          </div>
        </>
      ) : view === "detail" && detailItem ? (
        /* FULL REMINDER ALERT & DETAIL VIEW */
        <>
          <div
            className={`flex items-center justify-between px-3.5 py-2.5 border-b shrink-0 ${CARD_BG[prefs.theme]}`}
          >
            <button
              onClick={() => setView("home")}
              className="text-xs font-bold text-emerald-600 bg-emerald-500/15 px-3 py-1.5 rounded-md"
            >
              ← Back to TabVault
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
              <span>⏰</span>
              <span>Scheduled Reminder</span>
            </span>
          </div>

          <div className="p-3.5 flex-1 flex flex-col gap-3 overflow-y-auto">
            <div
              className={`p-3.5 rounded-xl border border-t-4 border-t-red-500 space-y-2.5 ${CARD_BG[prefs.theme]}`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-500 font-bold uppercase">
                  Alarm Triggered
                </span>
                <span className="opacity-80 font-semibold">
                  {formatReminderTime(detailItem.reminderTime)}
                </span>
              </div>

              {getYouTubeThumb(detailItem.url) && (
                <img
                  src={getYouTubeThumb(detailItem.url)}
                  alt=""
                  className="w-full max-h-40 object-cover rounded-lg"
                />
              )}

              <div>
                <div className="text-xs opacity-70 mb-0.5">
                  You scheduled a reminder for this link:
                </div>
                <h2 className="text-base font-bold leading-snug">
                  {detailItem.note || formatDomain(detailItem.url)}
                </h2>
              </div>

              {formatRepeatLabel(detailItem.repeat) && (
                <div className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                  ↻ {formatRepeatLabel(detailItem.repeat)}
                </div>
              )}

              <a
                href={detailItem.url}
                target="_blank"
                rel="noreferrer"
                className="block text-xs text-emerald-600 break-all underline"
              >
                {detailItem.url}
              </a>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => {
                    if (chrome?.windows && chrome?.tabs) {
                      const wins = await chrome.windows.getAll({
                        windowTypes: ["normal"],
                      });
                      if (wins.length)
                        await chrome.tabs.create({
                          windowId: wins[0].id,
                          url: detailItem.url,
                          active: true,
                        });
                      else
                        await chrome.windows.create({
                          url: detailItem.url,
                          focused: false,
                        });
                    } else window.open(detailItem.url, "_blank");
                    notify("Opened in new tab");
                  }}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  Open Link in New Tab ↗
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(detailItem.url);
                    notify("Copied URL");
                  }}
                  className="px-3 py-2 rounded-lg border border-current/20 text-xs font-semibold"
                >
                  Copy
                </button>
                <button
                  onClick={() => openEditor(detailItem)}
                  className="px-3 py-2 rounded-lg border border-current/20 text-xs font-semibold hover:border-emerald-500"
                >
                  Edit
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase opacity-75 mb-1.5">
                Snooze Reminder
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[10, 30, 60].map((m) => (
                  <button
                    key={m}
                    onClick={async () => {
                      await snoozeMinutes(detailItem, m);
                      setView("home");
                    }}
                    className={`py-2 rounded-lg border text-xs font-semibold hover:border-emerald-500 ${CARD_BG[prefs.theme]}`}
                  >
                    +{m === 60 ? "1 hour" : `${m} min`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
              <button
                onClick={async () => {
                  await advanceOrDismiss(detailItem);
                  setView("home");
                }}
                className="py-2 rounded-lg bg-emerald-600/15 text-emerald-600 text-xs font-bold hover:bg-emerald-600/25"
              >
                Mark as Done
              </button>
              <button
                onClick={() => deleteItem(detailItem.id)}
                className="py-2 rounded-lg bg-red-500/15 text-red-500 text-xs font-bold hover:bg-red-500/25"
              >
                Delete Link
              </button>
            </div>
          </div>
        </>
      ) : (
        /* MAIN TABBED SHELL (Home / Links / Folders / Calendar) */
        <>
          <header
            className={`flex items-center justify-between gap-1 px-2.5 py-2 border-b shrink-0 transition-colors ${
              isPrivateMode
                ? "bg-indigo-950 text-white border-indigo-800"
                : CARD_BG[prefs.theme]
            }`}
          >
            <button
              onClick={() => setView("home")}
              className="flex items-center gap-1.5 font-bold text-sm hover:opacity-90 shrink-0"
            >
              <img
                src="icon48.png"
                alt="TabVault"
                className="w-5 h-5 rounded shrink-0"
              />
              <span>{isPrivateMode ? "Private" : "TabVault"}</span>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <nav
                aria-label="Main navigation"
                className="flex bg-black/15 p-0.5 rounded-lg"
              >
                {[
                  { id: "home", label: "Home" },
                  { id: "links", label: "Links" },
                  { id: "folders", label: "Folders" },
                  { id: "calendar", label: "Calendar" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    aria-current={view === tab.id ? "page" : undefined}
                    onClick={() => {
                      if (tab.id === "links") setLinkFilter("all");
                      setView(tab.id);
                    }}
                    className={`px-1.5 py-1 rounded-md text-xs font-semibold ${
                      view === tab.id
                        ? isPrivateMode
                          ? "bg-indigo-500 text-white"
                          : "bg-emerald-600 text-white"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              {isPrivateMode ? (
                <button
                  onClick={exitPrivateMode}
                  title="Lock and return to Standard mode"
                  className="px-2 py-1 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-xs font-bold text-indigo-100 hover:bg-indigo-500/45 shrink-0 flex items-center gap-1"
                >
                  <span>🔒</span>
                  <span>Lock</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    openPrivateModal(privateMeta ? "unlock" : "setup")
                  }
                  title="Switch to Private Mode"
                  aria-label="Switch to Private Mode"
                  className="px-2 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/35 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25 shrink-0 flex items-center gap-1 transition"
                >
                  <span>🛡️</span>
                  <span>Private</span>
                </button>
              )}

              <button
                onClick={() => setView("settings")}
                aria-label="Open settings"
                className="p-1.5 rounded-lg border border-current/20 opacity-85 hover:opacity-100 shrink-0"
                title="Settings"
              >
                ⚙
              </button>
            </div>
          </header>

          {dueItem && (
            <div
              role="alert"
              className="mx-3 mt-2.5 p-3 rounded-xl border border-red-500/40 bg-red-600/12 shrink-0 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    ⏰
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-red-500 uppercase tracking-wider">
                      Reminder Due
                    </div>
                    <div className="text-xs font-bold truncate">
                      {dueItem.note || formatDomain(dueItem.url)}
                    </div>
                    <div className="text-xs opacity-75 truncate">
                      {formatDomain(dueItem.url)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setDetailItemId(dueItem.id);
                    setView("detail");
                  }}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  Open
                </button>
                <button
                  onClick={() => snoozeMinutes(dueItem, 10)}
                  className="py-1.5 px-2.5 rounded-lg border border-current/20 text-xs font-semibold hover:border-emerald-500"
                >
                  +10m
                </button>
                <button
                  onClick={() => advanceOrDismiss(dueItem)}
                  className="py-1.5 px-2.5 rounded-lg border border-current/20 text-xs font-semibold hover:bg-red-500/15 hover:text-red-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* HOME VIEW */}
          {view === "home" && (
            <>
              <section
                className={`p-3 border-b shrink-0 space-y-2 ${CARD_BG[prefs.theme]} ${shakeForm && !useReminder ? "animate-shake" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                      {isPrivateMode ? "Private Capture" : "Quick Capture"}
                    </span>
                    {hasUnsavedDraft && (
                      <button
                        onClick={async () => {
                          await resetFormAndDraft();
                          notify("Draft cleared");
                        }}
                        className="text-xs font-semibold text-amber-600 hover:underline"
                      >
                        Clear draft
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={fillCurrentTabAddress}
                    className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600/25"
                  >
                    Get Current Tab
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    aria-label="Website URL"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste a URL or tap Get Current Tab..."
                    className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border bg-transparent outline-none ${
                      isUrlInvalid
                        ? "border-red-500 ring-1 ring-red-500"
                        : "border-current/20 focus:border-emerald-500"
                    }`}
                  />
                  {!useReminder && (
                    <button
                      onClick={() =>
                        saveLink({
                          rawUrl: urlInput,
                          withSchedule: false,
                          targetFolder: saveTargetFolder || null,
                        })
                      }
                      disabled={!urlInput.trim() || isUrlInvalid}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        !urlInput.trim() || isUrlInvalid
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      Save
                    </button>
                  )}
                </div>

                {isUrlInvalid && (
                  <div
                    role="alert"
                    className="text-xs text-red-500 font-medium"
                  >
                    ⚠️ Enter a valid web link (must include a domain like .com
                    or .se)
                  </div>
                )}

                <input
                  aria-label="Title or note"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Optional title or note (auto-detected if empty)..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                />

                {/* Location Row Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch("");
                    setPickerCreatingFolder(false);
                    setPickerBrowseFolderId(null);
                    setFolderPickerOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg border border-current/20 hover:border-emerald-500 transition text-left"
                >
                  <span className="font-semibold opacity-80">Location</span>
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600 truncate max-w-[65%]">
                    <span className="truncate">
                      {saveTargetFolder
                        ? `📁 ${getFolderPath(saveTargetFolder)}`
                        : "Links (No folder)"}
                    </span>
                    <span className="opacity-70 shrink-0">›</span>
                  </span>
                </button>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useReminder}
                    onChange={(e) => {
                      setUseReminder(e.target.checked);
                      if (e.target.checked)
                        setRepeatCfg((r) => ({
                          ...r,
                          date: toDateKey(new Date()),
                          time: defaultTimePlus(2),
                        }));
                    }}
                    className="accent-emerald-600"
                  />
                  <span>Set reminder &amp; repeat schedule</span>
                </label>

                {useReminder && (
                  <div className={shakeForm ? "animate-shake" : ""}>
                    <RepeatPicker value={repeatCfg} onChange={setRepeatCfg} />
                    <button
                      onClick={() =>
                        saveLink({
                          rawUrl: urlInput,
                          withSchedule: true,
                          targetFolder: saveTargetFolder || null,
                        })
                      }
                      disabled={isHomePast || !urlInput.trim() || isUrlInvalid}
                      className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition ${
                        isHomePast || !urlInput.trim() || isUrlInvalid
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      Save Link + Schedule Reminder
                    </button>
                  </div>
                )}
              </section>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "Favorites ★",
                      count: favoriteCount,
                      accent: "text-amber-500",
                      go: () => {
                        setLinkFilter("favorites");
                        setView("links");
                      },
                    },
                    {
                      label: "All Links",
                      count: regularLinks.length,
                      accent: "text-emerald-600",
                      go: () => {
                        setLinkFilter("all");
                        setView("links");
                      },
                    },
                    {
                      label: "Folders",
                      count: spaceFolders.length,
                      accent: "text-emerald-600",
                      go: openFoldersRoot,
                    },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={s.go}
                      className={`p-2 rounded-xl border text-center hover:border-emerald-500 transition ${CARD_BG[prefs.theme]}`}
                    >
                      <div className={`text-base font-bold ${s.accent}`}>
                        {s.count}
                      </div>
                      <div className="text-xs font-semibold opacity-80">
                        {s.label}
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                      Upcoming Reminders ({upcomingReminders.length})
                    </span>
                    <button
                      onClick={() => setView("reminders")}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      Show all →
                    </button>
                  </div>
                  {upcomingReminders.length === 0 ? (
                    <div
                      className={`p-4 rounded-xl border text-center text-xs opacity-75 ${CARD_BG[prefs.theme]}`}
                    >
                      No upcoming reminders scheduled.
                    </div>
                  ) : (
                    <ul>
                      {upcomingReminders
                        .slice(0, 3)
                        .map((i) => renderLinkRow(i, false, true))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ALL LINKS + SEARCH VIEW */}
          {view === "links" && (
            <>
              <div
                className={`p-3 border-b space-y-2 shrink-0 ${CARD_BG[prefs.theme]}`}
              >
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs opacity-65">
                    🔍
                  </span>
                  <input
                    type="text"
                    aria-label="Search links by title or URL"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search saved links by title or URL..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-2 text-xs opacity-75 hover:opacity-100 px-1"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div
                    role="group"
                    aria-label="Filter links"
                    className="flex flex-wrap gap-1 bg-black/10 p-0.5 rounded-lg"
                  >
                    {[
                      { id: "all", label: "All Links" },
                      { id: "favorites", label: "★ Favorites" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={linkFilter === f.id}
                        onClick={() => setLinkFilter(f.id)}
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          linkFilter === f.id
                            ? "bg-emerald-600 text-white"
                            : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-semibold opacity-75 shrink-0">
                    {searchedLinks.length}
                  </span>
                </div>
              </div>

              <ul className="flex-1 overflow-y-auto p-3">
                {searchedLinks.length === 0 ? (
                  <li className="text-center text-xs opacity-75 py-10">
                    {search.trim()
                      ? `No links matching "${search.trim()}"`
                      : linkFilter === "favorites"
                        ? "No favorite links yet. Tap ☆ on any link to favorite it."
                        : "No saved links yet."}
                  </li>
                ) : (
                  searchedLinks.map((i) => renderLinkRow(i, false, true))
                )}
              </ul>
            </>
          )}

          {/* FOLDERS VIEW */}
          {view === "folders" && (
            <>
              <section
                className={`p-2.5 border-b space-y-2 shrink-0 ${CARD_BG[prefs.theme]} ${shakeForm ? "animate-shake" : ""}`}
              >
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs opacity-65">
                    🔍
                  </span>
                  <input
                    type="text"
                    aria-label="Search folders by name"
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    placeholder="Search folders by name..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
                  />
                  {folderSearch && (
                    <button
                      onClick={() => setFolderSearch("")}
                      aria-label="Clear folder search"
                      className="absolute right-2 text-xs opacity-75 hover:opacity-100 px-1"
                      title="Clear folder search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {!folderSearch.trim() && folderId && (
                  <>
                    <div className="flex gap-1.5">
                      <input
                        aria-label="Save URL into this folder"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Save URL into this folder..."
                        className={`flex-1 px-2.5 py-1 text-xs rounded-lg border bg-transparent outline-none ${
                          isUrlInvalid
                            ? "border-red-500 ring-1 ring-red-500"
                            : "border-current/20"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={fillCurrentTabAddress}
                        className="px-2 py-1 rounded-lg bg-emerald-600/15 text-emerald-600 text-xs font-bold shrink-0 whitespace-nowrap"
                      >
                        Get Tab
                      </button>
                      <button
                        onClick={() =>
                          saveLink({ rawUrl: urlInput, targetFolder: folderId })
                        }
                        disabled={!urlInput.trim() || isUrlInvalid}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          !urlInput.trim() || isUrlInvalid
                            ? "bg-slate-400 text-white cursor-not-allowed"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        Save
                      </button>
                    </div>
                    {isUrlInvalid && (
                      <div
                        role="alert"
                        className="text-xs text-red-500 font-medium"
                      >
                        ⚠️ Enter a valid web link (e.g. github.com)
                      </div>
                    )}
                  </>
                )}
              </section>

              {folderSearch.trim() ? (
                <ul className="flex-1 overflow-y-auto p-3">
                  <div className="text-xs font-bold uppercase tracking-wider opacity-75 mb-2">
                    Matching Folders ({matchingFolders.length})
                  </div>
                  {matchingFolders.length === 0 ? (
                    <li className="text-center text-xs opacity-75 py-8">
                      No folders matching "{folderSearch.trim()}"
                    </li>
                  ) : (
                    matchingFolders.map((folder) => {
                      const childCount = spaceItems.filter(
                        (i) => i.parentId === folder.id,
                      ).length;
                      const path = getFolderPath(folder.parentId);
                      return (
                        <li
                          key={folder.id}
                          className={`flex items-center justify-between p-2.5 mb-1.5 rounded-lg border ${CARD_BG[prefs.theme]}`}
                        >
                          <button
                            onClick={() => {
                              setFolderId(folder.id);
                              setFolderSearch("");
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:text-emerald-600"
                          >
                            <span>📁</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate">
                                {folder.name}
                              </div>
                              <div className="text-xs opacity-75 truncate">
                                {path ? `Root / ${path}` : "Root"} ·{" "}
                                {childCount}{" "}
                                {childCount === 1 ? "item" : "items"}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setFolderId(folder.id);
                              setFolderSearch("");
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600/15 text-emerald-600 text-xs font-bold shrink-0"
                          >
                            Open
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-current/10 text-xs shrink-0">
                    <nav
                      aria-label="Folder breadcrumbs"
                      className="flex items-center gap-1 overflow-x-auto font-semibold"
                    >
                      <button
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() =>
                          dragId &&
                          persistItems(
                            items.map((i) =>
                              i.id === dragId ? { ...i, parentId: null } : i,
                            ),
                          )
                        }
                        onClick={() => setFolderId(null)}
                        className="hover:text-emerald-600"
                      >
                        Folders
                      </button>
                      {breadcrumbs.map((f) => (
                        <span key={f.id} className="flex items-center gap-1">
                          <span className="opacity-55">/</span>
                          <button
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() =>
                              dragId &&
                              dragId !== f.id &&
                              persistItems(
                                items.map((i) =>
                                  i.id === dragId
                                    ? { ...i, parentId: f.id }
                                    : i,
                                ),
                              )
                            }
                            onClick={() => setFolderId(f.id)}
                            className="hover:text-emerald-600"
                          >
                            {f.name}
                          </button>
                        </span>
                      ))}
                    </nav>
                    <button
                      onClick={() => {
                        setCreatingFolder(true);
                        setNewFolderName("");
                      }}
                      className="px-2.5 py-1 rounded border border-current/20 text-xs font-semibold hover:border-emerald-500 shrink-0"
                    >
                      + Folder
                    </button>
                  </div>

                  {creatingFolder && (
                    <div
                      className={`flex items-center gap-1.5 px-3.5 py-2 border-b ${CARD_BG[prefs.theme]}`}
                    >
                      <span className="text-xs">📁</span>
                      <input
                        type="text"
                        aria-label="New folder name"
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateFolder();
                          if (e.key === "Escape") setCreatingFolder(false);
                        }}
                        placeholder="New folder name..."
                        className="flex-1 px-2 py-1 text-xs rounded border border-emerald-500 bg-transparent outline-none"
                      />
                      <button
                        onClick={handleCreateFolder}
                        disabled={!newFolderName.trim()}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          newFolderName.trim()
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-400 text-white cursor-not-allowed"
                        }`}
                      >
                        Create
                      </button>
                      <button
                        onClick={() => setCreatingFolder(false)}
                        className="px-2 py-1 rounded border border-current/20 text-xs font-semibold opacity-80 hover:opacity-100"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <ul className="flex-1 overflow-y-auto p-3">
                    {folderChildren.length === 0 && !creatingFolder && (
                      <li className="text-center text-xs opacity-75 py-8">
                        {folderId
                          ? "This folder is empty."
                          : "No folders yet. Tap + Folder to create one."}
                      </li>
                    )}
                    {folderChildren.map((item) =>
                      item.type === "folder" ? (
                        <li
                          key={item.id}
                          draggable={renamingFolderId !== item.id}
                          onDragStart={() => setDragId(item.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() =>
                            dragId &&
                            dragId !== item.id &&
                            persistItems(
                              items.map((i) =>
                                i.id === dragId
                                  ? { ...i, parentId: item.id }
                                  : i,
                              ),
                            )
                          }
                          className={`flex items-center justify-between gap-1.5 p-2.5 mb-1.5 rounded-lg border ${CARD_BG[prefs.theme]}`}
                        >
                          {renamingFolderId === item.id ? (
                            <>
                              <span className="text-xs">📁</span>
                              <input
                                type="text"
                                aria-label="Rename folder"
                                autoFocus
                                value={renameFolderVal}
                                onChange={(e) =>
                                  setRenameFolderVal(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleRenameFolder(item.id);
                                  if (e.key === "Escape")
                                    setRenamingFolderId(null);
                                }}
                                className="flex-1 px-2 py-0.5 text-xs rounded border border-emerald-500 bg-transparent outline-none"
                              />
                              <button
                                onClick={() => handleRenameFolder(item.id)}
                                disabled={!renameFolderVal.trim()}
                                className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setRenamingFolderId(null)}
                                className="px-2 py-0.5 rounded border border-current/20 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setFolderId(item.id)}
                                className="flex items-center gap-2 font-semibold text-xs hover:text-emerald-600 truncate flex-1 text-left"
                              >
                                <span>📁</span>
                                <span className="truncate">{item.name}</span>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    setRenamingFolderId(item.id);
                                    setRenameFolderVal(item.name);
                                  }}
                                  className="text-xs px-2 py-0.5 rounded border border-current/20 opacity-85 hover:opacity-100 hover:border-emerald-500"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="text-xs px-2 py-0.5 rounded border border-current/20 hover:text-red-500"
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      ) : (
                        renderLinkRow(item, true)
                      ),
                    )}
                  </ul>
                </>
              )}
            </>
          )}

          {/* CALENDAR VIEW */}
          {view === "calendar" && (
            <div className="flex-1 overflow-y-auto">
              {!(calAddOpen && repeatCfg.type === "weekly") && (
                <div className={`px-3.5 py-2 border-b ${CARD_BG[prefs.theme]}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      aria-label="Previous month"
                      onClick={() =>
                        setCalMonth(
                          new Date(
                            calMonth.getFullYear(),
                            calMonth.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                      className="px-2.5 py-0.5 rounded border border-current/20"
                    >
                      ‹
                    </button>
                    <span className="text-xs font-bold">
                      {calMonth.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      aria-label="Next month"
                      onClick={() =>
                        setCalMonth(
                          new Date(
                            calMonth.getFullYear(),
                            calMonth.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                      className="px-2.5 py-0.5 rounded border border-current/20"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs font-bold opacity-75 mb-1">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d) => (
                        <span key={d}>{d}</span>
                      ),
                    )}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`e-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                      (day) => {
                        const key = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const hasItems = spaceLinks.some((it) =>
                          occursOnDate(it, key),
                        );
                        const isPastDay = key < todayKey;
                        const isBlocked = isPastDay && !isCalMonthlyMulti;
                        const isSelected = isCalMonthlyMulti
                          ? repeatCfg.daysOfMonth.includes(day)
                          : selectedDate === key;

                        return (
                          <button
                            key={key}
                            disabled={isBlocked}
                            aria-label={key}
                            aria-pressed={isSelected}
                            onClick={() => {
                              if (isBlocked) return;
                              setSelectedDate(key);
                              const dObj = new Date(`${key}T00:00:00`);
                              if (isCalMonthlyMulti) {
                                const exists =
                                  repeatCfg.daysOfMonth.includes(day);
                                if (
                                  exists &&
                                  repeatCfg.daysOfMonth.length === 1 &&
                                  !repeatCfg.lastDayOfMonth
                                )
                                  return;
                                const nextDays = exists
                                  ? repeatCfg.daysOfMonth.filter(
                                      (x) => x !== day,
                                    )
                                  : [...repeatCfg.daysOfMonth, day];
                                setRepeatCfg((r) => ({
                                  ...r,
                                  date: key,
                                  daysOfMonth: nextDays,
                                }));
                              } else {
                                setRepeatCfg((r) => ({
                                  ...r,
                                  date: key,
                                  daysOfWeek: [dObj.getDay()],
                                  daysOfMonth: [dObj.getDate()],
                                  lastDayOfMonth: false,
                                }));
                              }
                            }}
                            className={`h-8 rounded text-xs font-medium relative flex items-center justify-center transition ${
                              isBlocked
                                ? "opacity-30 cursor-not-allowed line-through"
                                : isSelected
                                  ? "bg-emerald-600 text-white font-bold"
                                  : key === todayKey
                                    ? "border border-emerald-500 font-bold"
                                    : "hover:bg-emerald-500/10"
                            }`}
                          >
                            {day}
                            {hasItems && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                                  isSelected ? "bg-white" : "bg-emerald-500"
                                }`}
                              />
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              <div
                className={`flex items-center justify-between px-3.5 py-2 border-b border-current/10 text-xs font-bold sticky top-0 z-10 ${CARD_BG[prefs.theme]}`}
              >
                <span>
                  {calAddOpen && repeatCfg.type === "weekly"
                    ? "Weekly Schedule"
                    : isCalMonthlyMulti
                      ? `Monthly (${repeatCfg.daysOfMonth.length} day${repeatCfg.daysOfMonth.length === 1 ? "" : "s"} selected)`
                      : new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                </span>
                <button
                  onClick={async () => {
                    const nextOpen = !calAddOpen;
                    if (!nextOpen) {
                      setCalAddOpen(false);
                      await resetFormAndDraft();
                      return;
                    }
                    if (selectedDate < todayKey) {
                      setSelectedDate(todayKey);
                      setRepeatCfg((r) => ({ ...r, date: todayKey }));
                    }
                    setCalAddOpen(true);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-600/15 text-emerald-600 text-xs"
                >
                  {calAddOpen ? "Close" : "+ Add Reminder Here"}
                </button>
              </div>

              {calAddOpen && (
                <div
                  className={`p-2.5 border-b space-y-2 ${CARD_BG[prefs.theme]} ${shakeForm ? "animate-shake" : ""}`}
                >
                  <div className="flex gap-1.5">
                    <input
                      aria-label="Website URL"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste URL or tap Get Tab..."
                      className={`flex-1 px-2 py-1 text-xs rounded border bg-transparent ${
                        isUrlInvalid
                          ? "border-red-500 ring-1 ring-red-500"
                          : "border-current/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={fillCurrentTabAddress}
                      className="px-2 py-1 rounded bg-emerald-600/15 text-emerald-600 text-xs font-bold shrink-0"
                    >
                      Get Tab
                    </button>
                    <input
                      type="time"
                      aria-label="Reminder time"
                      value={repeatCfg.time}
                      onChange={(e) =>
                        setRepeatCfg({ ...repeatCfg, time: e.target.value })
                      }
                      className={`px-2 py-1 text-xs rounded border bg-white/90 text-slate-900 ${
                        isCalPast
                          ? "border-red-500 ring-1 ring-red-500"
                          : "border-current/20"
                      }`}
                    />
                  </div>
                  {isUrlInvalid && (
                    <div
                      role="alert"
                      className="text-xs text-red-500 font-medium"
                    >
                      ⚠️ Enter a valid URL
                    </div>
                  )}
                  <RepeatPicker
                    value={repeatCfg}
                    onChange={setRepeatCfg}
                    inCalendar
                    selectedDate={selectedDate}
                  />
                  <div className="flex gap-1.5">
                    <input
                      aria-label="Title or note"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Title or note..."
                      className="flex-1 px-2 py-1 text-xs rounded border border-current/20 bg-transparent"
                    />
                    <button
                      disabled={isCalPast || isUrlInvalid || !urlInput.trim()}
                      onClick={async () => {
                        const ok = await saveLink({
                          rawUrl: urlInput,
                          withSchedule: true,
                          customDate: selectedDate,
                        });
                        if (ok) setCalAddOpen(false);
                      }}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        isCalPast || isUrlInvalid || !urlInput.trim()
                          ? "bg-slate-400 text-white cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              <ul className="p-3">
                {(calAddOpen && repeatCfg.type === "weekly"
                  ? spaceLinks.filter(
                      (i) => i.repeat?.type === "weekly" && !i.dismissed,
                    )
                  : spaceLinks.filter((i) => occursOnDate(i, selectedDate))
                ).map((i) => renderLinkRow(i))}
              </ul>
            </div>
          )}
        </>
      )}

      {toast.msg && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg whitespace-nowrap z-40 ${
            toast.error ? "bg-red-600" : "bg-slate-900"
          }`}
        >
          {toast.error ? `⚠️ ${toast.msg}` : toast.msg}
        </div>
      )}
    </div>
  );
}
