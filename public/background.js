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

async function updateBadge() {
  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  const due = laterBoxItems.filter(
    (i) =>
      i.type === "link" &&
      i.reminderTime &&
      i.reminderTime <= Date.now() &&
      !i.dismissed,
  ).length;
  chrome.action.setBadgeText({ text: due > 0 ? String(due) : "" });
  if (due > 0) chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
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
    if (i.id !== itemId) return i;
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
  if (!alarm.name.startsWith("laterbox_")) return;
  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  const item = laterBoxItems.find(
    (i) => i.id === alarm.name.replace("laterbox_", ""),
  );
  if (!item || item.dismissed) return;

  await updateBadge();
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "LaterBox-Ikon.png",
    title: item.note ? `LaterBox: ${item.note}` : "LaterBox Reminder",
    message: item.url.split("?")[0].replace(/^https?:\/\/(www\.)?/, ""),
    requireInteraction: true,
    priority: 2,
  });

  const popupUrl = chrome.runtime.getURL("index.html");
  const wins = await chrome.windows.getAll({ populate: true });
  if (!wins.some((w) => w.tabs?.some((t) => t.url === popupUrl))) {
    chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 420,
      height: 600,
    });
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith("laterbox_")) return;
  const { laterBoxItems = [] } =
    await chrome.storage.local.get("laterBoxItems");
  const item = laterBoxItems.find((i) => i.id === id.replace("laterbox_", ""));
  if (item) {
    const next = getNextOccurrence(item.repeat, Date.now());
    if (next) {
      item.reminderTime = next;
      item.reminderDate = toDateKey(new Date(next));
      item.alertedInPopup = false;
      chrome.alarms.create(`laterbox_${item.id}`, { when: next });
    } else {
      item.dismissed = true;
    }
    await chrome.storage.local.set({ laterBoxItems });
    await updateBadge();
    chrome.tabs.create({ url: item.url });
  }
  chrome.notifications.clear(id);
});

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener(
  (c, area) => area === "local" && c.laterBoxItems && updateBadge(),
);
