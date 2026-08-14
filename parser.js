(function attachMeetingParser(globalScope) {
  const FULL_WIDTH_DIGITS = "０１２３４５６７８９";

  function normalizeText(text) {
    return String(text ?? "")
      .replace(/\r\n?/g, "\n")
      .replace(/[０-９]/g, (digit) => String(FULL_WIDTH_DIGITS.indexOf(digit)))
      .replace(/\u00a0/g, " ")
      .replace(/[：﹕]/g, ":")
      .replace(/[／⁄]/g, "/")
      .replace(/[－–—―]/g, "-")
      .replace(/[～〜]/g, "~")
      .replace(/[ \t]+$/gm, "")
      .trim();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toDateTimeLocal(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
  }

  function isValidDateParts(parts) {
    const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    return (
      date.getFullYear() === parts.year &&
      date.getMonth() === parts.month - 1 &&
      date.getDate() === parts.day &&
      date.getHours() === parts.hour &&
      date.getMinutes() === parts.minute
    );
  }

  function addDays(parts, amount) {
    const date = new Date(parts.year, parts.month - 1, parts.day + amount, parts.hour, parts.minute, 0, 0);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }

  function addMinutes(parts, amount) {
    const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute + amount, 0, 0);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }

  function extractTitle(text) {
    const labeled = text.match(/^(?:会议主题|会议名称|会议标题|主题|Topic)\s*:\s*(.+)$/im);
    if (labeled?.[1]) return labeled[1].trim();

    const ignored = /^(?:腾讯会议|Tencent Meeting|会议时间|时间|日期|点击|入会|会议号|会议\s*ID|Meeting\s*ID|密码|https?:\/\/|复制)/i;
    return (
      text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && line.length <= 100 && !ignored.test(line)) || ""
    );
  }

  function cleanUrl(url) {
    return url.replace(/[，。；;、）)】\]>]+$/g, "");
  }

  function extractMeetingUrl(text) {
    const urls = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    const cleaned = urls.map(cleanUrl);
    return (
      cleaned.find((url) => /(?:meeting\.tencent\.com|voovmeeting\.com)/i.test(url)) ||
      cleaned[0] ||
      ""
    );
  }

  function normalizeMeetingId(raw) {
    const value = raw.trim().replace(/^[#：:\s]+|[，。；;、）)】\]]+$/g, "");
    if (!value) return "";
    if (/^[0-9]+$/.test(value)) return value;
    return value.replace(/[\s_]+/g, "-").replace(/-+/g, "-");
  }

  function extractMeetingId(text) {
    const patterns = [
      /^(?:#\s*)?腾讯会议(?:号|ID)?\s*:\s*#?\s*([0-9][0-9\s_-]{5,}[0-9])/im,
      /^(?:会议\s*(?:ID|Id|id|号)|Meeting\s*ID)\s*:\s*#?\s*([0-9][0-9\s_-]{5,}[0-9])/im,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return normalizeMeetingId(match[1]);
    }
    return "";
  }

  function prepareDateText(text) {
    return text
      .replace(/(\d)年\s*(\d)/g, "$1/$2")
      .replace(/(\d)月\s*(\d)/g, "$1/$2")
      .replace(/(\d)日/g, "$1 ")
      .replace(/[至到]/g, "-")
      .replace(/\s+/g, " ");
  }

  function extractDateRange(text) {
    const prepared = prepareDateText(text);
    const rangePattern = /(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*[-~]\s*(?:(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\s+)?(\d{1,2}):(\d{2})(?::\d{2})?/;
    const range = prepared.match(rangePattern);

    if (range) {
      const start = {
        year: Number(range[1]),
        month: Number(range[2]),
        day: Number(range[3]),
        hour: Number(range[4]),
        minute: Number(range[5]),
      };
      let end = {
        year: Number(range[6] || range[1]),
        month: Number(range[7] || range[2]),
        day: Number(range[8] || range[3]),
        hour: Number(range[9]),
        minute: Number(range[10]),
      };

      if (!range[6] && (end.hour < start.hour || (end.hour === start.hour && end.minute <= start.minute))) {
        end = addDays(end, 1);
      }

      if (isValidDateParts(start) && isValidDateParts(end)) {
        return { start: toDateTimeLocal(start), end: toDateTimeLocal(end), inferredEnd: false };
      }
    }

    const startPattern = /(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/;
    const single = prepared.match(startPattern);
    if (!single) return { start: "", end: "", inferredEnd: false };

    const start = {
      year: Number(single[1]),
      month: Number(single[2]),
      day: Number(single[3]),
      hour: Number(single[4]),
      minute: Number(single[5]),
    };
    if (!isValidDateParts(start)) return { start: "", end: "", inferredEnd: false };

    return {
      start: toDateTimeLocal(start),
      end: toDateTimeLocal(addMinutes(start, 60)),
      inferredEnd: true,
    };
  }

  function detectTimezone(text, fallbackTimezone) {
    if (/GMT\s*\+?0?8(?::?00)?|UTC\s*\+?0?8(?::?00)?|中国标准时间|北京时间|Asia\/Shanghai/i.test(text)) {
      return "Asia/Shanghai";
    }
    return fallbackTimezone || "Asia/Shanghai";
  }

  function buildDescription(originalText, meetingUrl, meetingId) {
    const summary = ["腾讯会议"];
    if (meetingUrl) summary.push(`会议链接：${meetingUrl}`);
    if (meetingId) summary.push(`会议号：${meetingId}`);
    if (originalText) summary.push("", "原始邀请：", originalText.trim());
    return summary.join("\n");
  }

  function parseTencentMeetingInvitation(rawText, options = {}) {
    const text = normalizeText(rawText);
    if (!text) {
      return {
        title: "",
        start: "",
        end: "",
        timezone: options.fallbackTimezone || "Asia/Shanghai",
        meetingUrl: "",
        meetingId: "",
        description: "",
        found: [],
        warnings: [],
      };
    }

    const title = extractTitle(text);
    const meetingUrl = extractMeetingUrl(text);
    const meetingId = extractMeetingId(text);
    const dateRange = extractDateRange(text);
    const timezone = detectTimezone(text, options.fallbackTimezone);
    const found = [];
    const warnings = [];

    if (title) found.push("主题");
    if (dateRange.start) found.push("时间");
    if (meetingUrl) found.push("链接");
    if (meetingId) found.push("会议号");
    if (!title) warnings.push("未识别会议主题");
    if (!dateRange.start) warnings.push("未识别会议时间");
    if (!meetingUrl) warnings.push("未识别会议链接");
    if (dateRange.inferredEnd) warnings.push("未提供结束时间，已按 1 小时填写");

    return {
      title,
      start: dateRange.start,
      end: dateRange.end,
      timezone,
      meetingUrl,
      meetingId,
      description: buildDescription(text, meetingUrl, meetingId),
      found,
      warnings,
    };
  }

  function compactCalendarDate(dateTimeLocal) {
    return dateTimeLocal.replace(/[-:]/g, "") + "00";
  }

  function ensureMeetingDetails(description, meetingUrl, meetingId) {
    const details = String(description || "").trim();
    const additions = [];
    if (meetingUrl && !details.includes(meetingUrl)) additions.push(`会议链接：${meetingUrl}`);

    const idDigits = String(meetingId || "").replace(/\D/g, "");
    const detailsDigits = details.replace(/\D/g, "");
    if (meetingId && (!idDigits || !detailsDigits.includes(idDigits))) additions.push(`会议号：${meetingId}`);

    return [...additions, details].filter(Boolean).join("\n");
  }

  function buildGoogleCalendarUrl(event) {
    if (!event?.title || !event?.start || !event?.end) {
      throw new Error("标题、开始时间和结束时间不能为空");
    }
    if (event.end <= event.start) {
      throw new Error("结束时间必须晚于开始时间");
    }

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${compactCalendarDate(event.start)}/${compactCalendarDate(event.end)}`,
      details: ensureMeetingDetails(event.description, event.meetingUrl, event.meetingId),
      stz: event.timezone || "Asia/Shanghai",
      etz: event.timezone || "Asia/Shanghai",
    });

    const accountIndex = Number(event.googleAccountIndex ?? 0);
    if (!Number.isInteger(accountIndex) || accountIndex < 0 || accountIndex > 9) {
      throw new Error("Google 账号序号无效");
    }

    return `https://calendar.google.com/calendar/u/${accountIndex}/r/eventedit?${params.toString()}`;
  }

  globalScope.MeetingCalendarParser = {
    parseTencentMeetingInvitation,
    buildGoogleCalendarUrl,
    ensureMeetingDetails,
    internals: { normalizeText, extractDateRange, extractMeetingId, extractMeetingUrl },
  };
})(globalThis);
