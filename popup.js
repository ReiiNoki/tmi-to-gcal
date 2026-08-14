const { buildGoogleCalendarUrl, parseTencentMeetingInvitation } = globalThis.MeetingCalendarParser;

const elements = {
  invitationText: document.querySelector("#invitationText"),
  readClipboardButton: document.querySelector("#readClipboardButton"),
  parseButton: document.querySelector("#parseButton"),
  parseStatus: document.querySelector("#parseStatus"),
  eventTitle: document.querySelector("#eventTitle"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  timezone: document.querySelector("#timezone"),
  googleAccount: document.querySelector("#googleAccount"),
  editAccountLabelsButton: document.querySelector("#editAccountLabelsButton"),
  accountLabelsDialog: document.querySelector("#accountLabelsDialog"),
  closeAccountLabelsButton: document.querySelector("#closeAccountLabelsButton"),
  cancelAccountLabelsButton: document.querySelector("#cancelAccountLabelsButton"),
  saveAccountLabelsButton: document.querySelector("#saveAccountLabelsButton"),
  meetingUrl: document.querySelector("#meetingUrl"),
  meetingId: document.querySelector("#meetingId"),
  eventDescription: document.querySelector("#eventDescription"),
  createEventButton: document.querySelector("#createEventButton"),
};

let parseTimer;
const GOOGLE_ACCOUNT_STORAGE_KEY = "googleCalendarAccountIndex";
const GOOGLE_ACCOUNT_LABELS_STORAGE_KEY = "googleCalendarAccountLabels";
const DEFAULT_GOOGLE_ACCOUNT_LABELS = ["账号 1", "账号 2", "账号 3", "账号 4"];

function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  } catch {
    return "Asia/Shanghai";
  }
}

function configureTimezones() {
  const localTimezone = getLocalTimezone();
  const timezones = [
    { value: "Asia/Shanghai", label: "中国标准时间（Asia/Shanghai）" },
    ...(localTimezone !== "Asia/Shanghai"
      ? [{ value: localTimezone, label: `本机时区（${localTimezone}）` }]
      : []),
    { value: "UTC", label: "协调世界时（UTC）" },
  ];

  elements.timezone.replaceChildren(
    ...timezones.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  elements.timezone.value = localTimezone || "Asia/Shanghai";
}

function getGoogleAccountLabels() {
  try {
    const savedLabels = JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_LABELS_STORAGE_KEY));
    if (!Array.isArray(savedLabels)) return [...DEFAULT_GOOGLE_ACCOUNT_LABELS];
    return DEFAULT_GOOGLE_ACCOUNT_LABELS.map((fallback, index) => {
      const label = String(savedLabels[index] || "").trim();
      return label || fallback;
    });
  } catch {
    return [...DEFAULT_GOOGLE_ACCOUNT_LABELS];
  }
}

function updateGoogleAccountOptions() {
  const selectedAccount = elements.googleAccount.value || "1";
  const labels = getGoogleAccountLabels();
  Array.from(elements.googleAccount.options).forEach((option, index) => {
    option.textContent = labels[index];
  });
  elements.googleAccount.value = selectedAccount;
}

function configureGoogleAccount() {
  const savedAccount = localStorage.getItem(GOOGLE_ACCOUNT_STORAGE_KEY);
  // Most two-account setups use /u/1 for the non-primary account.
  elements.googleAccount.value = savedAccount ?? "1";
  if (!elements.googleAccount.value) elements.googleAccount.value = "1";
  updateGoogleAccountOptions();
}

function openAccountLabelsDialog() {
  const labels = getGoogleAccountLabels();
  document.querySelectorAll("[data-account-label]").forEach((input) => {
    const index = Number(input.dataset.accountLabel);
    input.value = labels[index] === DEFAULT_GOOGLE_ACCOUNT_LABELS[index] ? "" : labels[index];
  });
  elements.accountLabelsDialog.showModal();
  document.querySelector('[data-account-label="0"]').focus();
}

function closeAccountLabelsDialog() {
  elements.accountLabelsDialog.close();
}

function saveAccountLabels() {
  const labels = DEFAULT_GOOGLE_ACCOUNT_LABELS.map((fallback, index) => {
    const input = document.querySelector(`[data-account-label="${index}"]`);
    return input.value.trim() || fallback;
  });
  localStorage.setItem(GOOGLE_ACCOUNT_LABELS_STORAGE_KEY, JSON.stringify(labels));
  updateGoogleAccountOptions();
  closeAccountLabelsDialog();
}

async function openGoogleAccountCalendar(index) {
  const url = `https://calendar.google.com/calendar/u/${index}/r`;
  if (globalThis.chrome?.tabs?.create) {
    await globalThis.chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function setStatus(message, tone = "neutral") {
  elements.parseStatus.dataset.tone = tone;
  elements.parseStatus.querySelector("span").textContent = message;
}

function updateCreateButton() {
  elements.createEventButton.disabled = !(
    elements.eventTitle.value.trim() &&
    elements.startTime.value &&
    elements.endTime.value
  );
}

function fillPreview(result) {
  elements.eventTitle.value = result.title;
  elements.startTime.value = result.start;
  elements.endTime.value = result.end;
  elements.meetingUrl.value = result.meetingUrl;
  elements.meetingId.value = result.meetingId;
  elements.eventDescription.value = result.description;

  const timezoneExists = Array.from(elements.timezone.options).some(
    (option) => option.value === result.timezone,
  );
  if (!timezoneExists) {
    const option = document.createElement("option");
    option.value = result.timezone;
    option.textContent = result.timezone;
    elements.timezone.append(option);
  }
  elements.timezone.value = result.timezone;
  updateCreateButton();
}

function parseInvitation() {
  const text = elements.invitationText.value.trim();
  if (!text) {
    fillPreview({
      title: "",
      start: "",
      end: "",
      meetingUrl: "",
      meetingId: "",
      description: "",
      timezone: getLocalTimezone(),
    });
    setStatus("粘贴邀请后将自动解析", "neutral");
    return;
  }

  const result = parseTencentMeetingInvitation(text, { fallbackTimezone: getLocalTimezone() });
  fillPreview(result);

  if (!result.found.length) {
    setStatus("未识别到日程信息，请手动填写下方字段", "error");
  } else if (result.warnings.length) {
    setStatus(`已识别${result.found.join("、")}；${result.warnings.join("；")}`, "warning");
  } else {
    setStatus(`解析成功：已识别${result.found.join("、")}`, "success");
  }
}

async function readClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      setStatus("剪贴板里没有文本，请先在腾讯会议中复制邀请", "warning");
      return;
    }
    elements.invitationText.value = text;
    parseInvitation();
  } catch {
    setStatus("无法读取剪贴板，请在上方文本框中手动粘贴", "error");
    elements.invitationText.focus();
  }
}

function collectEvent() {
  return {
    title: elements.eventTitle.value.trim(),
    start: elements.startTime.value,
    end: elements.endTime.value,
    timezone: elements.timezone.value,
    meetingUrl: elements.meetingUrl.value.trim(),
    meetingId: elements.meetingId.value.trim(),
    description: elements.eventDescription.value.trim(),
    googleAccountIndex: Number(elements.googleAccount.value),
  };
}

async function createCalendarEvent() {
  try {
    const url = buildGoogleCalendarUrl(collectEvent());
    if (globalThis.chrome?.tabs?.create) {
      await globalThis.chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    setStatus(error.message || "无法创建日程，请检查填写内容", "error");
  }
}

elements.readClipboardButton.addEventListener("click", readClipboard);
elements.parseButton.addEventListener("click", parseInvitation);
elements.invitationText.addEventListener("input", () => {
  window.clearTimeout(parseTimer);
  parseTimer = window.setTimeout(parseInvitation, 300);
});
elements.createEventButton.addEventListener("click", createCalendarEvent);
elements.googleAccount.addEventListener("change", () => {
  localStorage.setItem(GOOGLE_ACCOUNT_STORAGE_KEY, elements.googleAccount.value);
});
elements.editAccountLabelsButton.addEventListener("click", openAccountLabelsDialog);
elements.closeAccountLabelsButton.addEventListener("click", closeAccountLabelsDialog);
elements.cancelAccountLabelsButton.addEventListener("click", closeAccountLabelsDialog);
elements.accountLabelsDialog.querySelector("form").addEventListener("submit", (event) => {
  event.preventDefault();
  saveAccountLabels();
});
elements.accountLabelsDialog.addEventListener("click", (event) => {
  if (event.target === elements.accountLabelsDialog) closeAccountLabelsDialog();
});
document.querySelectorAll("[data-open-account]").forEach((button) => {
  button.addEventListener("click", () => openGoogleAccountCalendar(Number(button.dataset.openAccount)));
});

for (const input of [elements.eventTitle, elements.startTime, elements.endTime]) {
  input.addEventListener("input", updateCreateButton);
}

configureTimezones();
configureGoogleAccount();
updateCreateButton();
