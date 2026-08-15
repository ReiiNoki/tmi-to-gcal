# TMI to GCal - 腾讯会议邀请导入 Google 日历

一个简洁的 Chrome / Edge Manifest V3 扩展。它把腾讯会议桌面端复制出的邀请文本解析为可编辑的 Google Calendar 日程，并打开 Google Calendar 的新建日程页面。

**[从 Chrome Web Store 安装](https://chromewebstore.google.com/detail/abjdheloeafcegboabinhnmbmdgdpjfb)**

本扩展已在 Chrome Web Store 上架。普通用户建议直接从商店安装，仓库中的 ZIP 和开发者模式安装方式主要用于测试与开发。

## 功能

- 从剪贴板读取腾讯会议“完整邀请 / 复制邀请”文本，也支持手动粘贴
- 尽可能识别会议主题、开始与结束时间、腾讯会议链接、会议号
- 解析结果可在弹窗中修改
- 支持多个已登录的 Google 账号，可选择目标账号创建日程，并为常用账号设置容易辨认的本地名称
- 通过 Google Calendar 官方事件编辑 URL 预填标题、时间、时区和说明
- 默认识别北京时间（`Asia/Shanghai`）；无明确时区时使用本机时区
- 所有解析均在浏览器本机完成，不上传、不存储邀请内容
- 仅申请剪贴板读取权限，不申请 Google 账号、浏览历史或网页内容权限

## 安装

### Chrome Web Store（推荐）

1. 打开 [TMI to GCal 的 Chrome Web Store 页面](https://chromewebstore.google.com/detail/abjdheloeafcegboabinhnmbmdgdpjfb)。
2. 点击“添加至 Chrome”，按浏览器提示完成安装。
3. 可在浏览器工具栏的扩展菜单中固定“TMI to GCal”。

### Chrome 开发者模式

1. 解压下载的 ZIP 文件。
2. 在地址栏打开 `chrome://extensions/`。
3. 打开页面右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的 `tencent-meeting-to-google-calendar` 文件夹。
6. 可在浏览器工具栏的扩展菜单中固定“TMI to GCal”。

### Edge 开发者模式

1. 解压下载的 ZIP 文件。
2. 在地址栏打开 `edge://extensions/`。
3. 打开左侧的“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择解压后的 `tencent-meeting-to-google-calendar` 文件夹。
6. 可在浏览器工具栏的扩展菜单中固定该扩展。

## 使用

1. 在腾讯会议桌面端找到会议，选择“复制邀请”或“复制完整邀请”。
2. 点击浏览器工具栏中的扩展图标。
3. 点击“从剪贴板读取”。如果浏览器阻止剪贴板读取，可直接在文本框中粘贴。
4. 检查并按需修改标题、时间、时区、会议链接、会议号和说明。
5. 第一次使用时，点击“Google 账号”右侧的“编辑名称”。可点击每行的“查看”打开对应日历，通过右上角头像或邮箱确认账号，然后给它命名，例如“私人 Gmail”或“工作账号”。
6. 在“Google 账号”中选择目标账号。下拉框会显示“账号 1”“账号 2”，设置名称后则会显示“私人 Gmail”“工作账号”等名称。
7. 点击“创建 Google Calendar 日程”。
8. 在打开的 Google Calendar 页面右上角确认头像对应目标账号，然后检查日程并保存。

## 支持的邀请格式

常见格式包括：

```text
腾讯会议邀请您参加会议
会议主题：产品需求评审会
会议时间：2026/08/13 19:00-20:00 (GMT+08:00) 中国标准时间 - 北京

点击链接入会：
https://meeting.tencent.com/dm/abc123

#腾讯会议：123-456-789
```

解析器也兼容以下常见差异：

- `会议主题：`、`会议名称：`、`主题：`
- `2026/08/13`、`2026-08-13`、`2026年8月13日`
- `19:00-20:00`、`19:00 至 20:00`、跨日的完整起止日期
- `腾讯会议：`、`会议号：`、`会议 ID：`、`Meeting ID:`
- 中文或英文冒号、不同横线、空格分隔的会议号

如果邀请只包含开始时间，扩展会暂时把结束时间设置为一小时后，并在弹窗中提醒你检查。

## 权限与隐私

`manifest.json` 仅声明：

```json
"permissions": ["clipboardRead"]
```

该权限只用于你点击“从剪贴板读取”时读取剪贴板文字。扩展没有后台脚本，不会持续监控剪贴板，不读取 Google Calendar 数据，也不会把任何内容发送到服务器。

打开 Google Calendar 新建页使用 Google 的账号专属日程编辑链接，因此无需 Google API 密钥或 OAuth 权限。账号名称和选择使用扩展页面自身的本地存储保存，不需要 `storage` 权限，也不会读取 Google 账号资料。

## 本地测试

安装 Node.js 后，在项目目录运行：

```powershell
npm test
```

测试覆盖常见中文邀请、全角标点、跨日会议、缺少结束时间、会议号归一化和 Google Calendar URL 参数。

## Chrome Web Store

- [商店安装页面](https://chromewebstore.google.com/detail/abjdheloeafcegboabinhnmbmdgdpjfb)
- [隐私政策](https://github.com/ReiiNoki/tmi-to-gcal/blob/main/PRIVACY.md)

仓库中同时保留了发布和维护所需的商店材料：

- `PRIVACY.md`：仓库中的隐私政策
- `store-listing/listing-zh-CN.md`：商品名称、简短说明和详细说明
- `store-listing/privacy-form-zh-CN.md`：单一用途、权限理由和数据披露填写稿
- `store-listing/release-checklist.md`：从注册开发者账号到公开发布的检查清单
- `store-assets/`：商店截图和宣传图
- `release/`：可直接上传到 Chrome Web Store 的 ZIP

后续版本的商店提交步骤见 `store-listing/release-checklist.md`。

## 项目结构

```text
tencent-meeting-to-google-calendar/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── parser.js
├── icons/
├── store-assets/
├── store-listing/
├── release/
├── tests/
├── PRIVACY.md
├── package.json
└── README.md
```

## 已知限制

- 腾讯会议邀请格式可能随客户端版本变化；无法识别时仍可手动填写预览字段。
- 扩展负责打开并预填 Google Calendar，不会代替用户保存日程。
- 重复日程、参会人和提醒规则需要在 Google Calendar 页面中设置。
- Google 账号顺序由浏览器中的登录顺序决定；退出账号或重新登录后顺序可能变化，请在新建日程页通过右上角头像确认。

## 相关官方文档

- [Chrome 扩展权限列表](https://developer.chrome.com/docs/extensions/reference/permissions-list)
- [Chrome `tabs.create()` API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-create)
- [Google Calendar 预填日程链接格式](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events#web)
