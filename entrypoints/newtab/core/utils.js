import { state } from "./state.js";

// Notifications
const NOTIFICATION_SOUND_URL = "/dashboard-assets/sounds/ding.mp3";
let notificationAudio = null;

export function playNotificationSound() {
  if (typeof Audio !== "function") return;

  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
      notificationAudio.preload = "auto";
      notificationAudio.volume = 0.45;
    }

    notificationAudio.pause();
    notificationAudio.currentTime = 0;
    const playback = notificationAudio.play();
    playback?.catch?.(() => {});
  } catch {
  }
}

export function formatTime(number) {
  return String(number).padStart(2, "0");
}

// Timer helpers
export function createHoverPauseTimer(
  element,
  duration,
  onExpire,
  timerSelector = "",
) {
  if (!element || typeof onExpire !== "function") {
    return { cancel() {} };
  }

  const totalDuration = Math.max(0, Number(duration) || 0);
  const timerElement = timerSelector
    ? element.querySelector(timerSelector)
    : null;
  const getNow = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const originalPlayState =
    timerElement?.style.getPropertyValue("animation-play-state") || "";
  const originalPlayStatePriority =
    timerElement?.style.getPropertyPriority("animation-play-state") || "";

  let remaining = totalDuration;
  let startedAt = getNow();
  let timeoutId = null;
  let isPaused = false;
  let isSettled = false;

  const clearScheduledTimeout = () => {
    if (timeoutId === null) return;
    window.clearTimeout(timeoutId);
    timeoutId = null;
  };

  const restoreTimerPlayState = () => {
    if (!timerElement) return;
    if (originalPlayState) {
      timerElement.style.setProperty(
        "animation-play-state",
        originalPlayState,
        originalPlayStatePriority,
      );
    } else {
      timerElement.style.removeProperty("animation-play-state");
    }
  };

  function cleanup() {
    if (isSettled) return;
    isSettled = true;
    clearScheduledTimeout();
    element.removeEventListener("pointerenter", pause);
    element.removeEventListener("pointerleave", resume);
    restoreTimerPlayState();
  }

  function expire() {
    if (isSettled) return;
    cleanup();
    onExpire();
  }

  function pause() {
    if (isSettled || isPaused) return;
    isPaused = true;
    remaining = Math.max(0, remaining - (getNow() - startedAt));
    clearScheduledTimeout();
    timerElement?.style.setProperty("animation-play-state", "paused");
  }

  function resume() {
    if (isSettled || !isPaused) return;
    isPaused = false;
    timerElement?.style.setProperty("animation-play-state", "running");
    if (remaining <= 0) {
      expire();
      return;
    }
    startedAt = getNow();
    timeoutId = window.setTimeout(expire, remaining);
  }

  element.addEventListener("pointerenter", pause);
  element.addEventListener("pointerleave", resume);
  timeoutId = window.setTimeout(expire, remaining);

  return {
    cancel: cleanup,
  };
}

// URL and favicon helpers
export function getIconUrl(url, size = 64) {
  try {
    const isChromium = typeof chrome !== "undefined" &&
      chrome?.runtime?.getURL &&
      !navigator.userAgent.includes("Safari/") || navigator.userAgent.includes("Chrome");

    // 1. 在 Chromium 环境优先使用 MV3 原生 Favicon 协议
    if (isChromium && typeof chrome !== "undefined" && chrome?.runtime?.getURL) {
      return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`);
    }
  } catch (e) {}

  try {
    const urlObject = new URL(url);
    // 2. Safari / Firefox 及其他环境采用高速镜像降级
    return `https://api.iowen.cn/favicon/${urlObject.hostname}.png`;
  } catch (e) {
    return "/dashboard-assets/icons/icon32.png";
  }
}

export function makeKeyboardInteractive(element, handler, label) {
  if (!element) return element;
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  if (label) element.setAttribute("aria-label", label);
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler(event);
  });
  return element;
}

// Geocoding helpers
export function isValidCoordinate(value, min, max) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim()) ||
    typeof value === "boolean"
  ) {
    return false;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export function getGeocodingResults(payload) {
  if (!payload || !Array.isArray(payload.results)) return [];
  return payload.results.filter(
    (result) =>
      result &&
      typeof result.name === "string" &&
      isValidCoordinate(result.latitude, -90, 90) &&
      isValidCoordinate(result.longitude, -180, 180),
  );
}

export function formatLocationResult(result) {
  return [result.name, result.admin1, result.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}

export async function chooseGeocodingResult(results, query) {
  if (results.length === 1) return results[0];
  const buttons = results.slice(0, 5).map((result, index) => ({
    text: `${index + 1}. ${formatLocationResult(result)}`,
    value: index,
    width: "auto",
  }));
  buttons.push({
    text: "取消",
    value: null,
    width: "100px",
    style: "background: var(--bg-interactive); color: var(--text-primary);",
  });
  const choice = await showCustomModal(
    `匹配到多个与 "${query}" 相关的地点，请选择要使用的城市：`,
    false,
    false,
    buttons,
  );
  return Number.isInteger(choice) ? results[choice] || null : null;
}

// DOM and modal helpers
export function createEl(tag, className, text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

export function showCustomModal(
  message,
  isConfirm = false,
  isDanger = false,
  customButtons = null,
  isCelebration = false,
  modalOptions = null,
) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "hidden ydd-custom-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; justify-content: center;
      align-items: center; z-index: 12000; opacity: 0; transition: opacity 0.3s;
    `;

    const box = document.createElement("div");
    box.className = "modal-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.style.cssText = `
      max-width: 400px; text-align: center;
      opacity: 0; transform: scale(0.9); transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    const title = document.createElement("h2");
    title.id = `ydd-modal-title-${Date.now()}`;
    box.setAttribute("aria-labelledby", title.id);
    title.style.cssText = "color: var(--accent-color); margin-bottom: 1rem;";
    if (isCelebration) {
      title.textContent = "🎉 恭喜达成 🎊";
      title.style.fontSize = "1.8rem";
    } else {
      title.textContent = modalOptions?.title ||
        (isConfirm ? "请确认" : "提示");
    }

    const text = document.createElement("p");
    text.style.cssText =
      "color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem; white-space: pre-line;";

    if (isCelebration) {
      text.style.fontSize = "1.2rem";
      text.style.lineHeight = "1.6";
      box.style.maxWidth = "550px";
      box.style.padding = "2.5rem 2rem";
    }

    if (modalOptions?.italicText && message.includes(modalOptions.italicText)) {
      const [before, after] = message.split(modalOptions.italicText);
      text.append(
        document.createTextNode(before),
        Object.assign(document.createElement("em"), {
          textContent: modalOptions.italicText,
        }),
        document.createTextNode(after),
      );
    } else {
      text.textContent = message;
    }

    let checkboxInput = null;
    let checkboxRow = null;
    if (modalOptions?.checkbox) {
      checkboxRow = document.createElement("label");
      checkboxRow.className = "ydd-modal-checkbox";
      checkboxInput = document.createElement("input");
      checkboxInput.type = "checkbox";
      checkboxInput.setAttribute(
        "aria-label",
        modalOptions.checkbox.label || "记住此选择",
      );
      const checkboxLabel = document.createElement("span");
      checkboxLabel.textContent = modalOptions.checkbox.label ||
        "记住此选择";
      checkboxRow.append(checkboxInput, checkboxLabel);
    }

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;";

    const cleanup = (result) => {
      document.removeEventListener("keydown", dialogKeyHandler);
      overlay.style.opacity = "0";
      box.style.opacity = "0";
      box.style.transform = "scale(0.9)";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(result);
      }, 300);
    };

    if (customButtons && Array.isArray(customButtons)) {
      customButtons.forEach((btnData) => {
        const btn = document.createElement("button");
        btn.className = btnData.className || "settings-button";
        btn.style.width = btnData.width || "auto";
        if (btnData.style) btn.style.cssText += btnData.style;
        btn.textContent = btnData.text;
        if (btnData.value === "cancel" && checkboxInput) {
          btn.disabled = checkboxInput.checked;
          checkboxInput.addEventListener("change", () => {
            btn.disabled = checkboxInput.checked;
          });
        }
        btn.onclick = () =>
          cleanup(
            typeof btnData.value === "function"
              ? btnData.value({
                checkboxChecked: checkboxInput?.checked === true,
              })
              : btnData.value,
          );
        btnContainer.appendChild(btn);
      });
    } else {
      const okBtn = document.createElement("button");
      okBtn.className = "settings-button";
      if (isDanger) okBtn.classList.add("danger-hover");
      okBtn.style.width = "120px";
      okBtn.textContent = isConfirm ? "确认" : "确定";
      okBtn.addEventListener("click", () => cleanup(true));
      btnContainer.appendChild(okBtn);

      if (isConfirm) {
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "settings-button";
        cancelBtn.style.cssText =
          "width: 120px; background-color: var(--bg-interactive); color: var(--text-primary);";
        cancelBtn.textContent = "取消";
        cancelBtn.addEventListener("click", () => cleanup(false));
        btnContainer.appendChild(cancelBtn);
      }
    }

    box.appendChild(title);
    box.appendChild(text);
    if (checkboxRow) box.appendChild(checkboxRow);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    playNotificationSound();

    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
    void overlay.offsetWidth;
    overlay.style.opacity = "1";
    void box.offsetWidth;
    box.style.opacity = "1";
    box.style.transform = "scale(1)";
    const dialogKeyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(isConfirm ? false : null);
        return;
      }
      if (event.key === "Tab") {
        const focusable = box.querySelectorAll(
          "button, input, select, textarea, a[href]",
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", dialogKeyHandler);
  });
}

export function showCustomPrompt(message, defaultValue = "", options = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "hidden ydd-custom-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; justify-content: center;
      align-items: center; z-index: 12000; opacity: 0; transition: opacity 0.3s;
    `;

    const box = document.createElement("div");
    box.className = "modal-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.style.cssText = `
      width: 400px; max-width: 90%; text-align: left;
      opacity: 0; transform: scale(0.9); transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    const title = document.createElement("p");
    title.id = `ydd-prompt-title-${Date.now()}`;
    box.setAttribute("aria-labelledby", title.id);
    title.style.cssText =
      "color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.8rem; font-weight: 500;";
    title.textContent = "VerseVibe 动态仪表盘";

    const text = document.createElement("p");
    text.style.cssText =
      "color: var(--text-primary); font-size: 1rem; margin-bottom: 1rem;";
    text.textContent = message;

    const input = document.createElement("input");
    input.type = "text";
    const maxLength =
      Number.isInteger(options.maxLength) && options.maxLength > 0
        ? options.maxLength
        : null;
    input.value = maxLength
      ? String(defaultValue).slice(0, maxLength)
      : defaultValue;
    if (maxLength) input.maxLength = maxLength;
    input.setAttribute("aria-label", "Your answer");
    input.style.cssText =
      "width: 100%; box-sizing: border-box; margin-bottom: 1.5rem; padding: 10px; border-radius: 8px; border: 1px solid var(--bg-interactive); background: var(--bg-secondary); color: var(--text-primary); outline: none; transition: border-color 0.3s;";
    input.onfocus =
      () => (input.style.border = "1px solid var(--accent-color)");
    input.onblur =
      () => (input.style.border = "1px solid var(--bg-interactive)");

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "display: flex; gap: 10px; justify-content: flex-end;";

    const okBtn = document.createElement("button");
    okBtn.className = "settings-button";
    okBtn.style.cssText = "width: auto; padding: 8px 24px;";
    okBtn.textContent = "确定";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "settings-button";
    cancelBtn.style.cssText =
      "width: auto; padding: 8px 24px; background-color: var(--bg-interactive); color: var(--text-primary);";
    cancelBtn.textContent = "取消";

    btnContainer.appendChild(okBtn);
    btnContainer.appendChild(cancelBtn);

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(input);
    box.appendChild(btnContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    playNotificationSound();

    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
    void overlay.offsetWidth;
    overlay.style.opacity = "1";
    void box.offsetWidth;
    box.style.opacity = "1";
    box.style.transform = "scale(1)";

    const cleanup = (result) => {
      document.removeEventListener("keydown", promptKeyHandler);
      overlay.style.opacity = "0";
      box.style.opacity = "0";
      box.style.transform = "scale(0.9)";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(result);
      }, 300);
    };

    okBtn.addEventListener("click", () => cleanup(input.value));
    cancelBtn.addEventListener("click", () => cleanup(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") cleanup(input.value);
      if (e.key === "Escape") cleanup(null);
    });
    const promptKeyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(null);
        return;
      }
      if (event.key === "Tab") {
        const focusable = box.querySelectorAll(
          "input, button, a[href], select, textarea",
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", promptKeyHandler);

    if (options.autoFocus === true) {
      const focusInput = () => {
        if (!document.body.contains(input)) return;
        input.focus({ preventScroll: true });
        if (options.selectAll === true && input.value) input.select();
      };
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(focusInput);
      } else {
        setTimeout(focusInput, 0);
      }
    }
  });
}

// Onboarding task helpers
export function completeDefaultTask(taskIdOrText) {
  if (!state.get("defaultTasksPinned")) return;

  const todos = state.get("todos") || [];
  const index = todos.findIndex(
    (t) => t.id === taskIdOrText || t.text === taskIdOrText,
  );
  if (index !== -1) {
    if (!todos[index].completed) {
      todos[index].completed = true;
      state.set("todos", todos);
    }

    const completedIds = state.get("completedDefaultTaskIds") || [];
    const idStr = String(todos[index].id);
    if (!completedIds.includes(idStr)) {
      completedIds.push(idStr);
      state.set("completedDefaultTaskIds", completedIds);
    }

    progressDefaultTasks();
  }
}

export function markDefaultTaskComplete(taskIdOrText) {
  completeDefaultTask(taskIdOrText);
}

export function markDefaultTaskIncomplete(taskIdOrText) {
  if (!state.get("defaultTasksPinned")) return;
  const idStr = String(taskIdOrText);
  const completedIds = state.get("completedDefaultTaskIds") || [];
  const nextIds = completedIds.filter((id) => String(id) !== idStr);
  if (nextIds.length !== completedIds.length) {
    state.set("completedDefaultTaskIds", nextIds);
  }
  progressDefaultTasks();
}

export function initializeDefaultTasks() {
  if (state.get("defaultTasksPinned")) return;
  const todos = state.get("todos") || [];
  let slots = 2;
  todos.forEach((task) => {
    if (
      slots > 0 &&
      ["vv-1", "vv-2"].includes(String(task.id)) &&
      !task.completed
    ) {
      task.pinned = true;
      slots -= 1;
    }
  });
  state.set("todos", todos);
  state.set("defaultTasksPinned", true);
  progressDefaultTasks();
}

export function progressDefaultTasks() {
  if (!state.get("defaultTasksPinned")) return;

  let todos = state.get("todos") || [];
  const defaultTaskSequence = ["vv-1", "vv-2", "vv-3"];

  const remainingDefaults = todos.filter(
    (t) => defaultTaskSequence.includes(String(t.id)) && !t.completed,
  );

  let completedDefaultsCount = 0;
  defaultTaskSequence.forEach((id) => {
    const task = todos.find((t) => String(t.id) === id);
    if (!task || task.completed) {
      completedDefaultsCount++;
    }
  });

  const pinnedDefaultsCount = remainingDefaults.filter((t) => t.pinned).length;

  if (pinnedDefaultsCount < 2 && remainingDefaults.length > 0) {
    let tasksToPin = 2 - pinnedDefaultsCount;
    for (const id of defaultTaskSequence) {
      if (tasksToPin <= 0) break;
      const taskIndex = todos.findIndex((t) => String(t.id) === id);
      if (
        taskIndex !== -1 &&
        !todos[taskIndex].completed &&
        !todos[taskIndex].pinned
      ) {
        todos[taskIndex].pinned = true;
        tasksToPin--;
      }
    }
    state.set("todos", todos);
  }

  const completedIds = state.get("completedDefaultTaskIds") || [];
  let validCompletions = completedIds.length;
  defaultTaskSequence.forEach((id) => {
    const task = todos.find((t) => String(t.id) === id);
    if (task && task.completed && !completedIds.includes(id)) {
      validCompletions++;
    }
  });

  const rewardShown = state.get("welcomeRewardShown");
  if (completedDefaultsCount === defaultTaskSequence.length && !rewardShown) {
    state.set("welcomeRewardShown", true);

    if (validCompletions >= 2) {
      setTimeout(() => {
        showCustomModal(
          "恭喜您完成了新手引导任务！欢迎体验 VerseVibe 动态仪表盘，开启高效美好的新标签页探索之旅。",
          false,
          false,
          null,
          true,
        );
      }, 500);
    }
  }
}
