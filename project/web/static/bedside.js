const bedsideShellEl = document.getElementById("bedsideShell");
const bedsideModulesEl = document.getElementById("bedsideModules");
const mediaStageEl = document.getElementById("mediaStage");
const mediaControlsEl = document.getElementById("mediaControls");
const mediaPlayEl = document.getElementById("mediaPlay");
const mediaPauseEl = document.getElementById("mediaPause");
const mediaStopEl = document.getElementById("mediaStop");
const mediaClearEl = document.getElementById("mediaClear");

const CONTROL_HIDE_DELAY_MS = 4000;

let currentState = null;
let currentMediaState = { selected_file: "", selected_kind: "none", playback_state: "stopped" };
let currentMediaUrl = "";
let controlsTimer = null;

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
  mediaPlayEl.disabled = !hasSelection || currentMediaState.selected_kind === "image" || currentMediaState.playback_state === "playing";
  mediaPauseEl.disabled = !hasSelection || currentMediaState.selected_kind === "image" || currentMediaState.playback_state !== "playing";
  mediaStopEl.disabled = !hasSelection;
  mediaClearEl.disabled = !hasSelection;
}

function mediaUrlForState() {
  if (!currentMediaState.selected_file) {
    return "";
  }
  return `/media/${currentMediaState.selected_file.split("/").map(encodeURIComponent).join("/")}?t=${encodeURIComponent(currentMediaState.updated_at || "")}`;
}

function syncMediaElementPlayback() {
  const mediaElement = mediaStageEl.querySelector("audio, video");
  if (!mediaElement) {
    return;
  }

  if (currentMediaState.playback_state === "playing") {
    mediaElement.play().catch(() => {});
    return;
  }

  mediaElement.pause();
  if (currentMediaState.playback_state === "stopped") {
    mediaElement.currentTime = 0;
  }
}

function renderMediaStage() {
  setMediaControlState();
  if (!currentMediaState.selected_file) {
    mediaStageEl.className = "media-stage is-hidden";
    mediaStageEl.innerHTML = "";
    bedsideModulesEl.classList.remove("is-hidden");
    mediaControlsEl.classList.add("is-hidden");
    currentMediaUrl = "";
    return;
  }

  const nextUrl = mediaUrlForState();
  const fileName = currentMediaState.selected_file.split("/").pop();
  bedsideModulesEl.classList.add("is-hidden");
  mediaStageEl.className = `media-stage kind-${currentMediaState.selected_kind}`;

  if (currentMediaState.selected_kind === "image") {
    mediaStageEl.innerHTML = `<img class="media-image" src="${nextUrl}" alt="${fileName}">`;
  } else if (currentMediaState.selected_kind === "audio") {
    mediaStageEl.innerHTML = `
      <section class="media-audio-card">
        <p class="clock-label">Now playing</p>
        <h1>${fileName}</h1>
        <p>Touch the screen to show playback controls.</p>
        <audio id="bedsideMediaElement" src="${nextUrl}" preload="auto"></audio>
      </section>
    `;
  } else {
    mediaStageEl.innerHTML = `<video id="bedsideMediaElement" class="media-video" src="${nextUrl}" playsinline preload="auto"></video>`;
  }

  currentMediaUrl = nextUrl;
  const mediaElement = mediaStageEl.querySelector("audio, video");
  if (mediaElement) {
    mediaElement.loop = false;
    mediaElement.addEventListener("ended", () => {
      sendMediaAction("stop").catch(() => {});
    }, { once: true });
    syncMediaElementPlayback();
  }
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
    bedsideModulesEl.innerHTML = `
      <section class="module-empty">
        <h1>No modules enabled</h1>
        <p>Open the setup interface and enable at least one module to show it here in bedside mode.</p>
      </section>
    `;
    return;
  }

  const firstPosition = enabledModules[0][1].settings?.screen_position || "center";
  bedsideModulesEl.className = `bedside-modules position-${firstPosition}`;
  bedsideModulesEl.innerHTML = enabledModules
    .map(([moduleId, module]) => {
      if (moduleId === "clock") {
        return renderClockModule(module, timezone);
      }
      return `
        <section class="bedside-card">
          <p class="clock-label">${module.title || moduleId}</p>
          <p>${module.description || "Enabled module"}</p>
        </section>
      `;
    })
    .join("");
}

async function loadSystemState() {
  currentState = await getJson("/api/system");
  renderBedside();
}

async function loadMediaState() {
  currentMediaState = await getJson("/api/media/state");
  renderMediaStage();
}

async function sendMediaAction(action) {
  currentMediaState = await getJson("/api/media/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  renderMediaStage();
  showControls();
}

bedsideShellEl.addEventListener("pointerdown", () => {
  showControls();
});

mediaPlayEl.addEventListener("click", () => { sendMediaAction("play").catch(() => {}); });
mediaPauseEl.addEventListener("click", () => { sendMediaAction("pause").catch(() => {}); });
mediaStopEl.addEventListener("click", () => { sendMediaAction("stop").catch(() => {}); });
mediaClearEl.addEventListener("click", () => { sendMediaAction("clear").catch(() => {}); });

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
