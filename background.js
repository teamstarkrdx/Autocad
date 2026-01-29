// background.js

const DEFAULTS = {
  logs: [],
  productHistory: [],
  couponStates: {},
  couponPool: [],
  settings: {}
};

const ALLOWED_ORIGINS = [
  "https://www.sheinindia.in",
  "https://payment.sheinindia.in"
];

const isAllowedUrl = (url) => {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
};

function addLog(level, category, message) {
  chrome.storage.local.get(["logs"], (r) => {
    const logs = r.logs || [];
    logs.unshift({
      timestamp: new Date().toISOString(),
      level,
      category,
      message
    });
    logs.length = Math.min(logs.length, 2000);
    chrome.storage.local.set({ logs });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULTS), (cur) => {
    const patch = {};
    for (const k in DEFAULTS) {
      if (cur[k] === undefined) patch[k] = DEFAULTS[k];
    }
    if (Object.keys(patch).length) chrome.storage.local.set(patch);
  });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "START_AUTOMATION") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || !isAllowedUrl(tab.url)) {
        addLog("ERROR", "SYSTEM", "Open allowed domain first.");
        sendResponse({ ok: false });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "START_AUTOMATION" });
      addLog("INFO", "SYSTEM", "Start requested.");
      sendResponse({ ok: true });
    });
    return true;
  }

  if (req.action === "STOP_AUTOMATION") {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab && isAllowedUrl(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { action: "STOP_AUTOMATION" });
      }
    });
    addLog("INFO", "SYSTEM", "Stop requested.");
    sendResponse({ ok: true });
    return true;
  }

  if (req.action === "ADD_LOG") {
    addLog(req.level, req.category, req.message);
    sendResponse({ ok: true });
  }
});
