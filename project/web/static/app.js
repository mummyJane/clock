const hostnameEl = document.getElementById("hostname");
const ipAddressesEl = document.getElementById("ipAddresses");
const installedReleaseEl = document.getElementById("installedRelease");
const updatedAtEl = document.getElementById("updatedAt");
const updateSummaryEl = document.getElementById("updateSummary");
const updateMessageEl = document.getElementById("updateMessage");
const formStatusEl = document.getElementById("formStatus");
const formEl = document.getElementById("settingsForm");

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

function renderSystemState(systemState) {
  hostnameEl.textContent = systemState.hostname || "Unknown";
  ipAddressesEl.textContent = (systemState.ip_addresses || []).join(", ") || "No IPv4 address detected";
  installedReleaseEl.textContent = systemState.release.release || "Unknown";
  updatedAtEl.textContent = systemState.release.updated_at || "Unknown";
  renderUpdateStatus(systemState.update_status);
  setSettingsForm(systemState.settings);
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

formEl.addEventListener("submit", (event) => {
  saveSettings(event);
});

loadSystemState().catch((error) => {
  formStatusEl.textContent = error.message;
});
