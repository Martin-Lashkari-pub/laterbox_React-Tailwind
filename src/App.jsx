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
  compact: { w: 380, h: 500 },
  standard: { w: 430, h: 560 },
  large: { w: 500, h: 600 },
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

  const notify = (msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast({ msg: "", error: false }), 2800);
  };

  const triggerFormError = (msg) => {
    setShakeForm(true);
    notify(msg, true);
    setTimeout(() => setShakeForm(false), 350);
  };

  useEffect(() => {
    storage.load().then(({ laterBoxItems, laterBoxPrefs, laterBoxDraft }) => {
      const loadedItems = laterBoxItems || [];
      setItems(loadedItems);
      if (laterBoxPrefs) setPrefs((p) => ({ ...p, ...laterBoxPrefs }));

      if (laterBoxDraft) {
        if (
          laterBoxDraft.view &&
          ["home", "links", "folders", "calendar"].includes(laterBoxDraft.view)
        ) {
          setView(laterBoxDraft.view);
        }
        if (laterBoxDraft.folderId) {
          const folderExists = loadedItems.some(
            (i) => i.type === "folder" && i.id === laterBoxDraft.folderId,
          );
          setFolderId(folderExists ? laterBoxDraft.folderId : null);
        }
        if (laterBoxDraft.urlInput) setUrlInput(laterBoxDraft.urlInput);
        if (laterBoxDraft.noteInput) setNoteInput(laterBoxDraft.noteInput);
        if (laterBoxDraft.useReminder)
          setUseReminder(laterBoxDraft.useReminder);
        if (laterBoxDraft.repeatCfg) setRepeatCfg(laterBoxDraft.repeatCfg);
        if (laterBoxDraft.selectedDate) {
          setSelectedDate(laterBoxDraft.selectedDate);
          const [y, m] = laterBoxDraft.selectedDate.split("-").map(Number);
          if (y && m) setCalMonth(new Date(y, m - 1, 1));
        }
        if (laterBoxDraft.calAddOpen) setCalAddOpen(laterBoxDraft.calAddOpen);
      }
      setStorageReady(true);
    });

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
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    storage.saveDraft({
      view: ["settings", "detail", "edit"].includes(view) ? "home" : view,
      folderId,
      urlInput,
      noteInput,
      useReminder,
      repeatCfg,
      selectedDate,
      calAddOpen,
    });
  }, [
    storageReady,
    view,
    folderId,
    urlInput,
    noteInput,
    useReminder,
    repeatCfg,
    selectedDate,
    calAddOpen,
  ]);

  useEffect(() => {
    const base = SIZES[prefs.size] || SIZES.standard;
    const scalePct = resolveFontScale(prefs.font);
    const scaleFactor = Math.max(1, scalePct / 100);

    const scaledWidth = Math.min(780, Math.round(base.w * scaleFactor));
    const scaledHeight = Math.min(600, Math.round(base.h * scaleFactor));

    document.documentElement.style.width = `${scaledWidth}px`;
    document.documentElement.style.height = `${scaledHeight}px`;
    document.documentElement.style.fontSize = `${(16 * scalePct) / 100}px`;
  }, [prefs]);

  useEffect(() => {
    if (!storageReady) return;
    const timer = setInterval(() => {
      const now = Date.now();
      let triggered = false;
      const updated = items.map((i) => {
        if (
          i.type === "link" &&
          i.reminderTime &&
          i.reminderTime <= now &&
          !i.dismissed &&
          !i.alertedInPopup
        ) {
          triggered = true;
          return { ...i, alertedInPopup: true };
        }
        return i;
      });
      if (triggered) {
        playTone(prefs.sound, 3);
        persistItems(updated);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [storageReady, items, prefs.sound]);

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
      chrome.alarms.create(`laterbox_${item.id}`, {
        when: Math.max(item.reminderTime, Date.now() + 1000),
      });
    }
  };

  const resetFormAndDraft = async () => {
    setUrlInput("");
    setNoteInput("");
    setUseReminder(false);
    setRepeatCfg(createDefaultRepeat());
    await storage.clearDraft();
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
    const newItem = {
      id: genId(),
      type: "link",
      url: cleanUrl,
      parentId: targetFolder,
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

    const next = [...items, newItem];
    await persistItems(next);
    if (reminderTime) {
      scheduleChromeAlarm(newItem);
      notify(`Next alert: ${formatReminderTime(reminderTime)}`);
    } else {
      notify("Link saved");
    }

    if (
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

  const saveCurrentTab = (
    withSchedule = false,
    targetFolder = null,
    customDate = null,
    onSuccess = null,
  ) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.url) {
          const ok = await saveLink({
            rawUrl: tabs[0].url,
            fallbackTitle: tabs[0].title || "",
            withSchedule,
            targetFolder,
            customDate,
          });
          if (ok && onSuccess) onSuccess();
        }
      });
    }
  };

  const openEditor = (item) => {
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
    const next = items.map((x) => {
      if (x.id !== editingItemId) return x;
      updatedRecord = {
        ...x,
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
    });

    await persistItems(next);
    if (updatedRecord) {
      if (updatedRecord.reminderTime) {
        scheduleChromeAlarm(updatedRecord);
      } else {
        chrome?.alarms?.clear(`laterbox_${updatedRecord.id}`);
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
    await persistItems([
      ...items,
      { id: genId(), type: "folder", name: trimmed, parentId: folderId },
    ]);
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
    await persistItems(
      items.map((x) => (x.id === id ? { ...x, name: trimmed } : x)),
    );
    setRenamingFolderId(null);
    notify("Folder renamed");
  };

  const toggleFavorite = async (item) => {
    const nextFav = !item.favorite;
    await persistItems(
      items.map((x) => (x.id === item.id ? { ...x, favorite: nextFav } : x)),
    );
    notify(nextFav ? "Added to favorites" : "Removed from favorites");
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
      chrome?.alarms?.clear(`laterbox_${i.id}`);
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
    toDelete.forEach((delId) => chrome?.alarms?.clear(`laterbox_${delId}`));
    const remaining = items.filter((i) => !toDelete.has(i.id));
    await persistItems(remaining, remaining.length === 0);
    if (toDelete.has(folderId)) setFolderId(null);
    if (detailItemId === id) setView("home");
    if (editingItemId === id) setView("home");
  };

  const exportBackup = () => {
    const payload = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), items, prefs },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laterbox-backup-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
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
        const existingIds = new Set(items.map((i) => i.id));
        const merged = sanitizeItems([
          ...items,
          ...importedItems.filter((i) => !existingIds.has(i.id)),
        ]);
        await persistItems(merged);
        notify(`Restored ${importedItems.length} items`);
      } catch {
        notify("Invalid backup JSON file", true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getFolderName = (parentId) => {
    if (!parentId) return "";
    const f = items.find((i) => i.id === parentId);
    return f ? f.name : "";
  };

  const getFolderPath = (targetId) => {
    const parts = [];
    let cur = targetId;
    while (cur) {
      const f = items.find((i) => i.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parentId;
    }
    return parts.join(" / ");
  };

  const dueItem = items.find(
    (i) =>
      i.type === "link" &&
      i.reminderTime &&
      i.reminderTime <= Date.now() &&
      !i.dismissed,
  );
  const detailItem = items.find((i) => i.id === detailItemId);

  const allFolders = useMemo(
    () =>
      items
        .filter((i) => i.type === "folder")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const favoriteCount = useMemo(
    () => items.filter((i) => i.type === "link" && i.favorite).length,
    [items],
  );

  const searchedLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => i.type === "link")
      .filter((i) => {
        if (linkFilter === "favorites") return Boolean(i.favorite);
        if (linkFilter === "scheduled")
          return Boolean(i.reminderTime && !i.dismissed);
        if (linkFilter === "unscheduled") return !i.reminderTime || i.dismissed;
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        return (
          (i.note || "").toLowerCase().includes(q) ||
          i.url.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items, search, linkFilter]);

  const matchingFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) => i.type === "folder" && (i.name || "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, folderSearch]);

  const upcomingReminders = useMemo(() => {
    return items
      .filter((i) => i.type === "link" && i.reminderTime && !i.dismissed)
      .sort((a, b) => a.reminderTime - b.reminderTime);
  }, [items]);

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
    urlInput.trim() || noteInput.trim() || useReminder || calAddOpen,
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

  /* FULL INLINE LINK & REMINDER EDITOR VIEW */
  if (view === "edit" && editingItemId) {
    return (
      <div
        className={`w-full h-full flex flex-col relative ${THEMES[prefs.theme]}`}
      >
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
                  Root (No folder)
                </option>
                {allFolders.map((f) => (
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
              <RepeatPicker value={editRepeatCfg} onChange={setEditRepeatCfg} />
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

        {toast.msg && (
          <div
            role="status"
            aria-live="polite"
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg whitespace-nowrap ${
              toast.error ? "bg-red-600" : "bg-slate-900"
            }`}
          >
            {toast.error ? `⚠️ ${toast.msg}` : toast.msg}
          </div>
        )}
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div
        className={`w-full h-full flex flex-col relative ${THEMES[prefs.theme]}`}
      >
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

          {/* Alert Sound + Integrated Test Alert & Sound button */}
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
                  iconUrl: "LaterBox-Ikon.png",
                  title: "LaterBox Test Alert",
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
              <label htmlFor="text-scale-slider" className="text-xs font-bold">
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
            <div className="text-xs font-bold">Data &amp; Backup</div>
            <div className="text-xs opacity-75">
              {items.filter((i) => i.type === "folder").length} folders ·{" "}
              {items.filter((i) => i.type === "link").length} links stored
              safely
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
        </div>

        {toast.msg && (
          <div
            role="status"
            aria-live="polite"
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg whitespace-nowrap ${
              toast.error ? "bg-red-600" : "bg-slate-900"
            }`}
          >
            {toast.error ? `⚠️ ${toast.msg}` : toast.msg}
          </div>
        )}
      </div>
    );
  }

  if (view === "detail" && detailItem) {
    const thumb = getYouTubeThumb(detailItem.url);
    return (
      <div className={`w-full h-full flex flex-col ${THEMES[prefs.theme]}`}>
        <div
          className={`flex items-center justify-between px-3.5 py-2.5 border-b ${CARD_BG[prefs.theme]}`}
        >
          <button
            onClick={() => setView("home")}
            className="text-xs font-bold text-emerald-600 bg-emerald-500/15 px-3 py-1.5 rounded-md"
          >
            ← Back to Home
          </button>
          <span className="text-xs font-bold uppercase tracking-wider opacity-75">
            Reminder
          </span>
        </div>

        <div className="p-3.5 flex-1 flex flex-col gap-3 overflow-y-auto">
          <div
            className={`p-3.5 rounded-xl border border-t-4 border-t-emerald-600 space-y-2.5 ${CARD_BG[prefs.theme]}`}
          >
            <div className="flex justify-between items-center text-xs">
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 font-bold uppercase">
                Reminder Due
              </span>
              <span className="opacity-80 font-semibold">
                {formatReminderTime(detailItem.reminderTime)}
              </span>
            </div>
            {thumb && (
              <img
                src={thumb}
                alt=""
                className="w-full max-h-40 object-cover rounded-lg"
              />
            )}
            <h2 className="text-base font-bold leading-snug">
              {detailItem.note || formatDomain(detailItem.url)}
            </h2>
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
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
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
              Snooze
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[10, 30, 60].map((m) => (
                <button
                  key={m}
                  onClick={async () => {
                    const nextTs = Date.now() + m * 60000;
                    const updated = {
                      ...detailItem,
                      reminderTime: nextTs,
                      reminderDate: toDateKey(new Date(nextTs)),
                      dismissed: false,
                      alertedInPopup: false,
                    };
                    scheduleChromeAlarm(updated);
                    await persistItems(
                      items.map((x) => (x.id === detailItem.id ? updated : x)),
                    );
                    setView("home");
                    notify(`Snoozed ${m} min`);
                  }}
                  className={`py-2 rounded-lg border text-xs font-semibold ${CARD_BG[prefs.theme]}`}
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
              className="py-2 rounded-lg bg-emerald-600/15 text-emerald-600 text-xs font-bold"
            >
              Mark as Done
            </button>
            <button
              onClick={() => deleteItem(detailItem.id)}
              className="py-2 rounded-lg bg-red-500/15 text-red-500 text-xs font-bold"
            >
              Delete Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  const breadcrumbs = [];
  let tempFolder = folderId;
  while (tempFolder) {
    const f = items.find((i) => i.id === tempFolder);
    if (f) {
      breadcrumbs.unshift(f);
      tempFolder = f.parentId;
    } else break;
  }

  const folderChildren = items
    .filter((i) => i.parentId === folderId)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "folder" ? -1 : 1));

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
      <header
        className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b shrink-0 ${CARD_BG[prefs.theme]}`}
      >
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 font-bold text-sm hover:text-emerald-600 shrink-0"
        >
          <img
            src="LaterBox-Ikon.png"
            alt="LaterBox"
            className="w-5 h-5 rounded shrink-0"
          />
          <span>LaterBox</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <nav
            aria-label="Main navigation"
            className="flex bg-black/10 p-0.5 rounded-lg"
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
                className={`px-2 py-1 rounded-md text-xs font-semibold ${
                  view === tab.id
                    ? "bg-emerald-600 text-white"
                    : "opacity-80 hover:opacity-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setView("settings")}
            aria-label="Open settings"
            className="p-1.5 rounded-lg border border-current/20 opacity-85 hover:opacity-100"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {dueItem && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 px-3.5 py-2 bg-red-600 text-white shrink-0"
        >
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">
              {dueItem.note || "Reminder Due"}
            </div>
            <div className="text-xs opacity-95 truncate">
              {formatDomain(dueItem.url)}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => {
                setDetailItemId(dueItem.id);
                setView("detail");
              }}
              className="px-2.5 py-1 bg-white text-slate-900 rounded text-xs font-bold"
            >
              Open
            </button>
            <button
              onClick={() => advanceOrDismiss(dueItem)}
              className="px-2 py-1 bg-white/20 rounded text-xs font-semibold"
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
                  Quick Capture
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
                onClick={() => saveCurrentTab(false, null)}
                className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600/25"
              >
                + Save Current Tab
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                aria-label="Website URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste a URL (e.g. youtube.com)..."
                className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border bg-transparent outline-none ${
                  isUrlInvalid
                    ? "border-red-500 ring-1 ring-red-500"
                    : "border-current/20 focus:border-emerald-500"
                }`}
              />
              <button
                onClick={() =>
                  saveLink({ rawUrl: urlInput, withSchedule: false })
                }
                disabled={!urlInput.trim() || isUrlInvalid}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  !urlInput.trim() || isUrlInvalid
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-emerald-600 text-white"
                }`}
              >
                Save
              </button>
            </div>
            {isUrlInvalid && (
              <div role="alert" className="text-xs text-red-500 font-medium">
                ⚠️ Enter a valid web link (must include a domain like .com or
                .se)
              </div>
            )}
            <input
              aria-label="Title or note"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Optional title or note (auto-detected if empty)..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-current/20 bg-transparent outline-none focus:border-emerald-500"
            />
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
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <button
                    onClick={() => saveCurrentTab(true, null)}
                    disabled={isHomePast}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      isHomePast
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600/25"
                    }`}
                  >
                    Save Tab + Schedule
                  </button>
                  <button
                    onClick={() =>
                      saveLink({ rawUrl: urlInput, withSchedule: true })
                    }
                    disabled={isHomePast || !urlInput.trim() || isUrlInvalid}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${
                      isHomePast || !urlInput.trim() || isUrlInvalid
                        ? "bg-slate-400 text-white cursor-not-allowed"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    Save URL + Schedule
                  </button>
                </div>
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
                  count: items.filter((i) => i.type === "link").length,
                  accent: "text-emerald-600",
                  go: () => {
                    setLinkFilter("all");
                    setView("links");
                  },
                },
                {
                  label: "Folders",
                  count: items.filter((i) => i.type === "folder").length,
                  accent: "text-emerald-600",
                  go: () => setView("folders"),
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
                  Upcoming Reminders
                </span>
                <button
                  onClick={() => setView("calendar")}
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  Calendar ({upcomingReminders.length}) →
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
                  {upcomingReminders.slice(0, 5).map((i) => renderLinkRow(i))}
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
              <span className="absolute left-2.5 text-xs opacity-65">🔍</span>
              <input
                type="text"
                aria-label="Search links by title or URL"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or URL..."
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
                  { id: "all", label: "All" },
                  { id: "favorites", label: "★ Favorites" },
                  { id: "scheduled", label: "Scheduled" },
                  { id: "unscheduled", label: "Unscheduled" },
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
                    : "No links in this filter."}
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
              <span className="absolute left-2.5 text-xs opacity-65">🔍</span>
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

            {!folderSearch.trim() && (
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
                  <button
                    onClick={() => saveCurrentTab(false, folderId)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/15 text-emerald-600 text-xs font-bold shrink-0 whitespace-nowrap"
                  >
                    + Current Tab
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
                  const childCount = items.filter(
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
                            {path ? `Root / ${path}` : "Root"} · {childCount}{" "}
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
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-current/10 text-xs shrink-0">
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
                    Root
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
                              i.id === dragId ? { ...i, parentId: f.id } : i,
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
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setCreatingFolder(true);
                      setNewFolderName("");
                    }}
                    className="px-2.5 py-1 rounded border border-current/20 text-xs font-semibold hover:border-emerald-500"
                  >
                    + Folder
                  </button>
                </div>
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
                    Folder is empty.
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
                            i.id === dragId ? { ...i, parentId: item.id } : i,
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
                            onChange={(e) => setRenameFolderVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleRenameFolder(item.id);
                              if (e.key === "Escape") setRenamingFolderId(null);
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
                            <span>{item.name}</span>
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
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                  (day) => {
                    const key = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const hasItems = items.some(
                      (it) => it.type === "link" && occursOnDate(it, key),
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
                            const exists = repeatCfg.daysOfMonth.includes(day);
                            if (
                              exists &&
                              repeatCfg.daysOfMonth.length === 1 &&
                              !repeatCfg.lastDayOfMonth
                            )
                              return;
                            const nextDays = exists
                              ? repeatCfg.daysOfMonth.filter((x) => x !== day)
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
                  placeholder="Paste URL or leave empty for current tab"
                  className={`flex-1 px-2 py-1 text-xs rounded border bg-transparent ${
                    isUrlInvalid
                      ? "border-red-500 ring-1 ring-red-500"
                      : "border-current/20"
                  }`}
                />
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
                <div role="alert" className="text-xs text-red-500 font-medium">
                  ⚠️ Enter a valid URL or leave empty for current tab
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
                  disabled={isCalPast || isUrlInvalid}
                  onClick={async () => {
                    if (urlInput.trim()) {
                      const ok = await saveLink({
                        rawUrl: urlInput,
                        withSchedule: true,
                        customDate: selectedDate,
                      });
                      if (ok) setCalAddOpen(false);
                    } else {
                      saveCurrentTab(true, null, selectedDate, () =>
                        setCalAddOpen(false),
                      );
                    }
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    isCalPast || isUrlInvalid
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
              ? items.filter(
                  (i) =>
                    i.type === "link" &&
                    i.repeat?.type === "weekly" &&
                    !i.dismissed,
                )
              : items.filter(
                  (i) => i.type === "link" && occursOnDate(i, selectedDate),
                )
            ).map((i) => renderLinkRow(i))}
          </ul>
        </div>
      )}

      {toast.msg && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full text-white text-xs font-semibold shadow-lg whitespace-nowrap ${
            toast.error ? "bg-red-600" : "bg-slate-900"
          }`}
        >
          {toast.error ? `⚠️ ${toast.msg}` : toast.msg}
        </div>
      )}
    </div>
  );
}
