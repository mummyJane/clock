const bedsideModulesEl = document.getElementById("bedsideModules");

let currentState = null;

async function getJson(path) {
  const response = await fetch(path);
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

loadSystemState().catch((error) => {
  bedsideModulesEl.className = "bedside-modules position-center";
  bedsideModulesEl.innerHTML = `<section class="module-empty"><h1>Bedside mode unavailable</h1><p>${error.message}</p></section>`;
});

window.setInterval(() => {
  if (currentState) {
    renderBedside();
  }
}, 1000);

window.setInterval(() => {
  loadSystemState().catch(() => {
    // Keep the last rendered state on transient fetch failures.
  });
}, 30000);
