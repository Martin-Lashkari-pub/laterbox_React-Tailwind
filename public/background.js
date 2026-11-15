const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function getNextOccurrence(repeat, afterTs = Date.now()) {
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
    ) {
      return c.getTime();
    }
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
      ) {
        return c.getTime();
      }
    }
  }
  return null;
}

function getPopupDimensions(prefs = {}) {
  const sizes = {
    compact: { w: 420, h: 500 },
    standard: { w: 460, h: 560 },
    large: { w: 520, h: 600 },
  };
  const base = sizes[prefs.size] || sizes.standard;
  const scalePct =
    typeof prefs.font === "number" && prefs.font >= 80 && prefs.font <= 150
      ? prefs.font
      : prefs.font === "small"
        ? 90
        : prefs.font === "large"
          ? 115
          : 100;
  const scaleFactor = Math.max(1, scalePct / 100);
  const effectiveBaseW = scalePct > 105 ? Math.max(base.w, 480) : base.w;

  return {
    width: Math.min(820, Math.round(effectiveBaseW * scaleFactor) + 16),
    height: Math.min(680, Math.round(base.h * scaleFactor) + 38),
  };
}

async function updateBadge() {
  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  const due = laterBoxItems.filter(
    (i) =>
      i.type === "link" &&
      !i.isPrivate &&
      !i.encrypted &&
      i.reminderTime &&
      i.reminderTime <= Date.now() &&
      !i.dismissed,
  ).length;
  chrome.action.setBadgeText({ text: due > 0 ? String(due) : "" });
  if (due > 0) chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
}

async function syncAlarmsAndBadge() {
  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  const now = Date.now();
  const existingAlarms = await chrome.alarms.getAll();
  const validIds = new Set();

  for (const item of laterBoxItems) {
    if (item.type !== "link" || !item.reminderTime || item.dismissed) continue;
    const alarmName = `tabvault_${item.id}`;
    validIds.add(alarmName);
    const triggerAt = Math.max(item.reminderTime, now + 1500);
    await chrome.alarms.create(alarmName, { when: triggerAt });
  }

  for (const alarm of existingAlarms) {
    if (
      (alarm.name.startsWith("tabvault_") ||
        alarm.name.startsWith("laterbox_")) &&
      !validIds.has(alarm.name)
    ) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  await updateBadge();
}

async function resolveTitle(itemId, url) {
  let title = null;
  try {
    const u = new URL(url);
    const ytId = u.hostname.includes("youtu.be")
      ? u.pathname.slice(1).split("/")[0]
      : u.hostname.includes("youtube.com")
        ? u.searchParams.get("v") ||
          (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null)
        : null;

    if (ytId) {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`,
      );
      if (res.ok) title = (await res.json()).title;
    } else {
      const tabs = await chrome.tabs.query({});
      const match = tabs.find(
        (t) =>
          t.url?.split("?")[0] === url.split("?")[0] &&
          t.title &&
          !t.title.startsWith("http"),
      );
      if (match) title = match.title;
    }
  } catch {}

  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  let changed = false;
  const updated = laterBoxItems.map((i) => {
    if (i.id !== itemId || i.isPrivate || i.encrypted) return i;
    changed = true;
    return {
      ...i,
      fetchingTitle: false,
      note: title && !i.note ? title.replace(/ - YouTube$/, "").trim() : i.note,
    };
  });

  if (changed && updated.length > 0) {
    await chrome.storage.local.set({
      laterBoxItems: updated,
      laterBoxBackup: updated,
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg?.type === "FETCH_LINK_TITLE") {
    resolveTitle(msg.itemId, msg.url).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (
    !alarm.name.startsWith("tabvault_") &&
    !alarm.name.startsWith("laterbox_")
  )
    return;
  const rawId = alarm.name.replace(/^(tabvault_|laterbox_)/, "");
  const { laterBoxItems = [], laterBoxPrefs = {} } =
    await chrome.storage.local.get(["laterBoxItems", "laterBoxPrefs"]);
  const item = laterBoxItems.find((i) => i.id === rawId);
  if (!item || item.dismissed) return;

  await updateBadge();

  if (item.isPrivate || item.encrypted) {
    chrome.notifications.create(alarm.name, {
      type: "basic",
      iconUrl: "LaterBox-Ikon.png",
      title: "TabVault: Private Reminder",
      message: "Switch to Private Mode in TabVault to view this reminder.",
      requireInteraction: true,
      priority: 2,
    });
    return;
  }

  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "LaterBox-Ikon.png",
    title: item.note ? `TabVault: ${item.note}` : "TabVault Reminder",
    message: item.url.split("?")[0].replace(/^https?:\/\/(www\.)?/, ""),
    requireInteraction: true,
    priority: 2,
  });

  const basePopupUrl = chrome.runtime.getURL("index.html");
  const alarmPopupUrl = `${basePopupUrl}?alarm=${encodeURIComponent(item.id)}`;
  const wins = await chrome.windows.getAll({ populate: true });
  const existingWin = wins.find((w) =>
    w.tabs?.some((t) => t.url?.startsWith(basePopupUrl)),
  );

  if (!existingWin) {
    const dim = getPopupDimensions(laterBoxPrefs);
    chrome.windows.create({
      url: alarmPopupUrl,
      type: "popup",
      width: dim.width,
      height: dim.height,
    });
  } else {
    chrome.runtime
      .sendMessage({ type: "OPEN_ALARM_DETAIL", itemId: item.id })
      .catch(() => {});
    chrome.windows.update(existingWin.id, { focused: true }).catch(() => {});
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith("tabvault_") && !id.startsWith("laterbox_")) return;
  const targetId = id.replace(/^(tabvault_|laterbox_)/, "");
  const { laterBoxItems = [], laterBoxPrefs = {} } =
    await chrome.storage.local.get(["laterBoxItems", "laterBoxPrefs"]);
  let targetUrl = null;
  let isPrivate = false;

  const updated = laterBoxItems.map((item) => {
    if (item.id !== targetId) return item;
    if (item.isPrivate || item.encrypted) {
      isPrivate = true;
      return item;
    }
    targetUrl = item.url;
    const next = getNextOccurrence(item.repeat, Date.now());
    if (next) {
      chrome.alarms.create(`tabvault_${item.id}`, { when: next });
      return {
        ...item,
        reminderTime: next,
        reminderDate: toDateKey(new Date(next)),
        alertedInPopup: false,
      };
    }
    return { ...item, dismissed: true };
  });

  if (isPrivate) {
    const dim = getPopupDimensions(laterBoxPrefs);
    chrome.windows.create({
      url: chrome.runtime.getURL("index.html"),
      type: "popup",
      width: dim.width,
      height: dim.height,
    });
    chrome.notifications.clear(id);
    return;
  }

  if (targetUrl && updated.length > 0) {
    await chrome.storage.local.set({
      laterBoxItems: updated,
      laterBoxBackup: updated,
    });
    await updateBadge();
    chrome.tabs.create({ url: targetUrl });
  }
  chrome.notifications.clear(id);
});

chrome.runtime.onInstalled.addListener(syncAlarmsAndBadge);
chrome.runtime.onStartup.addListener(syncAlarmsAndBadge);
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c.laterBoxItems) updateBadge();
});
