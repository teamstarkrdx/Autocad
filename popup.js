// popup.js (fixed + compatible)

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const storageGet = (keys) =>
    new Promise((res) => chrome.storage.local.get(keys, (r) => res(r)));

  const storageSet = (obj) =>
    new Promise((res) => chrome.storage.local.set(obj, () => res()));

  const cleanLines = (text) =>
    (text || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  let currentFilter = "ALL";

  const showNotification = (msg, isError = false) => {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.cssText = `
      position: fixed; top: 10px; right: 10px; 
      background: ${isError ? "#dc3545" : "#28a745"}; 
      color: white; padding: 10px 14px;
      border-radius: 6px; font-weight: 600; z-index: 10000;
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
  };

  const renderCouponStats = (couponPool, couponStates) => {
    const states = couponStates || {};
    let unused = 0, used = 0, failed = 0;

    for (const c of couponPool || []) {
      const st = states[c] || "unused";
      if (st === "unused") unused++;
      else if (st === "used_success") used++;
      else if (st === "failed_not_applicable") failed++;
    }

    $("unusedCount").textContent = `Unused: ${unused}`;
    $("usedCount").textContent = `Used: ${used}`;
    $("failedCount").textContent = `Failed: ${failed}`;
  };

  const renderLogs = (logs) => {
    const container = $("logs");
    const list = logs || [];

    const filtered = list.filter((log) => {
      const lvl = String(log.level || "").toUpperCase();
      const cat = String(log.category || "").toUpperCase();

      if (currentFilter === "ALL") return true;
      if (currentFilter === "ERROR") return lvl === "ERROR";
      return cat === currentFilter;
    });

    if (!filtered.length) {
      container.textContent = "No logs...";
      return;
    }

    container.textContent = filtered
      .map((log) => {
        const t = new Date(log.timestamp || Date.now()).toLocaleTimeString();
        const lvl = String(log.level || "INFO").toUpperCase();
        const cat = String(log.category || "GENERAL").toUpperCase();
        return `[${t}] [${lvl}] [${cat}] ${log.message || ""}`;
      })
      .join("\n");

    container.scrollTop = 0;
  };

  const loadSettings = async () => {
    const {
      profile = {},
      settings = {},
      couponPool = [],
      couponStates = {},
      logs = [],
      telegramBotToken = "",
      telegramChatId = "",
      upiId = ""
    } = await storageGet([
      "profile",
      "settings",
      "couponPool",
      "couponStates",
      "logs",
      "telegramBotToken",
      "telegramChatId",
      "upiId"
    ]);

    // Profile fields
    $("fullName").value = profile.fullName || "";
    $("phone").value = profile.phone || "";
    $("address1").value = profile.address1 || "";
    $("address2").value = profile.address2 || "";
    $("city").value = profile.city || "";
    $("state").value = profile.state || "State";
    $("pincode").value = profile.pincode || "";

    // Sizes
    $("topSizes").value = settings.topSizes || "M,L";
    $("bottomSizes").value = settings.bottomSizes || "32,34";

    // Required config
    $("telegramBotToken").value = telegramBotToken || "";
    $("telegramChatId").value = telegramChatId || "";
    $("upiId").value = upiId || "";

    // Controls (numbers vs checkboxes)
    $("autoMode").checked = settings.autoMode ?? true;
    $("pollInterval").value = settings.pollInterval ?? 5000;
    $("clickInterval").value = settings.clickInterval ?? 450;
    $("maxRetries").value = settings.maxRetries ?? 3;
    $("maxProducts").value = settings.maxProducts ?? 50;
    $("stopAtPayment").checked = settings.stopAtPayment ?? true;
    $("triggerPayment").checked = settings.triggerPayment ?? true;

    // Coupons textarea
    $("coupons").value = (couponPool || []).join("\n");
    renderCouponStats(couponPool, couponStates);

    // Logs
    renderLogs(logs);
  };

  const saveSettings = async () => {
    const profile = {
      fullName: $("fullName").value.trim(),
      phone: $("phone").value.trim(),
      address1: $("address1").value.trim(),
      address2: $("address2").value.trim(),
      city: $("city").value.trim(),
      state: $("state").value,
      pincode: $("pincode").value.trim()
    };

    const settings = {
      autoMode: $("autoMode").checked,
      pollInterval: Number($("pollInterval").value || 5000),
      clickInterval: Number($("clickInterval").value || 450),
      maxRetries: Number($("maxRetries").value || 3),
      maxProducts: Number($("maxProducts").value || 50),
      stopAtPayment: $("stopAtPayment").checked,
      triggerPayment: $("triggerPayment").checked,
      topSizes: ($("topSizes").value || "M,L").trim(),
      bottomSizes: ($("bottomSizes").value || "32,34").trim()
    };

    // Coupons: store as couponPool array
    const couponPool = cleanLines($("coupons").value);

    // Ensure couponStates exists and matches couponPool
    const { couponStates: oldStates = {} } = await storageGet(["couponStates"]);
    const couponStates = { ...oldStates };

    for (const c of couponPool) {
      if (!couponStates[c]) couponStates[c] = "unused";
    }
    // Remove states not present anymore
    for (const c of Object.keys(couponStates)) {
      if (!couponPool.includes(c)) delete couponStates[c];
    }

    const telegramBotToken = $("telegramBotToken").value.trim();
    const telegramChatId = $("telegramChatId").value.trim();
    const upiId = $("upiId").value.trim();

    await storageSet({ profile, settings, couponPool, couponStates, telegramBotToken, telegramChatId, upiId });

    chrome.runtime.sendMessage({
      action: "ADD_LOG",
      level: "INFO",
      category: "SYSTEM",
      message: "Settings saved from popup."
    });

    renderCouponStats(couponPool, couponStates);
    showNotification("Settings saved!");
  };

  // Buttons
  $("saveSettings").onclick = saveSettings;

  $("runNow").onclick = async () => {
    await saveSettings();
    chrome.runtime.sendMessage({ action: "START_AUTOMATION" });
    showNotification("▶️ Started!");
  };

  $("stopNow").onclick = () => {
    chrome.runtime.sendMessage({ action: "STOP_AUTOMATION" });
    showNotification("⏹️ Stopped!");
  };

  $("resetHistory").onclick = async () => {
    if (confirm("Reset all product history?")) {
      await storageSet({ productHistory: [] });
      chrome.runtime.sendMessage({
        action: "ADD_LOG",
        level: "WARN",
        category: "PRODUCT",
        message: "Product history reset by user."
      });
      showNotification("History reset!");
    }
  };

  // Coupons import/export
  $("importCoupons").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,text/plain";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const existing = new Set(cleanLines($("coupons").value));
      for (const line of cleanLines(text)) existing.add(line);
      $("coupons").value = Array.from(existing).join("\n");
      await saveSettings();
      showNotification("Coupons imported!");
    };
    input.click();
  };

  $("exportCoupons").onclick = () => {
    const coupons = cleanLines($("coupons").value).join("\n");
    const blob = new Blob([coupons], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coupons-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  $("clearFailed").onclick = async () => {
    const { couponPool = [], couponStates = {} } = await storageGet(["couponPool", "couponStates"]);
    for (const c of couponPool) {
      if (couponStates[c] === "failed_not_applicable") couponStates[c] = "unused";
    }
    await storageSet({ couponStates });
    renderCouponStats(couponPool, couponStates);
    showNotification("Failed coupons cleared!");
  };

  $("resetCoupons").onclick = async () => {
    if (!confirm("Reset ALL coupons to UNUSED?")) return;
    const { couponPool = [] } = await storageGet(["couponPool"]);
    const couponStates = {};
    for (const c of couponPool) couponStates[c] = "unused";
    await storageSet({ couponStates });
    renderCouponStats(couponPool, couponStates);
    showNotification("Coupons reset!");
  };

  // Logs actions
  $("copyLogs").onclick = async () => {
    const { logs = [] } = await storageGet(["logs"]);
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showNotification("Logs copied!");
    } catch {
      showNotification("Clipboard blocked by browser", true);
    }
  };

  $("downloadLogs").onclick = async () => {
    const { logs = [] } = await storageGet(["logs"]);
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autocart-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  $("clearLogs").onclick = async () => {
    await storageSet({ logs: [] });
    renderLogs([]);
    showNotification("Logs cleared!");
  };

  // Log filters
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.onclick = async () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter || "ALL";
      const { logs = [] } = await storageGet(["logs"]);
      renderLogs(logs);
    };
  });

  // Auto-refresh logs + coupon stats while popup open
  setInterval(async () => {
    const { logs = [], couponPool = [], couponStates = {} } = await storageGet(["logs", "couponPool", "couponStates"]);
    renderLogs(logs);
    renderCouponStats(couponPool, couponStates);
  }, 1500);

  // Initial load
  loadSettings().catch((e) => showNotification("Load failed: " + e.message, true));
});
