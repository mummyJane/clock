const bedsideShellEl = document.getElementById("bedsideShell");
const bedsideModulesEl = document.getElementById("bedsideModules");
const mediaStageEl = document.getElementById("mediaStage");
const mediaControlsEl = document.getElementById("mediaControls");
const mediaPlayEl = document.getElementById("mediaPlay");
const mediaPauseEl = document.getElementById("mediaPause");
const mediaStopEl = document.getElementById("mediaStop");
const mediaVolumeEl = document.getElementById("mediaVolume");
const mediaClearEl = document.getElementById("mediaClear");
const alarmBannerEl = document.getElementById("alarmBanner");
const alarmBannerTitleEl = document.getElementById("alarmBannerTitle");
const alarmBannerMetaEl = document.getElementById("alarmBannerMeta");
const alarmStopEl = document.getElementById("alarmStop");

const CONTROL_HIDE_DELAY_MS = 4000;
const DEFAULT_MEDIA_VOLUME = 2;
const MAX_MEDIA_VOLUME = 3;
const VOLUME_STORAGE_KEY = "clock.media.volume";
const WEEKDAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

let currentState = null;
let currentMediaState = { selected_file: "", selected_kind: "none", playback_state: "stopped" };
let currentAlarmState = { active_alarm: null, upcoming_alarm: null, alarm_count: 0, enabled_count: 0 };
let currentMediaKey = "";
let currentMediaError = "";
let currentVolume = loadStoredVolume();
let controlsTimer = null;
let audioContext = null;
let currentConnectedElement = null;
let mediaSourceNode = null;
let mediaGainNode = null;

function clampVolume(value) {
  return Math.max(0, Math.min(MAX_MEDIA_VOLUME, value));
}

function loadStoredVolume() {
  try {
    const stored = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_MEDIA_VOLUME;
    }
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? clampVolume(parsed) : DEFAULT_MEDIA_VOLUME;
  } catch {
    return DEFAULT_MEDIA_VOLUME;
  }
}

function saveStoredVolume() {
  try {
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(currentVolume));
  } catch {
    // Ignore storage failures in kiosk mode.
  }
}

async function getJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function formatTime(now, settings, timezone) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: settings.hour_mode === "12",
    timeZone: timezone,
  }).format(now);
}

function formatDate(now, settings, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  if (settings.date_format === "mm/dd/yyyy") {
    return `${values.month}/${values.day}/${values.year}`;
  }
  if (settings.date_format === "yyyy-mm-dd") {
    return `${values.year}-${values.month}-${values.day}`;
  }
  return `${values.day}/${values.month}/${values.year}`;
}

function analogHands(now, timezone) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const second = values.second || 0;
  const minute = values.minute || 0;
  const hour = (values.hour || 0) % 12;
  return {
    hour: hour * 30 + minute * 0.5,
    minute: minute * 6 + second * 0.1,
    second: second * 6,
  };
}

function renderClockModule(module, timezone) {
  const settings = module.settings || {};
  const now = new Date();
  const sizeClass = `size-${settings.display_size || "large"}`;
  const formattedDate = formatDate(now, settings, timezone);

  if (settings.display_type === "analog") {
    const hands = analogHands(now, timezone);
    return `
      <section class="bedside-card clock-card ${sizeClass}">
        <p class="clock-label">Clock</p>
        <div class="analog-clock-face" aria-label="Analog clock">
          <div class="analog-hand analog-hour" style="transform: rotate(${hands.hour}deg);"></div>
          <div class="analog-hand analog-minute" style="transform: rotate(${hands.minute}deg);"></div>
          <div class="analog-hand analog-second" style="transform: rotate(${hands.second}deg);"></div>
          <div class="analog-center"></div>
        </div>
        <p class="clock-date">${formattedDate}</p>
      </section>
    `;
  }

  return `
    <section class="bedside-card clock-card ${sizeClass}">
      <p class="clock-label">Clock</p>
      <p class="clock-digital-time">${formatTime(now, settings, timezone)}</p>
      <p class="clock-date">${formattedDate}</p>
    </section>
  `;
}

function formatAlarmSchedule(alarm) {
  if (!alarm) {
    return "No alarm scheduled";
  }
  if (alarm.schedule_type === "countdown") {
    return `Once at ${new Date(alarm.trigger_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "2-digit" })}`;
  }
  if (alarm.schedule_type === "daily") {
    return `Every day at ${alarm.time_of_day}`;
  }
  if (alarm.schedule_type === "weekly") {
    return `${(alarm.days_of_week || []).map((day) => WEEKDAY_LABELS[day] || day).join(", ")} at ${alarm.time_of_day}`;
  }
  return alarm.schedule_type || "Alarm";
}

function renderAlarmModule(module) {
  const activeAlarm = currentAlarmState.active_alarm;
  const upcomingAlarm = currentAlarmState.upcoming_alarm;
  const summary = activeAlarm
    ? `Ringing now: ${activeAlarm.label || "Alarm"}`
    : upcomingAlarm
      ? formatAlarmSchedule(upcomingAlarm)
      : "No enabled alarms";

  return `
    <section class="bedside-card alarm-card-surface">
      <p class="clock-label">Alarm</p>
      <p class="alarm-card-title">${activeAlarm ? "Alarm active" : (module.title || "Alarm")}</p>
      <p class="clock-date">${summary}</p>
    </section>
  `;
}

function showControls() {
  if (!currentMediaState.selected_file) {
    return;
  }
  mediaControlsEl.classList.remove("is-hidden");
  if (controlsTimer) {
    window.clearTimeout(controlsTimer);
  }
  controlsTimer = window.setTimeout(() => {
    mediaControlsEl.classList.add("is-hidden");
  }, CONTROL_HIDE_DELAY_MS);
}

function setMediaControlState() {
  const hasSelection = Boolean(currentMediaState.selected_file);
  const isReady = (currentMediaState.playback_status || "ready") === "ready";
  const canAdjustPlayback = hasSelection && currentMediaState.selected_kind !== "image" && isReady;
  mediaPlayEl.disabled = !canAdjustPlayback || currentMediaState.playback_state === "playing";
  mediaPauseEl.disabled = !canAdjustPlayback || currentMediaState.playback_state !== "playing";
  mediaStopEl.disabled = !hasSelection;
  mediaVolumeEl.disabled = !canAdjustPlayback;
  mediaClearEl.disabled = !hasSelection;
}

function mediaUrlForState() {
  return currentMediaState.playback_url || "";
}

function syncVolumeControl() {
  mediaVolumeEl.value = String(Math.round(currentVolume * 100));
}

function ensureAudioContext() {
  if (audioContext) {
    return audioContext;
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }
  try {
    audioContext = new AudioContextCtor();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function connectMediaAudio(mediaElement) {
  const context = ensureAudioContext();
  if (!context) {
    currentConnectedElement = null;
    mediaSourceNode = null;
    mediaGainNode = null;
    return;
  }
  if (currentConnectedElement === mediaElement && mediaGainNode) {
    mediaGainNode.gain.value = currentVolume;
    return;
  }
  if (mediaSourceNode) {
    try {
      mediaSourceNode.disconnect();
    } catch {}
  }
  if (mediaGainNode) {
    try {
      mediaGainNode.disconnect();
    } catch {}
  }
  mediaSourceNode = context.createMediaElementSource(mediaElement);
  mediaGainNode = context.createGain();
  mediaSourceNode.connect(mediaGainNode);
  mediaGainNode.connect(context.destination);
  currentConnectedElement = mediaElement;
  mediaGainNode.gain.value = currentVolume;
}

function applyMediaVolume() {
  const mediaElement = mediaStageEl.querySelector("audio, video");
  if (!mediaElement) {
    return;
  }
  connectMediaAudio(mediaElement);
  if (mediaGainNode) {
    mediaElement.volume = 1;
    mediaGainNode.gain.value = currentVolume;
    return;
  }
  mediaElement.volume = Math.min(currentVolume, 1);
}

async function resumeMediaPlayback() {
  const context = ensureAudioContext();
  if (context && context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Ignore resume failures and let the element attempt playback directly.
    }
  }
  applyMediaVolume();
  const mediaElement = mediaStageEl.querySelector("audio, video");
  if (mediaElement && currentMediaState.playback_state === "playing") {
    mediaElement.play().catch(() => {});
  }
}

function syncMediaElementPlayback() {
  const mediaElement = mediaStageEl.querySelector("audio, video");
  if (!mediaElement) {
    return;
  }

  applyMediaVolume();

  if (currentMediaState.playback_state === "playing") {
    mediaElement.play().catch(() => {});
    return;
  }

  mediaElement.pause();
  if (currentMediaState.playback_state === "stopped") {
    mediaElement.currentTime = 0;
  }
}

function applyMediaError() {
  if (currentMediaError) {
    mediaStageEl.dataset.mediaError = currentMediaError;
    return;
  }
  delete mediaStageEl.dataset.mediaError;
}

function attachMediaHandlers(mediaElement) {
  mediaElement.loop = false;
  applyMediaVolume();
  mediaElement.addEventListener("ended", () => {
    sendMediaAction("stop").catch(() => {});
  });
  mediaElement.addEventListener("error", () => {
    if (currentMediaState.selected_kind === "video") {
      currentMediaError = currentMediaState.message || "This video could not be played after preparation.";
      applyMediaError();
      showControls();
    }
  });
  mediaElement.addEventListener("canplay", () => {
    currentMediaError = "";
    applyMediaError();
  });
}

function renderAlarmBanner() {
  const activeAlarm = currentAlarmState.active_alarm;
  if (!activeAlarm) {
    alarmBannerEl.classList.add("is-hidden");
    alarmBannerMetaEl.textContent = "";
    return;
  }
  alarmBannerTitleEl.textContent = activeAlarm.label || "Alarm active";
  alarmBannerMetaEl.textContent = `Playing ${activeAlarm.media_file || "audio"}`;
  alarmBannerEl.classList.remove("is-hidden");
}

function renderMediaStage() {
  setMediaControlState();
  syncVolumeControl();
  renderAlarmBanner();

  if (!currentMediaState.selected_file) {
    mediaStageEl.className = "media-stage is-hidden";
    mediaStageEl.innerHTML = "";
    currentMediaError = "";
    delete mediaStageEl.dataset.mediaError;
    bedsideShellEl.classList.remove("has-media");
    mediaControlsEl.classList.add("is-hidden");
    currentConnectedElement = null;
    mediaSourceNode = null;
    mediaGainNode = null;
    currentMediaKey = "";
    return;
  }

  const nextUrl = mediaUrlForState();
  const fileName = currentMediaState.selected_file.split("/").pop();
  const nextMediaKey = `${currentMediaState.selected_kind}:${currentMediaState.selected_file}`;
  const shouldRebuild = currentMediaKey !== nextMediaKey || !mediaStageEl.querySelector("img, audio, video");

  bedsideShellEl.classList.add("has-media");
  bedsideModulesEl.classList.add("is-hidden");
  mediaStageEl.className = `media-stage kind-${currentMediaState.selected_kind}`;

  if (currentMediaKey !== nextMediaKey) {
    currentMediaError = "";
    currentConnectedElement = null;
    mediaSourceNode = null;
    mediaGainNode = null;
  }

  if (shouldRebuild) {
    const playbackStatus = currentMediaState.playback_status || "ready";
    const statusMessage = currentMediaState.message || "";

    if (currentMediaState.selected_kind === "image") {
      mediaStageEl.innerHTML = `<img class="media-image" src="${nextUrl}" alt="${fileName}">`;
    } else if (currentMediaState.selected_kind === "audio") {
      mediaStageEl.innerHTML = `
        <section class="media-audio-card">
          <p class="clock-label">Now playing</p>
          <h1>${fileName}</h1>
          <p>${statusMessage || "Touch the screen to show playback controls."}</p>
          <audio id="bedsideMediaElement" src="${nextUrl}" preload="auto"></audio>
        </section>
      `;
    } else if (playbackStatus !== "ready") {
      mediaStageEl.innerHTML = `
        <section class="media-audio-card">
          <p class="clock-label">Video</p>
          <h1>${fileName}</h1>
          <p>${statusMessage || (playbackStatus === "preparing" ? "Preparing a compatible video file..." : "This video could not be prepared for playback.")}</p>
        </section>
      `;
    } else {
      mediaStageEl.innerHTML = `<video id="bedsideMediaElement" class="media-video" src="${nextUrl}" playsinline preload="auto"></video>`;
    }

    const mediaElement = mediaStageEl.querySelector("audio, video");
    if (mediaElement) {
      attachMediaHandlers(mediaElement);
    }
    currentMediaKey = nextMediaKey;
  }

  applyMediaError();
  applyMediaVolume();
  syncMediaElementPlayback();
}

function renderBedside() {
  if (!currentState) {
    return;
  }

  const timezone = currentState.settings?.timezone || "Europe/London";
  const modules = currentState.modules?.modules || {};
  const enabledModules = Object.entries(modules).filter(([, module]) => module.enabled);

  if (enabledModules.length === 0) {
    bedsideModulesEl.className = "bedside-modules position-center";
    bedsideModulesEl.innerHTML = "";
    if (!currentMediaState.selected_file) {
      bedsideModulesEl.classList.remove("is-hidden");
    }
    renderAlarmBanner();
    return;
  }

  const firstPosition = enabledModules[0][1].settings?.screen_position || "center";
  bedsideModulesEl.className = `bedside-modules position-${firstPosition}`;
  bedsideModulesEl.innerHTML = enabledModules
    .map(([moduleId, module]) => {
      if (moduleId === "clock") {
        return renderClockModule(module, timezone);
      }
      if (moduleId === "alarm") {
        return renderAlarmModule(module);
      }
      return `
        <section class="bedside-card">
          <p class="clock-label">${module.title || moduleId}</p>
          <p>${module.description || "Enabled module"}</p>
        </section>
      `;
    })
    .join("");
  renderAlarmBanner();
}

async function loadSystemState() {
  currentState = await getJson("/api/system");
  currentAlarmState = currentState.alarm_state || currentAlarmState;
  renderBedside();
}

async function loadMediaState() {
  currentMediaState = await getJson("/api/media/state");
  renderMediaStage();
  renderBedside();
}

async function sendMediaAction(action) {
  currentMediaState = await getJson("/api/media/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  renderMediaStage();
  renderBedside();
  showControls();
  resumeMediaPlayback().catch(() => {});
}

async function stopAlarm() {
  await getJson("/api/alarm/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  await Promise.all([loadSystemState(), loadMediaState()]);
}

bedsideShellEl.addEventListener("pointerdown", () => {
  showControls();
  resumeMediaPlayback().catch(() => {});
});

mediaPlayEl.addEventListener("click", () => { sendMediaAction("play").catch(() => {}); });
mediaPauseEl.addEventListener("click", () => { sendMediaAction("pause").catch(() => {}); });
mediaStopEl.addEventListener("click", () => { sendMediaAction("stop").catch(() => {}); });
mediaVolumeEl.addEventListener("input", () => {
  currentVolume = clampVolume(Number(mediaVolumeEl.value) / 100);
  saveStoredVolume();
  applyMediaVolume();
  resumeMediaPlayback().catch(() => {});
  showControls();
});
mediaClearEl.addEventListener("click", () => { sendMediaAction("clear").catch(() => {}); });
alarmStopEl.addEventListener("click", () => { stopAlarm().catch(() => {}); });

Promise.all([loadSystemState(), loadMediaState()]).catch((error) => {
  bedsideModulesEl.className = "bedside-modules position-center";
  bedsideModulesEl.innerHTML = `<section class="module-empty"><h1>Bedside mode unavailable</h1><p>${error.message}</p></section>`;
});

window.setInterval(() => {
  if (currentState) {
    renderBedside();
  }
}, 1000);

window.setInterval(() => {
  loadSystemState().catch(() => {});
  loadMediaState().catch(() => {});
}, 5000);
