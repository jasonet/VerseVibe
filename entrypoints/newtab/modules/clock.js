import { state } from "../core/state.js";
import { formatTime, showCustomPrompt } from "../core/utils.js";

// Clock content
const WEEKDAYS_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAILY_GREETING_STORAGE_KEY = "vv_daily_greeting";
const MAX_USER_NAME_LENGTH = 12;

const GREETING_VARIANTS_ZH = Object.freeze({
  earlyMorning: [
    "清晨好，新的一天开始啦！",
    "起得真早，拥抱晨光吧！",
    "晨曦初照，今天准备好出发了吗？",
    "清晨静谧，又是充满希望的一天！",
  ],
  morning: [
    "早上好！",
    "美好的一天开始了，祝心情愉快！",
    "{day}好，保持专注与热爱！",
    "早安，今天也活力满满！",
  ],
  afternoon: [
    "下午好！",
    "工作顺利吗？记得适当休息下眼睛。",
    "{day}下午，喝杯水提提神吧！",
    "午后时光，继续保持高效！",
  ],
  evening: [
    "晚上好！",
    "结束了一天的忙碌，好好放松一下吧。",
    "今晚有什么有趣的计划吗？",
    "夜幕降临，享受宁静的夜晚。",
  ],
  night: [
    "夜深了，早点休息吧。",
    "晚安，祝今晚做个好梦。",
    "放下疲惫，明天会更好。",
    "晚安，愿好梦常伴。",
  ],
  lateNight: [
    "夜深了，还在熬夜吗？",
    "注意休息，早点睡觉保持健康哦。",
    "深夜万籁俱寂，早些入眠吧。",
  ],
});

const GREETING_VARIANTS_EN = Object.freeze({
  earlyMorning: [
    "Early start today?",
    "Morning, early bird!",
    "Ready for a fresh start?",
  ],
  morning: [
    "Good morning",
    "Happy {day}!",
    "Ready for today?",
  ],
  afternoon: [
    "Good afternoon",
    "Happy {day}!",
    "Still going strong?",
  ],
  evening: [
    "Good evening",
    "Take it easy tonight.",
    "Evening check-in?",
  ],
  night: [
    "Good night",
    "Sleep well",
    "Rest easy tonight.",
  ],
  lateNight: [
    "Still up?",
    "Time for sleep?",
    "Night owl again?",
  ],
});

function isZh() {
  return (navigator.language || "").toLowerCase().startsWith("zh");
}

function getLocalDateKey(date) {
  return `${date.getFullYear()}-${
    String(date.getMonth() + 1).padStart(2, "0")
  }-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateFallbackGreetingIndex(date, period, variantCount) {
  const dateKey = `${getLocalDateKey(date)}:${period}`;
  let hash = 0;
  for (let index = 0; index < dateKey.length; index++) {
    hash = (hash * 31 + dateKey.charCodeAt(index)) | 0;
  }
  return (hash >>> 0) % variantCount;
}

function getDailyGreetingIndex(date, period, variantCount) {
  const dateKey = getLocalDateKey(date);

  try {
    const stored = JSON.parse(
      localStorage.getItem(DAILY_GREETING_STORAGE_KEY) || "null",
    );
    const selections = stored?.date === dateKey &&
        stored.selections &&
        typeof stored.selections === "object" &&
        !Array.isArray(stored.selections)
      ? { ...stored.selections }
      : {};
    const storedIndex = selections[period];

    if (
      Number.isInteger(storedIndex) &&
      storedIndex >= 0
    ) {
      return storedIndex % variantCount;
    }

    const selectedIndex = Math.floor(Math.random() * variantCount);
    selections[period] = selectedIndex;
    localStorage.setItem(
      DAILY_GREETING_STORAGE_KEY,
      JSON.stringify({ date: dateKey, selections }),
    );
    return selectedIndex;
  } catch {
    return getDateFallbackGreetingIndex(date, period, variantCount);
  }
}

// Clock widget
export class Clock {
  constructor() {
    this.els = {
      master: document.querySelector(".master-clock-container"),
      digital: document.getElementById("digital-clock-container"),
      analog: document.getElementById("analog-clock-container"),
      hours: document.getElementById("clock-hours"),
      minutes: document.getElementById("clock-minutes"),
      seconds: document.getElementById("clock-seconds"),
      ampm: document.getElementById("clock-ampm"),

      dateRow: document.getElementById("clock-date-row"),
      day: document.getElementById("clock-day"),
      date: document.getElementById("clock-date"),

      greeting: document.getElementById("greeting-text"),
      hourHand: document.getElementById("hour-hand"),
      minuteHand: document.getElementById("minute-hand"),
      secondDot: document.getElementById("second-dot"),
    };

    this.currentGreeting = "";
    this._secondTimer = null;
    this._animationFrame = null;
    this._greetingDelayTimer = null;
    this._greetingTypingTimer = null;
    this._visibilityHandler = () => this.handleVisibilityChange();
    this.init();
  }

  init() {
    this.update();
    document.addEventListener("visibilitychange", this._visibilityHandler);
    this.startSecondTimer();
    this.updateGreeting();

    this.toggleDateRow(state.get("showDate") === true);
    this.toggleGreetings(state.get("hideGreetings") === true);

    if (this.els.greeting) {
      this.els.greeting.style.cursor = "pointer";
      this.els.greeting.title = "双击以设置您的称呼";
      this.els.greeting.addEventListener("dblclick", () => this.setUserName());
    }

    state.subscribe((key, value) => {
      if (key === "clockType" || key === "clockFormat") {
        this.update();
        this.syncAnalogLoop();
        if (key === "clockType" && this.els.master) {
          this.els.master.classList.remove("clock-switched");
          void this.els.master.offsetWidth;
          this.els.master.classList.add("clock-switched");
        }
      }
      if (key === "disableAnimations") this.syncAnalogLoop();
      if (key === "showDate") this.toggleDateRow(value);
      if (key === "hideGreetings") this.toggleGreetings(value);
      if (key === "userName") {
        this.currentGreeting = "";
        this.updateGreeting();
      }
    });

    this.syncAnalogLoop();
  }

  startSecondTimer() {
    clearInterval(this._secondTimer);
    this._secondTimer = null;
    if (document.hidden) return;
    this._secondTimer = window.setInterval(() => this.update(), 1000);
  }

  syncAnalogLoop() {
    const shouldAnimate = !document.hidden &&
      state.get("clockType") === "analog";
    if (!shouldAnimate) {
      if (this._animationFrame !== null) {
        cancelAnimationFrame(this._animationFrame);
        this._animationFrame = null;
      }
      return;
    }
    if (this._animationFrame !== null) return;
    const animate = () => {
      if (document.hidden || state.get("clockType") !== "analog") {
        this._animationFrame = null;
        return;
      }
      this.updateAnalog();
      this._animationFrame = requestAnimationFrame(animate);
    };
    this._animationFrame = requestAnimationFrame(animate);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.startSecondTimer();
      this.syncAnalogLoop();
      this.cancelGreetingAnimation();
      return;
    }
    this.startSecondTimer();
    this.update();
    this.syncAnalogLoop();
    this.updateGreeting();
  }

  async setUserName() {
    const currentName = String(state.get("userName") || "")
      .trim()
      .slice(0, MAX_USER_NAME_LENGTH);
    const newName = await showCustomPrompt(
      "请问该如何称呼您？",
      currentName,
      {
        maxLength: MAX_USER_NAME_LENGTH,
        autoFocus: true,
        selectAll: currentName.length > 0,
      },
    );
    if (newName !== null) {
      state.set(
        "userName",
        String(newName).trim().slice(0, MAX_USER_NAME_LENGTH),
      );
      import("../core/utils.js").then((utils) => {
        utils.completeDefaultTask("vv-3");
      });
    }
  }

  toggleDateRow(show) {
    if (this.els.dateRow) {
      this.els.dateRow.classList.toggle("hidden", !show);
    }
  }

  toggleGreetings(hide) {
    if (this.els.greeting) {
      this.els.greeting.style.display = hide ? "none" : "";
      if (hide) this.cancelGreetingAnimation();
      else this.updateGreeting();
    }
  }

  // Clock display
  update() {
    const now = new Date();
    const type = state.get("clockType");
    const format = state.get("clockFormat");

    if (type === "analog") {
      this.els.master.classList.add("analog-active");
      this.els.master.classList.remove("digital-active");
      this.els.master.style.height = "250px";
    } else {
      this.els.master.classList.remove("analog-active");
      this.els.master.classList.add("digital-active");
      this.els.master.style.height = "140px";
    }

    let hours = now.getHours();
    if (format === "12") {
      this.els.ampm.textContent = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
    } else {
      this.els.ampm.textContent = "";
    }

    this.els.hours.textContent = formatTime(hours);
    this.els.minutes.textContent = formatTime(now.getMinutes());
    this.els.seconds.textContent = formatTime(now.getSeconds());

    const isChinese = isZh();
    const days = isChinese ? WEEKDAYS_ZH : WEEKDAYS_EN;
    const dayName = days[now.getDay()];
    const dateNum = now.getDate();

    if (this.els.day) this.els.day.textContent = dayName;
    if (this.els.date) {
      this.els.date.textContent = isChinese
        ? `${now.getMonth() + 1}月${dateNum}日`
        : `${dateNum} ${now.toLocaleString("en-US", { month: "long" })}`;
    }

    if (now.getSeconds() === 0) this.updateGreeting();
  }

  updateAnalog() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const secondsWithMs = now.getSeconds() + now.getMilliseconds() / 1000;
    const motionDisabled = state.get("disableAnimations") === true;

    const hourDegrees = ((hours % 12) + (motionDisabled ? 0 : minutes / 60)) * 30;
    const minuteDegrees = (minutes + (motionDisabled ? 0 : secondsWithMs / 60)) * 6;

    const secondAngle = (motionDisabled ? now.getSeconds() : secondsWithMs) * 6 - 90;
    const radius = 85;
    const radian = secondAngle * (Math.PI / 180);
    const cx = 100 + radius * Math.cos(radian);
    const cy = 100 + radius * Math.sin(radian);

    this.els.hourHand.style.transform = `rotate(${hourDegrees}deg)`;
    this.els.minuteHand.style.transform = `rotate(${minuteDegrees}deg)`;
    this.els.secondDot.setAttribute("cx", cx);
    this.els.secondDot.setAttribute("cy", cy);
  }

  // Greeting display
  updateGreeting() {
    if (!this.els.greeting) return;

    const greeting = this.getGreetingText();
    const displayedGreeting = this.els.greeting.textContent.trim();
    if (this.currentGreeting === greeting && displayedGreeting === greeting) {
      return;
    }

    this.cancelGreetingAnimation();
    this.currentGreeting = greeting;
    if (document.hidden || state.get("hideGreetings") === true) return;
    if (state.get("disableAnimations") === true) {
      this.els.greeting.textContent = greeting;
      return;
    }
    this._greetingDelayTimer = window.setTimeout(() => {
      this._greetingDelayTimer = null;
      if (this.els.greeting.textContent.trim() !== greeting) {
        this.typewriter(this.els.greeting, greeting, 45);
      }
    }, 400);
  }

  getGreetingText() {
    const now = new Date();
    const hour = now.getHours();
    let period;

    if (hour >= 5 && hour < 6) period = "earlyMorning";
    else if (hour >= 6 && hour < 12) period = "morning";
    else if (hour >= 12 && hour < 18) period = "afternoon";
    else if (hour >= 18 && hour < 20) period = "evening";
    else if (hour >= 20 && hour < 24) period = "night";
    else period = "lateNight";

    const isChinese = isZh();
    const variants = isChinese ? GREETING_VARIANTS_ZH[period] : GREETING_VARIANTS_EN[period];
    const days = isChinese ? WEEKDAYS_ZH : WEEKDAYS_EN;
    const selectedGreeting = variants[getDailyGreetingIndex(now, period, variants.length)];
    const dayName = days[now.getDay()];
    let greeting = selectedGreeting.replace("{day}", dayName);

    const cleanName = String(state.get("userName") || "")
      .trim()
      .slice(0, MAX_USER_NAME_LENGTH);
    if (cleanName) {
      const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      const ending = greeting.match(/[.!?。！？]$/)?.[0] || "";
      const body = ending ? greeting.slice(0, -1) : greeting;
      greeting = `${body}，${formattedName}${ending}`;
    }
    return greeting;
  }

  cancelGreetingAnimation() {
    clearTimeout(this._greetingDelayTimer);
    clearInterval(this._greetingTypingTimer);
    this._greetingDelayTimer = null;
    this._greetingTypingTimer = null;
    this.els.greeting?.classList.remove("typing-effect");
  }

  typewriter(element, text, speed = 75) {
    this.cancelGreetingAnimation();
    element.classList.add("typing-effect");
    let i = 0;
    element.textContent = "";

    this._greetingTypingTimer = window.setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(this._greetingTypingTimer);
        this._greetingTypingTimer = null;
        element.classList.remove("typing-effect");
      }
    }, speed);
  }
}
