const hostnameEl = document.getElementById("hostname");
const ipAddressesEl = document.getElementById("ipAddresses");
const installedReleaseEl = document.getElementById("installedRelease");
const updatedAtEl = document.getElementById("updatedAt");
const cpuTemperatureEl = document.getElementById("cpuTemperature");
const batteryVoltageEl = document.getElementById("batteryVoltage");
const mountCountEl = document.getElementById("mountCount");
const diskSummaryEl = document.getElementById("diskSummary");
const mountStatusEl = document.getElementById("mountStatus");
const powerActionStatusEl = document.getElementById("powerActionStatus");
const updateSummaryEl = document.getElementById("updateSummary");
const updateMessageEl = document.getElementById("updateMessage");
const updateDetailsEl = document.getElementById("updateDetails");
const formStatusEl = document.getElementById("formStatus");
const formEl = document.getElementById("settingsForm");
const pageNavEl = document.getElementById("pageNav");
const modulesListEl = document.getElementById("modulesList");
const moduleStatusEl = document.getElementById("moduleStatus");
const clockSettingsFormEl = document.getElementById("clockSettingsForm");
const clockFormStatusEl = document.getElementById("clockFormStatus");
const rebootButtonEl = document.getElementById("rebootButton");
const haltButtonEl = document.getElementById("haltButton");
const mediaSharePathEl = document.getElementById("mediaSharePath");
const mediaCurrentPathEl = document.getElementById("mediaCurrentPath");
const mediaSelectionEl = document.getElementById("mediaSelection");
const mediaBrowserEl = document.getElementById("mediaBrowser");
const mediaStatusEl = document.getElementById("mediaStatus");
const clearMediaSelectionEl = document.getElementById("clearMediaSelection");

const basePages = [
  { id: "overview", label: "Overview" },
  { id: "media", label: "Media" },
  { id: "modules", label: "Modules" },
];

let moduleState = { modules: {} };
let mediaState = { selected_file: "", selected_kind: "none", playback_state: "stopped" };
let currentMediaPath = "";

async function getJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed.");
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setSettingsForm(settings) {
  document.getElementById("deviceName").value = settings.device_name || "";
  document.getElementById("timezone").value = settings.timezone || "";
  document.getElementById("webPort").value = settings.web_port || 8080;
  document.getElementById("repoPath").value = settings.repo_path || "";
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

function formatTemperature(payload) {
  if (!payload || payload.status === "unavailable") {
    return "Unavailable";
  }
  if (payload.status === "error" || payload.celsius == null) {
    return "Read error";
  }
  return `${payload.celsius.toFixed(1)} C`;
}

function formatBattery(payload) {
  if (!payload || payload.status === "unavailable") {
    return "Unavailable";
  }
  if (payload.status === "error" || payload.volts == null) {
    return "Read error";
  }
  return `${payload.volts.toFixed(3)} V${payload.source === "rtc" ? " (RTC)" : ""}`;
}

function renderMounts(mounts) {
  if (!mounts.length) {
    mountStatusEl.innerHTML = '<p class="support-copy">No physical mounts detected.</p>';
    return;
  }

  mountStatusEl.innerHTML = `
    <table class="mount-table">
      <thead>
        <tr>
          <th>Mount</th>
          <th>Device</th>
          <th>Type</th>
          <th>Used</th>
          <th>Free</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${mounts.map((mount) => `
          <tr>
            <td>${escapeHtml(mount.mount_point)}</td>
            <td>${escapeHtml(mount.device)}</td>
            <td>${escapeHtml(mount.filesystem)}</td>
            <td>${mount.percent_used}% (${mount.used_gb} GB)</td>
            <td>${mount.free_gb} GB</td>
            <td>${mount.total_gb} GB</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderSystemHealth(systemStatus) {
  const mounts = systemStatus.mounts || [];
  const mostUsedMount = mounts.reduce((highest, mount) => {
    if (!highest || mount.percent_used > highest.percent_used) {
      return mount;
    }
    return highest;
  }, null);

  cpuTemperatureEl.textContent = formatTemperature(systemStatus.temperature);
  batteryVoltageEl.textContent = formatBattery(systemStatus.battery);
  mountCountEl.textContent = String(systemStatus.mount_count ?? mounts.length ?? 0);
  diskSummaryEl.textContent = mostUsedMount ? `${mostUsedMount.mount_point} at ${mostUsedMount.percent_used}%` : "No mount data";
  renderMounts(mounts);
}

function renderSystemHealthError(message) {
  cpuTemperatureEl.textContent = "Unavailable";
  batteryVoltageEl.textContent = "Unavailable";
  mountCountEl.textContent = "0";
  diskSummaryEl.textContent = "Unavailable";
  mountStatusEl.innerHTML = `<p class="support-copy">${escapeHtml(message)}</p>`;
}

function renderUpdateStatus(updateStatus) {
  updateSummaryEl.textContent = `${updateStatus.status || "unknown"}: latest ${updateStatus.latest_release || "unknown"}`;
  updateMessageEl.textContent = updateStatus.message || "";

  const details = [];
  if (updateStatus.repo_path) {
    details.push(`Repo: ${updateStatus.repo_path}`);
  }
  if (updateStatus.branch && updateStatus.upstream) {
    details.push(`Branch: ${updateStatus.branch} -> ${updateStatus.upstream}`);
  }
  if (updateStatus.local_sha && updateStatus.remote_sha) {
    details.push(`Commits: local ${updateStatus.local_sha}, remote ${updateStatus.remote_sha}`);
  }
  if (updateStatus.checked_at && updateStatus.checked_at !== "never") {
    details.push(`Checked: ${updateStatus.checked_at}`);
  }
  updateDetailsEl.textContent = details.join(" | ");
}

function renderMediaState(state) {
  mediaState = state || mediaState;
  if (!mediaState.selected_file) {
    mediaSelectionEl.innerHTML = '<p class="support-copy">No media file selected. Add files through the Samba share and choose one here.</p>';
    clearMediaSelectionEl.disabled = true;
    return;
  }

  mediaSelectionEl.innerHTML = `
    <article class="media-selection-card">
      <h3>${escapeHtml(mediaState.selected_file.split("/").pop())}</h3>
      <p>${escapeHtml(mediaState.selected_kind || "unknown")} | ${escapeHtml(mediaState.playback_state || "stopped")}</p>
      <p class="support-copy">Selected path: ${escapeHtml(mediaState.selected_file)}</p>
    </article>
  `;
  clearMediaSelectionEl.disabled = false;
}

function renderMediaBrowser(listing) {
  currentMediaPath = listing.current_path || "";
  mediaSharePathEl.textContent = listing.share_path || "Unknown";
  mediaCurrentPathEl.textContent = currentMediaPath || "/";

  const parentButton = currentMediaPath
    ? `<button class="ghost-button" type="button" data-media-path="${escapeHtml(listing.parent_path || "")}">Open parent</button>`
    : "";

  const entries = listing.entries || [];
  if (!entries.length) {
    mediaBrowserEl.innerHTML = `${parentButton}<p class="support-copy">No media files found in this folder yet.</p>`;
    return;
  }

  mediaBrowserEl.innerHTML = `
    ${parentButton}
    <div class="media-entry-list">
      ${entries.map((entry) => {
        if (entry.type === "directory") {
          return `
            <article class="media-entry-card">
              <div>
                <h3>${escapeHtml(entry.name)}</h3>
                <p>Folder</p>
              </div>
              <button class="primary-button" type="button" data-media-path="${escapeHtml(entry.relative_path)}">Open</button>
            </article>
          `;
        }

        const actionButton = entry.selectable
          ? `<button class="primary-button" type="button" data-select-media="${escapeHtml(entry.relative_path)}">Select</button>`
          : `<span class="media-entry-note">Unsupported</span>`;
        return `
          <article class="media-entry-card">
            <div>
              <h3>${escapeHtml(entry.name)}</h3>
              <p>${escapeHtml(entry.kind)} | ${entry.size_bytes || 0} bytes</p>
            </div>
            ${actionButton}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderSystemState(systemState) {
  hostnameEl.textContent = systemState.hostname || "Unknown";
  ipAddressesEl.textContent = (systemState.ip_addresses || []).join(", ") || "No IPv4 address detected";
  installedReleaseEl.textContent = systemState.release.release || "Unknown";
  updatedAtEl.textContent = systemState.release.updated_at || "Unknown";
  renderUpdateStatus(systemState.update_status || {});
  setSettingsForm(systemState.settings || {});
  renderModules(systemState.modules || moduleState);
  renderMediaState(systemState.media_state || mediaState);
}

async function loadSystemState() {
  const state = await getJson("/api/system");
  renderSystemState(state);
}

async function loadSystemStatus() {
  const status = await getJson("/api/system-status");
  renderSystemHealth(status);
}

async function loadMediaBrowser(path = currentMediaPath) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const listing = await getJson(`/api/media/files${query}`);
  renderMediaBrowser(listing);
}

async function loadMediaState() {
  const state = await getJson("/api/media/state");
  renderMediaState(state);
}

async function refreshOverview() {
  const results = await Promise.allSettled([loadSystemState(), loadSystemStatus()]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) {
    renderSystemHealthError(failed.reason?.message || "System health is unavailable.");
    throw failed.reason;
  }
}

async function checkUpdateStatus() {
  updateMessageEl.textContent = "Checking repository for updates...";
  const status = await getJson("/api/update-status/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  renderUpdateStatus(status);
}

function getEnabledModulePages(modulesPayload) {
  return Object.entries(modulesPayload.modules || {})
    .filter(([, module]) => module.enabled)
    .map(([moduleId, module]) => ({ id: `module-${moduleId}`, label: module.title || moduleId }));
}

function getCurrentPageId() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || "overview";
}

function ensureVisiblePage() {
  const availablePageIds = new Set([...basePages.map((page) => page.id), ...getEnabledModulePages(moduleState).map((page) => page.id)]);
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
      return `<a class="page-link${activeClass}" href="#${page.id}">${escapeHtml(page.label)}</a>`;
    })
    .join("");
}

function renderPages() {
  const currentPageId = getCurrentPageId();
  document.querySelectorAll(".page").forEach((pageEl) => {
    pageEl.classList.toggle("is-active", pageEl.dataset.page === currentPageId);
  });
}

function renderModules(modulesPayload) {
  moduleState = modulesPayload;
  const modules = Object.entries(modulesPayload.modules || {});
  modulesListEl.innerHTML = modules
    .map(([moduleId, module]) => `
      <article class="module-card">
        <div>
          <h3>${escapeHtml(module.title || moduleId)}</h3>
          <p>${escapeHtml(module.description || "")}</p>
        </div>
        <label class="toggle module-toggle">
          <input data-module-id="${escapeHtml(moduleId)}" type="checkbox" ${module.enabled ? "checked" : ""}>
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
    headers: { "Content-Type": "application/json" },
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
    repo_path: document.getElementById("repoPath").value,
    update_channel: document.getElementById("updateChannel").value,
    ssh_enabled: document.getElementById("sshEnabled").checked,
  };

  try {
    const saved = await getJson("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSettingsForm(saved);
    formStatusEl.textContent = "Settings saved.";
  } catch (error) {
    formStatusEl.textContent = error.message;
  }
}

async function requestPowerAction(action) {
  const verb = action === "reboot" ? "reboot" : "power off";
  if (!window.confirm(`Are you sure you want to ${verb} this device now?`)) {
    return;
  }

  powerActionStatusEl.textContent = `Requesting ${verb}...`;

  try {
    const result = await getJson(`/api/actions/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    powerActionStatusEl.textContent = result.message || `${titleCase(action)} requested.`;
  } catch (error) {
    powerActionStatusEl.textContent = error.message;
  }
}

async function selectMedia(relativePath) {
  mediaStatusEl.textContent = "Selecting media...";
  try {
    const state = await getJson("/api/media/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_path: relativePath }),
    });
    renderMediaState(state);
    mediaStatusEl.textContent = "Media selected for bedside playback.";
  } catch (error) {
    mediaStatusEl.textContent = error.message;
  }
}

async function sendMediaAction(action) {
  mediaStatusEl.textContent = action === "clear" ? "Clearing selected media..." : `Sending ${action}...`;
  try {
    const state = await getJson("/api/media/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    renderMediaState(state);
    mediaStatusEl.textContent = action === "clear" ? "Selected media cleared." : `Media ${action} request saved.`;
  } catch (error) {
    mediaStatusEl.textContent = error.message;
  }
}

document.getElementById("refreshStatus").addEventListener("click", () => {
  refreshOverview().catch((error) => {
    formStatusEl.textContent = error.message;
  });
});

document.getElementById("refreshUpdate").addEventListener("click", () => {
  checkUpdateStatus().catch((error) => {
    updateMessageEl.textContent = error.message;
  });
});

rebootButtonEl.addEventListener("click", () => {
  requestPowerAction("reboot");
});

haltButtonEl.addEventListener("click", () => {
  requestPowerAction("halt");
});

clearMediaSelectionEl.addEventListener("click", () => {
  sendMediaAction("clear");
});

mediaBrowserEl.addEventListener("click", (event) => {
  const pathButton = event.target.closest("[data-media-path]");
  if (pathButton) {
    loadMediaBrowser(pathButton.dataset.mediaPath).catch((error) => {
      mediaStatusEl.textContent = error.message;
    });
    return;
  }

  const selectButton = event.target.closest("[data-select-media]");
  if (selectButton) {
    selectMedia(selectButton.dataset.selectMedia);
  }
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

Promise.all([refreshOverview(), loadModules(), loadMediaBrowser(""), loadMediaState()]).catch((error) => {
  formStatusEl.textContent = error.message;
});
