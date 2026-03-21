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
const createMediaFolderEl = document.getElementById("createMediaFolder");
const clearMediaSelectionEl = document.getElementById("clearMediaSelection");
const alarmModuleSettingsFormEl = document.getElementById("alarmModuleSettingsForm");
const alarmModuleFormStatusEl = document.getElementById("alarmModuleFormStatus");
const alarmScreenPositionEl = document.getElementById("alarmScreenPosition");
const alarmSettingsFormEl = document.getElementById("alarmSettingsForm");
const alarmFormStatusEl = document.getElementById("alarmFormStatus");
const alarmListEl = document.getElementById("alarmList");
const alarmActiveStateEl = document.getElementById("alarmActiveState");
const alarmUseSelectedMediaEl = document.getElementById("alarmUseSelectedMedia");
const alarmScheduleTypeEl = document.getElementById("alarmScheduleType");
const alarmCountdownFieldsEl = document.getElementById("alarmCountdownFields");
const alarmTimeFieldsEl = document.getElementById("alarmTimeFields");
const alarmWeekdayFieldsEl = document.getElementById("alarmWeekdayFields");
const alarmEditorTitleEl = document.getElementById("alarmEditorTitle");
const alarmSubmitButtonEl = document.getElementById("alarmSubmitButton");
const alarmCancelEditEl = document.getElementById("alarmCancelEdit");
const alarmEditIdEl = document.getElementById("alarmEditId");
const alarmFilePathEl = document.getElementById("alarmFilePath");
const alarmFileBrowserEl = document.getElementById("alarmFileBrowser");
const applyStorageButtonEl = document.getElementById("applyStorageButton");
const storageUsbCountEl = document.getElementById("storageUsbCount");
const storageNvmeCountEl = document.getElementById("storageNvmeCount");
const storageEntryCountEl = document.getElementById("storageEntryCount");
const storageLastApplyEl = document.getElementById("storageLastApply");
const storageApplySummaryEl = document.getElementById("storageApplySummary");
const storageEntriesEl = document.getElementById("storageEntries");
const storageUsbDevicesEl = document.getElementById("storageUsbDevices");
const storageNvmeDevicesEl = document.getElementById("storageNvmeDevices");
const nvmeStorageFormEl = document.getElementById("nvmeStorageForm");
const nvmeFormStatusEl = document.getElementById("nvmeFormStatus");
const nvmeEntryIdEl = document.getElementById("nvmeEntryId");
const nvmeSubmitButtonEl = document.getElementById("nvmeSubmitButton");
const nvmeCancelEditEl = document.getElementById("nvmeCancelEdit");
const usbStorageFormEl = document.getElementById("usbStorageForm");
const usbFormStatusEl = document.getElementById("usbFormStatus");
const usbEntryIdEl = document.getElementById("usbEntryId");
const usbSubmitButtonEl = document.getElementById("usbSubmitButton");
const usbCancelEditEl = document.getElementById("usbCancelEdit");
const sambaStorageFormEl = document.getElementById("sambaStorageForm");
const sambaFormStatusEl = document.getElementById("sambaFormStatus");
const sambaEntryIdEl = document.getElementById("sambaEntryId");
const sambaSubmitButtonEl = document.getElementById("sambaSubmitButton");
const sambaCancelEditEl = document.getElementById("sambaCancelEdit");

const basePages = [
  { id: "overview", label: "Overview" },
  { id: "storage", label: "Storage" },
  { id: "media", label: "Media" },
  { id: "modules", label: "Modules" },
];
const WEEKDAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const DEFAULT_ALARM_SCREEN_POSITION = "bottom-center";

let moduleState = { modules: {} };
let mediaState = { selected_file: "", selected_kind: "none", playback_state: "stopped" };
let currentAlarmState = { active_alarm: null, upcoming_alarm: null, alarm_count: 0, enabled_count: 0 };
let currentStorageState = { entries: [], detected_devices: [], detected_counts: { usb: 0, nvme: 0 }, last_apply: { status: "never", message: "", applied_at: "never", details: [] } };
let currentMediaPath = "";
let currentAlarmBrowserPath = "";

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

function setAlarmModuleSettingsForm(settings) {
  alarmScreenPositionEl.value = settings.screen_position || DEFAULT_ALARM_SCREEN_POSITION;
}

function titleCase(value) {
  return String(value || "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function describeDetectedStorageDevice(device) {
  if (!device) {
    return "";
  }

  return [
    device.label || device.model || device.name || "Unnamed",
    device.path || "",
    `FS: ${device.filesystem || "None"}`,
    `Size: ${device.size || "Unknown"}`,
    `Mounted: ${device.mount_point || "Not mounted"}`,
  ].join(" | ");
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

function mediaEntryActions(entry) {
  const renameButton = `<button class="ghost-button" type="button" data-rename-media="${escapeHtml(entry.relative_path)}" data-media-name="${escapeHtml(entry.name)}">Rename</button>`;
  const deleteButton = `<button class="ghost-button" type="button" data-delete-media="${escapeHtml(entry.relative_path)}" data-media-name="${escapeHtml(entry.name)}">Delete</button>`;
  if (entry.type === "directory") {
    return `${renameButton}${deleteButton}<button class="primary-button" type="button" data-media-path="${escapeHtml(entry.relative_path)}">Open</button>`;
  }

  const selectButton = entry.selectable
    ? `<button class="primary-button" type="button" data-select-media="${escapeHtml(entry.relative_path)}">Select</button>`
    : `<span class="media-entry-note">Unsupported</span>`;
  return `${renameButton}${deleteButton}${selectButton}`;
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
              <div class="media-entry-actions">${mediaEntryActions(entry)}</div>
            </article>
          `;
        }

        return `
          <article class="media-entry-card">
            <div>
              <h3>${escapeHtml(entry.name)}</h3>
              <p>${escapeHtml(entry.kind)} | ${entry.size_bytes || 0} bytes</p>
            </div>
            <div class="media-entry-actions">${mediaEntryActions(entry)}</div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function formatLocalDateTime(value) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAlarmSchedule(alarm) {
  if (!alarm) {
    return "No schedule";
  }
  if (alarm.schedule_type === "countdown") {
    return `Once at ${formatLocalDateTime(alarm.trigger_at)}`;
  }
  if (alarm.schedule_type === "daily") {
    return `Every day at ${alarm.time_of_day}`;
  }
  if (alarm.schedule_type === "weekly") {
    const days = (alarm.days_of_week || []).map((day) => WEEKDAY_LABELS[day] || day).join(", ");
    return `${days} at ${alarm.time_of_day}`;
  }
  return alarm.schedule_type || "Unknown";
}

function alarmStatusText(alarm) {
  if (currentAlarmState.active_alarm && currentAlarmState.active_alarm.alarm_id === alarm.alarm_id) {
    return "Ringing now";
  }
  if (!alarm.enabled) {
    return "Disabled";
  }
  if (alarm.schedule_type === "countdown" && alarm.fired_at) {
    return `Completed at ${formatLocalDateTime(alarm.fired_at)}`;
  }
  return "Scheduled";
}

function toggleAlarmFormFields() {
  const scheduleType = alarmScheduleTypeEl.value;
  alarmCountdownFieldsEl.hidden = scheduleType !== "countdown";
  alarmTimeFieldsEl.hidden = scheduleType === "countdown";
  alarmWeekdayFieldsEl.hidden = scheduleType !== "weekly";
}

function resetAlarmForm() {
  alarmSettingsFormEl.reset();
  alarmEditIdEl.value = "";
  alarmEditorTitleEl.textContent = "Add alarm";
  alarmSubmitButtonEl.textContent = "Add alarm";
  alarmCancelEditEl.hidden = true;
  document.getElementById("alarmCountdownValue").value = "10";
  document.getElementById("alarmCountdownUnit").value = "minutes";
  document.getElementById("alarmTimeOfDay").value = "07:00";
  document.getElementById("alarmEnabled").checked = true;
  document.getElementById("alarmDeleteAfterStop").checked = true;
  document.getElementById("alarmDisableAfterStop").checked = false;
  toggleAlarmFormFields();
}

function populateAlarmForm(alarm) {
  alarmEditIdEl.value = alarm.alarm_id;
  alarmEditorTitleEl.textContent = `Edit ${alarm.label || "alarm"}`;
  alarmSubmitButtonEl.textContent = "Save alarm";
  alarmCancelEditEl.hidden = false;
  document.getElementById("alarmLabel").value = alarm.label || "";
  document.getElementById("alarmMediaFile").value = alarm.media_file || "";
  alarmScheduleTypeEl.value = alarm.schedule_type || "countdown";
  document.getElementById("alarmEnabled").checked = Boolean(alarm.enabled);
  document.getElementById("alarmDeleteAfterStop").checked = Boolean(alarm.delete_after_stop);
  document.getElementById("alarmDisableAfterStop").checked = Boolean(alarm.disable_after_stop);
  document.querySelectorAll("input[name='alarmDays']").forEach((input) => {
    input.checked = (alarm.days_of_week || []).includes(input.value);
  });
  if (alarm.schedule_type === "countdown") {
    const target = new Date(alarm.trigger_at);
    const diffMinutes = Number.isNaN(target.getTime()) ? 10 : Math.max(1, Math.round((target.getTime() - Date.now()) / 60000));
    if (diffMinutes >= 60 && diffMinutes % 60 === 0) {
      document.getElementById("alarmCountdownUnit").value = "hours";
      document.getElementById("alarmCountdownValue").value = String(Math.max(1, diffMinutes / 60));
    } else {
      document.getElementById("alarmCountdownUnit").value = "minutes";
      document.getElementById("alarmCountdownValue").value = String(diffMinutes);
    }
  } else {
    document.getElementById("alarmTimeOfDay").value = alarm.time_of_day || "07:00";
  }
  toggleAlarmFormFields();
}

function renderAlarmState(alarmState, alarmModule = moduleState.modules?.alarm) {
  currentAlarmState = alarmState || currentAlarmState;
  const activeAlarm = currentAlarmState.active_alarm;
  const upcomingAlarm = currentAlarmState.upcoming_alarm;

  alarmActiveStateEl.innerHTML = activeAlarm
    ? `
      <article class="alarm-status-card is-active">
        <div>
          <p class="status-copy">Alarm active</p>
          <h3>${escapeHtml(activeAlarm.label || "Alarm")}</h3>
          <p class="support-copy">Playing ${escapeHtml(activeAlarm.media_file || "")}</p>
          <p class="support-copy">Triggered ${escapeHtml(formatLocalDateTime(activeAlarm.triggered_at))}</p>
        </div>
        <button class="primary-button" type="button" data-stop-alarm="true">Stop alarm</button>
      </article>
    `
    : `
      <article class="alarm-status-card">
        <div>
          <p class="status-copy">No alarm active</p>
          <p class="support-copy">${upcomingAlarm ? `Next: ${escapeHtml(upcomingAlarm.label || "Alarm")} at ${escapeHtml(formatLocalDateTime(upcomingAlarm.next_trigger_at))}` : "No enabled alarms are scheduled."}</p>
        </div>
      </article>
    `;

  const alarms = alarmModule?.settings?.alarms || [];
  if (!alarms.length) {
    alarmListEl.innerHTML = '<p class="support-copy">No alarms added yet.</p>';
    return;
  }

  alarmListEl.innerHTML = alarms.map((alarm) => `
    <article class="alarm-card ${currentAlarmState.active_alarm && currentAlarmState.active_alarm.alarm_id === alarm.alarm_id ? "is-active" : ""}">
      <div>
        <h3>${escapeHtml(alarm.label || "Alarm")}</h3>
        <p>${escapeHtml(formatAlarmSchedule(alarm))}</p>
        <p class="support-copy">Audio: ${escapeHtml(alarm.media_file || "")}</p>
        <p class="support-copy">Status: ${escapeHtml(alarmStatusText(alarm))}</p>
      </div>
      <div class="alarm-card-actions">
        <button class="ghost-button" type="button" data-edit-alarm="${escapeHtml(alarm.alarm_id)}">Edit</button>
        <button class="ghost-button" type="button" data-toggle-alarm="${escapeHtml(alarm.alarm_id)}" data-enabled="${alarm.enabled ? "false" : "true"}">${alarm.enabled ? "Disable" : "Enable"}</button>
        <button class="ghost-button" type="button" data-delete-alarm="${escapeHtml(alarm.alarm_id)}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderAlarmModule(module) {
  const settings = module?.settings || { screen_position: DEFAULT_ALARM_SCREEN_POSITION, alarms: [] };
  setAlarmModuleSettingsForm(settings);
  renderAlarmState(currentAlarmState, module);
}



function renderAlarmFileBrowser(listing) {
  currentAlarmBrowserPath = listing.current_path || "";
  alarmFilePathEl.textContent = currentAlarmBrowserPath || "/";

  const parentButton = currentAlarmBrowserPath
    ? `<button class="ghost-button" type="button" data-alarm-path="${escapeHtml(listing.parent_path || "")}">Open parent</button>`
    : "";

  const entries = (listing.entries || []).filter((entry) => entry.type === "directory" || entry.kind === "audio");
  if (!entries.length) {
    alarmFileBrowserEl.innerHTML = `${parentButton}<p class="support-copy">No audio files found in this folder.</p>`;
    return;
  }

  alarmFileBrowserEl.innerHTML = `
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
              <button class="primary-button" type="button" data-alarm-path="${escapeHtml(entry.relative_path)}">Open</button>
            </article>
          `;
        }
        return `
          <article class="media-entry-card">
            <div>
              <h3>${escapeHtml(entry.name)}</h3>
              <p>${entry.size_bytes || 0} bytes</p>
            </div>
            <button class="primary-button" type="button" data-alarm-file="${escapeHtml(entry.relative_path)}">Use</button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}


function getStorageFormConfig(kind) {
  if (kind === "nvme") {
    return {
      kind,
      form: nvmeStorageFormEl,
      entryId: nvmeEntryIdEl,
      status: nvmeFormStatusEl,
      submit: nvmeSubmitButtonEl,
      cancel: nvmeCancelEditEl,
      defaults: {
        label: "",
        source: "",
        mount_point: "/mnt/nvme-main",
        filesystem: "ext4",
        options: "",
        auto_mount: true,
        format_if_needed: false,
        enabled: true,
      },
    };
  }
  if (kind === "usb") {
    return {
      kind,
      form: usbStorageFormEl,
      entryId: usbEntryIdEl,
      status: usbFormStatusEl,
      submit: usbSubmitButtonEl,
      cancel: usbCancelEditEl,
      defaults: {
        label: "",
        source: "",
        mount_point: "/mnt/usb-media",
        filesystem: "auto",
        options: "",
        auto_mount: true,
        format_if_needed: false,
        enabled: true,
      },
    };
  }
  return {
    kind: "nas",
    form: sambaStorageFormEl,
    entryId: sambaEntryIdEl,
    status: sambaFormStatusEl,
    submit: sambaSubmitButtonEl,
    cancel: sambaCancelEditEl,
    defaults: {
      label: "",
      host: "",
      share: "",
      mount_point: "/mnt/nas-media",
      username: "",
      password: "",
      domain: "",
      version: "3.0",
      options: "",
      auto_mount: true,
      enabled: true,
    },
  };
}

function setStorageStatus(kind, message) {
  getStorageFormConfig(kind).status.textContent = message;
}

function resetStorageForm(kind) {
  const config = getStorageFormConfig(kind);
  config.form.reset();
  config.entryId.value = "";
  config.submit.textContent = kind === "nas" ? "Save Samba share" : `Save ${titleCase(kind)} mount`;
  config.cancel.hidden = true;

  if (kind === "nvme") {
    document.getElementById("nvmeMountPoint").value = config.defaults.mount_point;
    document.getElementById("nvmeFilesystem").value = config.defaults.filesystem;
    document.getElementById("nvmeAutoMount").checked = true;
    document.getElementById("nvmeFormatIfNeeded").checked = false;
    document.getElementById("nvmeEnabled").checked = true;
  } else if (kind === "usb") {
    document.getElementById("usbMountPoint").value = config.defaults.mount_point;
    document.getElementById("usbFilesystem").value = config.defaults.filesystem;
    document.getElementById("usbAutoMount").checked = true;
    document.getElementById("usbFormatIfNeeded").checked = false;
    document.getElementById("usbEnabled").checked = true;
  } else {
    document.getElementById("sambaMountPoint").value = config.defaults.mount_point;
    document.getElementById("sambaVersion").value = config.defaults.version;
    document.getElementById("sambaAutoMount").checked = true;
    document.getElementById("sambaEnabled").checked = true;
  }
}

function resetAllStorageForms() {
  resetStorageForm("nvme");
  resetStorageForm("usb");
  resetStorageForm("nas");
}

function readStoragePayload(kind) {
  if (kind === "nvme") {
    return {
      entry_id: nvmeEntryIdEl.value,
      label: document.getElementById("nvmeLabel").value,
      kind,
      source: document.getElementById("nvmeSource").value,
      mount_point: document.getElementById("nvmeMountPoint").value,
      filesystem: document.getElementById("nvmeFilesystem").value,
      options: document.getElementById("nvmeOptions").value,
      auto_mount: document.getElementById("nvmeAutoMount").checked,
      format_if_needed: document.getElementById("nvmeFormatIfNeeded").checked,
      enabled: document.getElementById("nvmeEnabled").checked,
    };
  }
  if (kind === "usb") {
    return {
      entry_id: usbEntryIdEl.value,
      label: document.getElementById("usbLabel").value,
      kind,
      source: document.getElementById("usbSource").value,
      mount_point: document.getElementById("usbMountPoint").value,
      filesystem: document.getElementById("usbFilesystem").value,
      options: document.getElementById("usbOptions").value,
      auto_mount: document.getElementById("usbAutoMount").checked,
      format_if_needed: document.getElementById("usbFormatIfNeeded").checked,
      enabled: document.getElementById("usbEnabled").checked,
    };
  }
  return {
    entry_id: sambaEntryIdEl.value,
    label: document.getElementById("sambaLabel").value,
    kind: "nas",
    host: document.getElementById("sambaHost").value,
    share: document.getElementById("sambaShare").value,
    mount_point: document.getElementById("sambaMountPoint").value,
    username: document.getElementById("sambaUsername").value,
    password: document.getElementById("sambaPassword").value,
    domain: document.getElementById("sambaDomain").value,
    version: document.getElementById("sambaVersion").value,
    options: document.getElementById("sambaOptions").value,
    auto_mount: document.getElementById("sambaAutoMount").checked,
    enabled: document.getElementById("sambaEnabled").checked,
  };
}

function populateStorageForm(entry) {
  const kind = entry.kind === "nas" ? "nas" : entry.kind;
  const config = getStorageFormConfig(kind);
  config.entryId.value = entry.entry_id || "";
  config.submit.textContent = kind === "nas" ? "Save Samba share" : `Save ${titleCase(kind)} mount`;
  config.cancel.hidden = false;

  if (kind === "nvme") {
    document.getElementById("nvmeLabel").value = entry.label || "";
    document.getElementById("nvmeSource").value = entry.source || "";
    document.getElementById("nvmeMountPoint").value = entry.mount_point || "/mnt/nvme-main";
    document.getElementById("nvmeFilesystem").value = entry.filesystem || "ext4";
    document.getElementById("nvmeOptions").value = entry.options || "";
    document.getElementById("nvmeAutoMount").checked = entry.auto_mount !== false;
    document.getElementById("nvmeFormatIfNeeded").checked = Boolean(entry.format_if_needed);
    document.getElementById("nvmeEnabled").checked = Boolean(entry.enabled);
  } else if (kind === "usb") {
    document.getElementById("usbLabel").value = entry.label || "";
    document.getElementById("usbSource").value = entry.source || "";
    document.getElementById("usbMountPoint").value = entry.mount_point || "/mnt/usb-media";
    document.getElementById("usbFilesystem").value = entry.filesystem || "auto";
    document.getElementById("usbOptions").value = entry.options || "";
    document.getElementById("usbAutoMount").checked = entry.auto_mount !== false;
    document.getElementById("usbFormatIfNeeded").checked = Boolean(entry.format_if_needed);
    document.getElementById("usbEnabled").checked = Boolean(entry.enabled);
  } else {
    document.getElementById("sambaLabel").value = entry.label || "";
    document.getElementById("sambaHost").value = entry.host || "";
    document.getElementById("sambaShare").value = entry.share || "";
    document.getElementById("sambaMountPoint").value = entry.mount_point || "/mnt/nas-media";
    document.getElementById("sambaUsername").value = entry.username || "";
    document.getElementById("sambaPassword").value = entry.password || "";
    document.getElementById("sambaDomain").value = entry.domain || "";
    document.getElementById("sambaVersion").value = entry.version || "3.0";
    document.getElementById("sambaOptions").value = entry.options || "";
    document.getElementById("sambaAutoMount").checked = entry.auto_mount !== false;
    document.getElementById("sambaEnabled").checked = Boolean(entry.enabled);
  }
}

function renderDetectedStoragePicker(devices, container, kind, skippedCount = 0) {
  if (!devices.length) {
    const message = skippedCount
      ? `No ${kind.toUpperCase()} devices are available to add right now. Detected devices are already mounted or already planned.`
      : `No ${kind.toUpperCase()} devices detected right now.`;
    container.innerHTML = `<p class="support-copy">${message}</p>`;
    return;
  }

  const selectedDevice = devices[0];
  container.innerHTML = `
    <div class="storage-device-picker">
      <label>
        <span>${escapeHtml(kind.toUpperCase())} device</span>
        <select data-storage-select="${escapeHtml(kind)}">
          ${devices.map((device, index) => `
            <option
              value="${escapeHtml(device.path)}"
              data-storage-filesystem="${escapeHtml(device.filesystem || (kind === "nvme" ? "ext4" : "auto"))}"
              ${index === 0 ? "selected" : ""}
            >
              ${escapeHtml(`${device.label || device.model || device.name || "Unnamed"} (${device.path})`)}
            </option>
          `).join("")}
        </select>
      </label>
      <button class="ghost-button" type="button" data-storage-apply-selection="${escapeHtml(kind)}">Use selected device</button>
      <p class="support-copy" data-storage-details="${escapeHtml(kind)}">${escapeHtml(describeDetectedStorageDevice(selectedDevice))}</p>
    </div>
  `;
}

function applyDetectedStorageSelection(kind, container) {
  const select = container.querySelector(`[data-storage-select="${kind}"]`);
  if (!select) {
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const path = selectedOption?.value || "";
  const filesystem = selectedOption?.dataset.storageFilesystem || (kind === "nvme" ? "ext4" : "auto");
  if (kind === "nvme") {
    document.getElementById("nvmeSource").value = path;
    document.getElementById("nvmeFilesystem").value = filesystem;
    setStorageStatus("nvme", "Selected device copied into the NVMe form.");
    return;
  }

  document.getElementById("usbSource").value = path;
  document.getElementById("usbFilesystem").value = filesystem;
  setStorageStatus("usb", "Selected device copied into the USB form.");
}

function updateDetectedStorageDetails(kind, container, devices) {
  const select = container.querySelector(`[data-storage-select="${kind}"]`);
  const details = container.querySelector(`[data-storage-details="${kind}"]`);
  if (!select || !details) {
    return;
  }

  const selectedDevice = devices.find((device) => device.path === select.value) || devices[0] || null;
  details.textContent = describeDetectedStorageDevice(selectedDevice);
}

function renderStorageEntries(entries) {
  if (!entries.length) {
    storageEntriesEl.innerHTML = '<p class="support-copy">No storage mounts saved yet.</p>';
    return;
  }

  const groups = {
    nvme: entries.filter((entry) => entry.kind === "nvme"),
    usb: entries.filter((entry) => entry.kind === "usb"),
    nas: entries.filter((entry) => entry.kind === "nas"),
  };

  storageEntriesEl.innerHTML = Object.entries(groups).map(([kind, items]) => {
    if (!items.length) {
      return "";
    }
    return `
      <section class="storage-entry-group">
        <h3>${escapeHtml(kind === "nas" ? "Samba shares" : titleCase(kind))}</h3>
        <div class="alarm-list">
          ${items.map((entry) => `
            <article class="alarm-card ${entry.is_mounted ? "is-active" : ""}">
              <div>
                <h3>${escapeHtml(entry.label)}</h3>
                <p>${escapeHtml(entry.mount_point)}</p>
                <p class="support-copy">Source: ${escapeHtml(entry.source)}</p>
                <p class="support-copy">${entry.enabled ? (entry.is_mounted ? "Mounted" : "Enabled") : "Disabled"} | Auto-mount: ${entry.auto_mount === false ? "No" : "Yes"}${entry.kind !== "nas" ? ` | Format if needed: ${entry.format_if_needed ? "Yes" : "No"}` : ""}</p>
              </div>
              <div class="alarm-card-actions">
                <button class="ghost-button" type="button" data-edit-storage="${escapeHtml(entry.entry_id)}">Edit</button>
                <button class="ghost-button" type="button" data-toggle-storage="${escapeHtml(entry.entry_id)}" data-enabled="${entry.enabled ? "false" : "true"}">${entry.enabled ? "Disable" : "Enable"}</button>
                <button class="ghost-button" type="button" data-delete-storage="${escapeHtml(entry.entry_id)}">Delete</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function renderStorageState(storageState) {
  currentStorageState = storageState || currentStorageState;
  const counts = currentStorageState.detected_counts || { usb: 0, nvme: 0 };
  const groups = currentStorageState.detected_groups || { usb: [], nvme: [] };
  const skippedCounts = currentStorageState.skipped_detected_counts || { usb: 0, nvme: 0 };
  const lastApply = currentStorageState.last_apply || { status: "never", message: "", applied_at: "never", details: [] };

  storageUsbCountEl.textContent = String(counts.usb || 0);
  storageNvmeCountEl.textContent = String(counts.nvme || 0);
  storageEntryCountEl.textContent = String((currentStorageState.entries || []).length);
  storageLastApplyEl.textContent = lastApply.applied_at && lastApply.applied_at !== "never" ? formatLocalDateTime(lastApply.applied_at) : "Never";
  storageApplySummaryEl.textContent = lastApply.message || "Storage mounts have not been applied yet.";
  renderDetectedStoragePicker(groups.nvme || [], storageNvmeDevicesEl, "nvme", skippedCounts.nvme || 0);
  renderDetectedStoragePicker(groups.usb || [], storageUsbDevicesEl, "usb", skippedCounts.usb || 0);
  renderStorageEntries(currentStorageState.entries || []);
}

async function saveStorageState(nextState) {
  const saved = await getJson("/api/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nextState),
  });
  renderStorageState(saved);
  return saved;
}

async function applyStorageStateRequest() {
  setStorageStatus("nvme", "Applying storage mounts...");
  setStorageStatus("usb", "Applying storage mounts...");
  setStorageStatus("nas", "Applying storage mounts...");
  const result = await getJson("/api/storage/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  renderStorageState(result.storage_state || currentStorageState);
  const message = result.apply_result?.message || "Storage configuration applied.";
  setStorageStatus("nvme", message);
  setStorageStatus("usb", message);
  setStorageStatus("nas", message);
}

async function saveStorageEntry(kind, event) {
  event.preventDefault();
  const payload = readStoragePayload(kind);
  const nextState = JSON.parse(JSON.stringify(currentStorageState));
  const index = nextState.entries.findIndex((entry) => entry.entry_id === payload.entry_id && payload.entry_id);
  setStorageStatus(kind, index >= 0 ? "Saving mount changes..." : "Saving mount...");
  if (index >= 0) {
    nextState.entries[index] = { ...nextState.entries[index], ...payload };
  } else {
    nextState.entries.push(payload);
  }
  try {
    await saveStorageState({ entries: nextState.entries, last_apply: currentStorageState.last_apply });
    setStorageStatus(kind, index >= 0 ? "Mount updated." : "Mount saved.");
    resetStorageForm(kind);
  } catch (error) {
    setStorageStatus(kind, error.message);
  }
}

function mutateStorageEntries(mutator, statusKind = "usb") {
  const nextState = JSON.parse(JSON.stringify(currentStorageState));
  mutator(nextState.entries);
  return saveStorageState({ entries: nextState.entries, last_apply: currentStorageState.last_apply }).catch((error) => {
    setStorageStatus(statusKind, error.message);
    throw error;
  });
}

function renderSystemState(systemState) {
  hostnameEl.textContent = systemState.hostname || "Unknown";
  ipAddressesEl.textContent = (systemState.ip_addresses || []).join(", ") || "No IPv4 address detected";
  installedReleaseEl.textContent = systemState.release.release || "Unknown";
  updatedAtEl.textContent = systemState.release.updated_at || "Unknown";
  renderUpdateStatus(systemState.update_status || {});
  setSettingsForm(systemState.settings || {});
  currentAlarmState = systemState.alarm_state || currentAlarmState;
  renderModules(systemState.modules || moduleState);
  renderMediaState(systemState.media_state || mediaState);
  renderStorageState(systemState.storage_state || currentStorageState);
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

async function loadAlarmFileBrowser(path = currentAlarmBrowserPath) {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const listing = await getJson(`/api/media/files${query}`);
  renderAlarmFileBrowser(listing);
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
  renderAlarmModule(modulesPayload.modules?.alarm);
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

function applyMediaMutationResult(result) {
  if (result.listing) {
    renderMediaBrowser(result.listing);
  }
  if (result.media_state) {
    renderMediaState(result.media_state);
  }
  mediaStatusEl.textContent = result.message || "Media library updated.";
}

async function createMediaFolder() {
  const folderName = window.prompt("New folder name", "");
  if (!folderName) {
    return;
  }
  mediaStatusEl.textContent = "Creating folder...";
  const result = await getJson("/api/media/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent_path: currentMediaPath, name: folderName }),
  });
  applyMediaMutationResult(result);
}

async function renameMediaEntry(relativePath, currentName) {
  const nextName = window.prompt("Rename entry", currentName || "");
  if (!nextName || nextName === currentName) {
    return;
  }
  mediaStatusEl.textContent = "Renaming entry...";
  const result = await getJson("/api/media/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relative_path: relativePath, new_name: nextName }),
  });
  applyMediaMutationResult(result);
}

async function deleteMediaEntry(relativePath, currentName) {
  if (!window.confirm(`Delete ${currentName || relativePath}?`)) {
    return;
  }
  mediaStatusEl.textContent = "Deleting entry...";
  const result = await getJson("/api/media/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relative_path: relativePath }),
  });
  applyMediaMutationResult(result);
}

function applyAlarmMutation(result) {
  if (result.modules) {
    renderModules(result.modules);
  }
  if (result.alarm_state) {
    currentAlarmState = result.alarm_state;
    renderAlarmModule(result.modules?.modules?.alarm || moduleState.modules?.alarm);
  }
}

function buildAlarmPayload() {
  return {
    alarm_id: alarmEditIdEl.value,
    label: document.getElementById("alarmLabel").value,
    media_file: document.getElementById("alarmMediaFile").value,
    schedule_type: document.getElementById("alarmScheduleType").value,
    countdown_value: Number(document.getElementById("alarmCountdownValue").value),
    countdown_unit: document.getElementById("alarmCountdownUnit").value,
    time_of_day: document.getElementById("alarmTimeOfDay").value,
    days_of_week: Array.from(document.querySelectorAll("input[name='alarmDays']:checked")).map((input) => input.value),
    enabled: document.getElementById("alarmEnabled").checked,
    delete_after_stop: document.getElementById("alarmDeleteAfterStop").checked,
    disable_after_stop: document.getElementById("alarmDisableAfterStop").checked,
  };
}

async function saveAlarm(event) {
  event.preventDefault();
  const isEditing = Boolean(alarmEditIdEl.value);
  alarmFormStatusEl.textContent = isEditing ? "Saving alarm changes..." : "Saving alarm...";

  try {
    const result = await getJson(isEditing ? "/api/alarm/update" : "/api/alarm/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAlarmPayload()),
    });
    applyAlarmMutation(result);
    alarmFormStatusEl.textContent = isEditing ? "Alarm updated." : "Alarm added.";
    resetAlarmForm();
  } catch (error) {
    alarmFormStatusEl.textContent = error.message;
  }
}

async function toggleAlarm(alarmId, enabled) {
  alarmFormStatusEl.textContent = enabled ? "Enabling alarm..." : "Disabling alarm...";
  const result = await getJson("/api/alarm/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alarm_id: alarmId, enabled }),
  });
  applyAlarmMutation(result);
  alarmFormStatusEl.textContent = enabled ? "Alarm enabled." : "Alarm disabled.";
}

async function removeAlarm(alarmId) {
  alarmFormStatusEl.textContent = "Deleting alarm...";
  const result = await getJson("/api/alarm/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alarm_id: alarmId }),
  });
  applyAlarmMutation(result);
  alarmFormStatusEl.textContent = "Alarm deleted.";
  if (alarmEditIdEl.value === alarmId) {
    resetAlarmForm();
  }
}

async function stopAlarm() {
  alarmFormStatusEl.textContent = "Stopping alarm...";
  const result = await getJson("/api/alarm/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  applyAlarmMutation(result);
  await loadMediaState();
  alarmFormStatusEl.textContent = "Alarm stopped.";
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

createMediaFolderEl.addEventListener("click", () => {
  createMediaFolder().catch((error) => {
    mediaStatusEl.textContent = error.message;
  });
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
    return;
  }

  const renameButton = event.target.closest("[data-rename-media]");
  if (renameButton) {
    renameMediaEntry(renameButton.dataset.renameMedia, renameButton.dataset.mediaName).catch((error) => {
      mediaStatusEl.textContent = error.message;
    });
    return;
  }

  const deleteButton = event.target.closest("[data-delete-media]");
  if (deleteButton) {
    deleteMediaEntry(deleteButton.dataset.deleteMedia, deleteButton.dataset.mediaName).catch((error) => {
      mediaStatusEl.textContent = error.message;
    });
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

alarmModuleSettingsFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextModules = JSON.parse(JSON.stringify(moduleState));
  nextModules.modules.alarm.settings = {
    ...nextModules.modules.alarm.settings,
    screen_position: alarmScreenPositionEl.value,
  };
  alarmModuleFormStatusEl.textContent = "Saving alarm layout...";
  moduleState = nextModules;
  saveModules().then(() => {
    alarmModuleFormStatusEl.textContent = "Alarm layout saved.";
  }).catch((error) => {
    alarmModuleFormStatusEl.textContent = error.message;
    loadModules().catch(() => {});
  });
});

alarmSettingsFormEl.addEventListener("submit", (event) => {
  saveAlarm(event);
});

alarmScheduleTypeEl.addEventListener("change", () => {
  const scheduleType = alarmScheduleTypeEl.value;
  document.getElementById("alarmDeleteAfterStop").checked = scheduleType === "countdown";
  toggleAlarmFormFields();
});

alarmCancelEditEl.addEventListener("click", () => {
  resetAlarmForm();
  alarmFormStatusEl.textContent = "Alarm edit cancelled.";
});

alarmUseSelectedMediaEl.addEventListener("click", () => {
  if (mediaState.selected_kind !== "audio" || !mediaState.selected_file) {
    alarmFormStatusEl.textContent = "Select an audio file on the Media page first.";
    return;
  }
  document.getElementById("alarmMediaFile").value = mediaState.selected_file;
  alarmFormStatusEl.textContent = "Alarm audio file copied from current media selection.";
});

alarmFileBrowserEl.addEventListener("click", (event) => {
  const pathButton = event.target.closest("[data-alarm-path]");
  if (pathButton) {
    loadAlarmFileBrowser(pathButton.dataset.alarmPath).catch((error) => {
      alarmFormStatusEl.textContent = error.message;
    });
    return;
  }

  const fileButton = event.target.closest("[data-alarm-file]");
  if (fileButton) {
    document.getElementById("alarmMediaFile").value = fileButton.dataset.alarmFile;
    alarmFormStatusEl.textContent = "Alarm audio file selected.";
  }
});

alarmListEl.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-alarm]");
  if (editButton) {
    const alarms = moduleState.modules?.alarm?.settings?.alarms || [];
    const alarm = alarms.find((item) => item.alarm_id === editButton.dataset.editAlarm);
    if (alarm) {
      populateAlarmForm(alarm);
      window.location.hash = "#module-alarm";
      alarmFormStatusEl.textContent = "Editing alarm.";
    }
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-alarm]");
  if (toggleButton) {
    toggleAlarm(toggleButton.dataset.toggleAlarm, toggleButton.dataset.enabled === "true").catch((error) => {
      alarmFormStatusEl.textContent = error.message;
    });
    return;
  }

  const deleteButton = event.target.closest("[data-delete-alarm]");
  if (deleteButton) {
    removeAlarm(deleteButton.dataset.deleteAlarm).catch((error) => {
      alarmFormStatusEl.textContent = error.message;
    });
  }
});

alarmActiveStateEl.addEventListener("click", (event) => {
  if (event.target.closest("[data-stop-alarm]")) {
    stopAlarm().catch((error) => {
      alarmFormStatusEl.textContent = error.message;
    });
  }
});

nvmeStorageFormEl.addEventListener("submit", (event) => {
  saveStorageEntry("nvme", event);
});

usbStorageFormEl.addEventListener("submit", (event) => {
  saveStorageEntry("usb", event);
});

sambaStorageFormEl.addEventListener("submit", (event) => {
  saveStorageEntry("nas", event);
});

nvmeCancelEditEl.addEventListener("click", () => {
  resetStorageForm("nvme");
  setStorageStatus("nvme", "NVMe edit cancelled.");
});

usbCancelEditEl.addEventListener("click", () => {
  resetStorageForm("usb");
  setStorageStatus("usb", "USB edit cancelled.");
});

sambaCancelEditEl.addEventListener("click", () => {
  resetStorageForm("nas");
  setStorageStatus("nas", "Samba edit cancelled.");
});

applyStorageButtonEl.addEventListener("click", () => {
  applyStorageStateRequest().catch((error) => {
    setStorageStatus("nvme", error.message);
    setStorageStatus("usb", error.message);
    setStorageStatus("nas", error.message);
  });
});

storageNvmeDevicesEl.addEventListener("change", (event) => {
  if (!event.target.closest("[data-storage-select='nvme']")) {
    return;
  }
  updateDetectedStorageDetails("nvme", storageNvmeDevicesEl, currentStorageState.detected_groups?.nvme || []);
});

storageNvmeDevicesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-storage-apply-selection='nvme']");
  if (!button) {
    return;
  }
  applyDetectedStorageSelection("nvme", storageNvmeDevicesEl);
});

storageUsbDevicesEl.addEventListener("change", (event) => {
  if (!event.target.closest("[data-storage-select='usb']")) {
    return;
  }
  updateDetectedStorageDetails("usb", storageUsbDevicesEl, currentStorageState.detected_groups?.usb || []);
});

storageUsbDevicesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-storage-apply-selection='usb']");
  if (!button) {
    return;
  }
  applyDetectedStorageSelection("usb", storageUsbDevicesEl);
});

storageEntriesEl.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-storage]");
  if (editButton) {
    const entry = (currentStorageState.entries || []).find((item) => item.entry_id === editButton.dataset.editStorage);
    if (entry) {
      populateStorageForm(entry);
      window.location.hash = "#storage";
      setStorageStatus(entry.kind === "nas" ? "nas" : entry.kind, "Editing storage mount.");
    }
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-storage]");
  if (toggleButton) {
    const entry = (currentStorageState.entries || []).find((item) => item.entry_id === toggleButton.dataset.toggleStorage);
    const statusKind = entry?.kind === "nas" ? "nas" : (entry?.kind || "usb");
    mutateStorageEntries((entries) => {
      const target = entries.find((item) => item.entry_id === toggleButton.dataset.toggleStorage);
      if (target) {
        target.enabled = toggleButton.dataset.enabled === "true";
      }
    }, statusKind).then(() => {
      setStorageStatus(statusKind, toggleButton.dataset.enabled === "true" ? "Storage mount enabled." : "Storage mount disabled.");
    }).catch((error) => {
      setStorageStatus(statusKind, error.message);
    });
    return;
  }

  const deleteButton = event.target.closest("[data-delete-storage]");
  if (deleteButton) {
    const entry = (currentStorageState.entries || []).find((item) => item.entry_id === deleteButton.dataset.deleteStorage);
    const statusKind = entry?.kind === "nas" ? "nas" : (entry?.kind || "usb");
    mutateStorageEntries((entries) => {
      const index = entries.findIndex((item) => item.entry_id === deleteButton.dataset.deleteStorage);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    }, statusKind).then(() => {
      setStorageStatus(statusKind, "Storage mount deleted.");
      if (nvmeEntryIdEl.value === deleteButton.dataset.deleteStorage) {
        resetStorageForm("nvme");
      }
      if (usbEntryIdEl.value === deleteButton.dataset.deleteStorage) {
        resetStorageForm("usb");
      }
      if (sambaEntryIdEl.value === deleteButton.dataset.deleteStorage) {
        resetStorageForm("nas");
      }
    }).catch((error) => {
      setStorageStatus(statusKind, error.message);
    });
  }
});

window.addEventListener("hashchange", () => {
  ensureVisiblePage();
  renderPageNav();
  renderPages();
});

formEl.addEventListener("submit", (event) => {
  saveSettings(event);
});

resetAlarmForm();
resetAllStorageForms();

Promise.all([refreshOverview(), loadModules(), loadMediaBrowser(""), loadAlarmFileBrowser(""), loadMediaState()]).catch((error) => {
  formStatusEl.textContent = error.message;
});
