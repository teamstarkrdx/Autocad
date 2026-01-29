// content.js — neutral automation engine skeleton

(() => {
  "use strict";

  const ALLOWED_ORIGINS = [
    "https://www.sheinindia.in",
    "https://payment.sheinindia.in"
  ];

  const log = (level, category, message) => {
    chrome.runtime.sendMessage({
      action: "ADD_LOG",
      level,
      category,
      message
    });
  };

  const ensureDomain = () => {
    if (!ALLOWED_ORIGINS.includes(location.origin)) {
      log("ERROR", "SECURITY", "Domain not allowed.");
      return false;
    }
    return true;
  };

  let running = false;
  let stopRequested = false;
  let state = "IDLE";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const states = {
    async IDLE() {
      return "WAIT";
    },

    async WAIT() {
      await sleep(2000);
      return running ? "SCAN" : "IDLE";
    },

    async SCAN() {
      log("INFO", "STATE", "Scanning page (adapter hook).");
      // 🔧 USER SHOULD IMPLEMENT THEIR OWN SITE LOGIC HERE
      return "WAIT";
    },

    async STOPPED() {
      running = false;
      log("INFO", "STATE", "Stopped.");
      return "IDLE";
    }
  };

  async function runLoop() {
    while (running && !stopRequested) {
      try {
        state = (await states[state]()) || "IDLE";
      } catch (e) {
        log("ERROR", "ENGINE", e.message);
        state = "STOPPED";
      }
    }
  }

  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "START_AUTOMATION") {
      if (!ensureDomain()) return;
      stopRequested = false;
      running = true;
      state = "SCAN";
      runLoop();
    }

    if (req.action === "STOP_AUTOMATION") {
      stopRequested = true;
      running = false;
      state = "STOPPED";
    }
  });

})();
