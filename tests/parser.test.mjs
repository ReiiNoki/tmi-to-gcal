import test from "node:test";
import assert from "node:assert/strict";

await import("../parser.js");

const {
  buildGoogleCalendarUrl,
  ensureMeetingDetails,
  parseTencentMeetingInvitation,
} = globalThis.MeetingCalendarParser;

test("parses a standard Tencent Meeting Chinese invitation", () => {
  const invitation = `腾讯会议邀请您参加会议
会议主题：产品需求评审会
会议时间：2026/08/13 19:00-20:00 (GMT+08:00) 中国标准时间 - 北京

点击链接入会：
https://meeting.tencent.com/dm/abc123

#腾讯会议：123-456-789`;

  const result = parseTencentMeetingInvitation(invitation, { fallbackTimezone: "America/New_York" });

  assert.equal(result.title, "产品需求评审会");
  assert.equal(result.start, "2026-08-13T19:00");
  assert.equal(result.end, "2026-08-13T20:00");
  assert.equal(result.timezone, "Asia/Shanghai");
  assert.equal(result.meetingUrl, "https://meeting.tencent.com/dm/abc123");
  assert.equal(result.meetingId, "123-456-789");
  assert.deepEqual(result.warnings, []);
});

test("supports Chinese date words, full-width punctuation and spaced meeting IDs", () => {
  const invitation = `会议名称：设计同步会
会议时间：2026年8月14日 09：30 至 10：15
点击链接直接加入会议：https://meeting.tencent.com/dm/design-sync，
会议 ID：987 654 321`;

  const result = parseTencentMeetingInvitation(invitation);

  assert.equal(result.title, "设计同步会");
  assert.equal(result.start, "2026-08-14T09:30");
  assert.equal(result.end, "2026-08-14T10:15");
  assert.equal(result.meetingUrl, "https://meeting.tencent.com/dm/design-sync");
  assert.equal(result.meetingId, "987-654-321");
});

test("supports a full start and end date range", () => {
  const result = parseTencentMeetingInvitation(
    "会议主题: 跨日工作坊\n会议时间: 2026-08-13 23:30 - 2026-08-14 00:30",
  );

  assert.equal(result.start, "2026-08-13T23:30");
  assert.equal(result.end, "2026-08-14T00:30");
});

test("moves an end time after midnight to the next day", () => {
  const result = parseTencentMeetingInvitation(
    "会议主题：夜间发布\n会议时间：2026/08/13 23:30-00:30",
  );

  assert.equal(result.start, "2026-08-13T23:30");
  assert.equal(result.end, "2026-08-14T00:30");
});

test("infers a one-hour end when only the start is present", () => {
  const result = parseTencentMeetingInvitation("会议主题：快速讨论\n会议时间：2026/08/13 19:00");

  assert.equal(result.end, "2026-08-13T20:00");
  assert.ok(result.warnings.includes("未提供结束时间，已按 1 小时填写"));
});

test("does not invent values when the invitation has no recognizable data", () => {
  const result = parseTencentMeetingInvitation("请大家准时参加");

  assert.equal(result.title, "请大家准时参加");
  assert.equal(result.start, "");
  assert.equal(result.end, "");
  assert.equal(result.meetingUrl, "");
});

test("builds an encoded Google Calendar event edit URL", () => {
  const url = buildGoogleCalendarUrl({
    title: "产品需求评审会",
    start: "2026-08-13T19:00",
    end: "2026-08-13T20:00",
    timezone: "Asia/Shanghai",
    meetingUrl: "https://meeting.tencent.com/dm/abc123",
    meetingId: "123-456-789",
    description: "原始邀请",
    googleAccountIndex: 1,
  });
  const parsedUrl = new URL(url);

  assert.equal(parsedUrl.origin, "https://calendar.google.com");
  assert.equal(parsedUrl.pathname, "/calendar/u/1/r/eventedit");
  assert.equal(parsedUrl.searchParams.get("action"), "TEMPLATE");
  assert.equal(parsedUrl.searchParams.get("text"), "产品需求评审会");
  assert.equal(parsedUrl.searchParams.get("dates"), "20260813T190000/20260813T200000");
  assert.equal(parsedUrl.searchParams.get("stz"), "Asia/Shanghai");
  assert.equal(parsedUrl.searchParams.get("etz"), "Asia/Shanghai");
  assert.match(parsedUrl.searchParams.get("details"), /会议链接：https:\/\/meeting\.tencent\.com/);
  assert.match(parsedUrl.searchParams.get("details"), /会议号：123-456-789/);
});

test("does not duplicate meeting details already present in the description", () => {
  const details = ensureMeetingDetails(
    "会议链接：https://meeting.tencent.com/dm/abc123\n会议号：123 456 789",
    "https://meeting.tencent.com/dm/abc123",
    "123-456-789",
  );

  assert.equal(details.match(/会议链接/g)?.length, 1);
  assert.equal(details.match(/会议号/g)?.length, 1);
});

test("rejects missing required event fields and reversed ranges", () => {
  assert.throws(() => buildGoogleCalendarUrl({}), /不能为空/);
  assert.throws(
    () =>
      buildGoogleCalendarUrl({
        title: "错误时间",
        start: "2026-08-13T20:00",
        end: "2026-08-13T19:00",
      }),
    /结束时间必须晚于开始时间/,
  );
});

test("targets the selected signed-in Google account", () => {
  const baseEvent = {
    title: "账号测试",
    start: "2026-08-13T19:00",
    end: "2026-08-13T20:00",
  };

  assert.equal(new URL(buildGoogleCalendarUrl(baseEvent)).pathname, "/calendar/u/0/r/eventedit");
  assert.equal(
    new URL(buildGoogleCalendarUrl({ ...baseEvent, googleAccountIndex: 2 })).pathname,
    "/calendar/u/2/r/eventedit",
  );
  assert.throws(
    () => buildGoogleCalendarUrl({ ...baseEvent, googleAccountIndex: -1 }),
    /账号序号无效/,
  );
});
