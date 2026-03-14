const hostnameEl = document.getElementById("hostname");
const ipAddressesEl = document.getElementById("ipAddresses");
const installedReleaseEl = document.getElementById("installedRelease");
const updatedAtEl = document.getElementById("updatedAt");
const updateSummaryEl = document.getElementById("updateSummary");
const updateMessageEl = document.getElementById("updateMessage");
const formStatusEl = document.getElementById("formStatus");
const formEl = document.getElementById("settingsForm");
const pageNavEl = document.getElementById("pageNav");
const modulesListEl = document.getElementById("modulesList");
const moduleStatusEl = document.getElementById("moduleStatus");
const clockSettingsFormEl = document.getElementById("clockSettingsForm");
const clockFormStatusEl = document.getElementById("clockFormStatus");

const basePages = [
  { id: "overview", label: "Overview" },
  { id: "modules", label: "Modules" },
];

let moduleState = { modules: {} };

async function getJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function setSettingsForm(settings) {
  document.getElementById("deviceName").value = settings.device_name || "";
  document.getElementById("timezone").value = settings.timezone || "";
  document.getElementById("webPort").value = settings.web_port || 8080;
  document.getElementById("updateChannel").value = settings.update_channel || "stable";
  document.getElementById("sshEnabled").checked = Boolean(settings.ssh_enabled);
}

function setClockSettingsForm(settings) {
  document.getElementById("clockDisplayType").value = settings.display_type || "digital";
  document.getElementById("clockHourMode").value = settings.hour_mode || "24";
  document.getElementById("clockDateFormat").value = settings.date_format || "dd/mm/yyyy";
  document.getElementById("clockDisplaySize").value = settings.display_size || "large";
  document.getElementById("clockScreenPosition").value = settings.screen_position || "center";
}

function titleCase(value) {
  return String(value || "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderClockPreview(settings) {
  document.getElementById("clockPreviewTitle").textContent = `${titleCase(settings.display_type)} clock preview`;
  document.getElementById("clockPreviewHourMode").textContent = settings.hour_mode === "12" ? "12-hour" : "24-hour";
  document.getElementById("clockPreviewDateFormat").textContent = settings.date_format.toUpperCase();
  document.getElementById("clockPreviewSize").textContent = titleCase(settings.display_size);
  document.getElementById("clockPreviewPosition").textContent = titleCase(settings.screen_position);
}

function renderClockSettings(module) {
  const settings = module?.settings || {
    display_type: "digital",
    hour_mode: "24",
    date_format: "dd/mm/yyyy",
    display_size: "large",
    screen_position: "center",
  };
  setClockSettingsForm(settings);
  renderClockPreview(settings);
}

function renderSystemState(systemState) {
  hostnameEl.textContent = systemState.hostname || "Unknown";
  ipAddressesEl.textContent = (systemState.ip_addresses || []).join(", ") || "No IPv4 address detected";
  installedReleaseEl.textContent = systemState.release.release || "Unknown";
  updatedAtEl.textContent = systemState.release.updated_at || "Unknown";
  renderUpdateStatus(systemState.update_status);
  setSettingsForm(systemState.settings);
  renderModules(systemState.modules || moduleState);
}

function renderUpdateStatus(updateStatus) {
  updateSummaryEl.textContent = `${updateStatus.status || "unknown"}: latest ${updateStatus.latest_release || "unknown"}`;
  updateMessageEl.textContent = updateStatus.message || "";
}

async function loadSystemState() {
  const state = await getJson("/api/system");
  renderSystemState(state);
}

async function loadUpdateStatus() {
  const status = await getJson("/api/update-status");
  renderUpdateStatus(status);
}

function getEnabledModulePages(modulesPayload) {
  return Object.entries(modulesPayload.modules || {})
    .filter(([, module]) => module.enabled)
    .map(([moduleId, module]) => ({
      id: `module-${moduleId}`,
      label: module.title || moduleId,
    }));
}

function getCurrentPageId() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "overview";
}

function ensureVisiblePage() {
  const availablePageIds = new Set([
    ...basePages.map((page) => page.id),
    ...getEnabledModulePages(moduleState).map((page) => page.id),
  ]);
  const currentPageId = getCurrentPageId();
  if (!availablePageIds.has(currentPageId)) {
    window.location.hash = "#overview";
  }
}

function renderPageNav() {
  const pages = [...basePages, ...getEnabledModulePages(moduleState)];
  const currentPageId = getCurrentPageId();
  pageNavEl.innerHTML = pages
    .map((page) => {
      const activeClass = page.id === currentPageId ? " is-active" : "";
      return `<a class="page-link${activeClass}" href="#${page.id}">${page.label}</a>`;
    })
    .join("");
}

function renderPages() {
  const currentPageId = getCurrentPageId();
  document.querySelectorAll(".page").forEach((pageEl) => {
    const isActive = pageEl.dataset.page === currentPageId;
    pageEl.classList.toggle("is-active", isActive);
  });
}

function renderModules(modulesPayload) {
  moduleState = modulesPayload;
  const modules = Object.entries(modulesPayload.modules || {});
  modulesListEl.innerHTML = modules
    .map(([moduleId, module]) => `
      <article class="module-card">
        <div>
          <h3>${module.title || moduleId}</h3>
          <p>${module.description || ""}</p>
        </div>
        <label class="toggle module-toggle">
          <input data-module-id="${moduleId}" type="checkbox" ${module.enabled ? "checked" : ""}>
          <span>${module.enabled ? "Enabled" : "Disabled"}</span>
        </label>
      </article>
    `)
    .join("");
  renderClockSettings(modulesPayload.modules?.clock);
  ensureVisiblePage();
  renderPageNav();
  renderPages();
}

async function loadModules() {
  const modules = await getJson("/api/modules");
  renderModules(modules);
}

async function saveModules() {
  const saved = await getJson("/api/modules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(moduleState),
  });
  renderModules(saved);
}

async function handleModuleToggle(event) {
  const moduleId = event.target.dataset.moduleId;
  if (!moduleId) {
    return;
  }

  const nextModules = JSON.parse(JSON.stringify(moduleState));
  nextModules.modules[moduleId].enabled = event.target.checked;
  moduleStatusEl.textContent = "Saving module state...";

  try {
    moduleState = nextModules;
    await saveModules();
    moduleStatusEl.textContent = "Module state saved.";
  } catch (error) {
    event.target.checked = !event.target.checked;
    moduleStatusEl.textContent = error.message;
    await loadModules();
  }
}

async function saveClockSettings(event) {
  event.preventDefault();
  const nextModules = JSON.parse(JSON.stringify(moduleState));
  nextModules.modules.clock.settings = {
    display_type: document.getElementById("clockDisplayType").value,
    hour_mode: document.getElementById("clockHourMode").value,
    date_format: document.getElementById("clockDateFormat").value,
    display_size: document.getElementById("clockDisplaySize").value,
    screen_position: document.getElementById("clockScreenPosition").value,
  };
  clockFormStatusEl.textContent = "Saving clock settings...";

  try {
    moduleState = nextModules;
    await saveModules();
    clockFormStatusEl.textContent = "Clock settings saved.";
  } catch (error) {
    clockFormStatusEl.textContent = error.message;
    await loadModules();
  }
}

async function saveSettings(event) {
  event.preventDefault();
  formStatusEl.textContent = "Saving...";

  const payload = {
    device_name: document.getElementById("deviceName").value,
    timezone: document.getElementById("timezone").value,
    web_port: Number(document.getElementById("webPort").value),
    update_channel: document.getElementById("updateChannel").value,
    ssh_enabled: document.getElementById("sshEnabled").checked,
  };

  try {
    const saved = await getJson("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    setSettingsForm(saved);
    formStatusEl.textContent = "Settings saved.";
  } catch (error) {
    formStatusEl.textContent = error.message;
  }
}

document.getElementById("refreshStatus").addEventListener("click", () => {
  loadSystemState().catch((error) => {
    formStatusEl.textContent = error.message;
  });
});

document.getElementById("refreshUpdate").addEventListener("click", () => {
  loadUpdateStatus().catch((error) => {
    updateMessageEl.textContent = error.message;
  });
});

modulesListEl.addEventListener("change", (event) => {
  handleModuleToggle(event).catch((error) => {
    moduleStatusEl.textContent = error.message;
  });
});

clockSettingsFormEl.addEventListener("submit", (event) => {
  saveClockSettings(event);
});

clockSettingsFormEl.addEventListener("change", () => {
  renderClockPreview({
    display_type: document.getElementById("clockDisplayType").value,
    hour_mode: document.getElementById("clockHourMode").value,
    date_format: document.getElementById("clockDateFormat").value,
    display_size: document.getElementById("clockDisplaySize").value,
    screen_position: document.getElementById("clockScreenPosition").value,
  });
});

window.addEventListener("hashchange", () => {
  ensureVisiblePage();
  renderPageNav();
  renderPages();
});

formEl.addEventListener("submit", (event) => {
  saveSettings(event);
});

loadSystemState().catch((error) => {
  formStatusEl.textContent = error.message;
});

loadModules().catch((error) => {
  moduleStatusEl.textContent = error.message;
});
