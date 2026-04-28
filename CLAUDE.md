# MediaBridge 项目协作规则

## 0. 项目定位
- 这是一个抖音 / 小红书 / YouTube 视频下载网站。
- 处理问题时，优先区分：前端展示层、接口层、下载任务层、平台兼容层、鉴权/代理层。
- 当本项目发生错误并修复完成后，要把错误原因、修复经验和防止再次犯错的规则整理进本文件，而不是只保留在临时会话里。

## 1. 常见工作类型
- Next.js / TypeScript 前端页面与交互逻辑
- 下载流程、任务状态与用户反馈
- 第三方平台兼容性与异常处理
- 媒体资源、Cookies、代理、下载稳定性问题

## 2. 协作规则
- 修改下载、鉴权、平台兼容逻辑前，先确认问题属于哪个平台、哪一层链路。
- 不要把”平台限制””接口异常””前端展示异常”混成同一类问题处理。
- 涉及多平台分支时，优先按平台分别定位与验证。
- 任何会影响用户可见行为的修复，都应补充最接近责任点的验证方法。
- **新增/移除一个平台时，前端展示层必须同步**：至少包含 `src/app/page.tsx` 的「支持的平台」网格（注意 grid 列数 `md:grid-colsN`）以及 `src/components/DownloaderForm.tsx` 的 placeholder。只改 router/parser 不算完整。

## 3. 经验沉淀规则
- 修复完成后，要把错误原因、修复经验和防止再次犯错的规则写入本文件。
- 如果经验已经超出本项目，变成主工作区通用规则，则写入 `G:\openskills\CLAUDE.md`。
- 经验应写成长期可复用规则，不要原样堆调试日志。

## 4. 已沉淀经验

### 4.1 头条 (toutiao.com) 视频解析链路
- **URL 识别**：分享链接形态多样，至少要支持 `toutiao.com/{video,article,group,i,a,w}/{itemId}` 以及 query 中的 `item_id` / `group_id`；并兼容 `ixigua.com` / `365yg.com`（同源体系）。
- **分享链接带 `m_redirect` 等参数**会跳到中间页，正则匹配不到 itemId 时必须 fetch 一次拿到 `final URL` 或在 HTML 中搜 `item_id` / `group_id`。
- **不要再依赖 PC 站 `_SSR_HYDRATED_DATA` / `videoResource`**：2025 年起 PC 视频页 HTML 已不内联 video 资源，调试时主标记（`_SSR_HYDRATED_DATA` / `videoResource` / `main_url`）全部缺失，光从 HTML 抓不到任何东西。
- **正确链路**：
  1. `GET https://m.toutiao.com/i{itemId}/info/`（移动端 UA + 同源 Referer），拿 `data.play_auth_token_v2`。
  2. base64 解码 token，里面是一份预签名的 query string `GetPlayInfoToken`（注意里面是字面量 `&`，要替换成 `&`）。
  3. 拼到 `https://vod.bytedanceapi.com/?{qs}` 直接请求，从 `Result.Data.PlayInfoList` 里按 Bitrate 选最高的 `MainPlayUrl`（兜底用 `BackupPlayUrl`）。
- **签名是平台预签好的**，自己不能篡改 query 顺序、UA 之类影响签名的参数；只需要按 base64 里给出的原样发即可。
- **MainPlayUrl 直链有时效**（约 1 小时，看 `UrlExpire`），适合即时解析后立即下载，不适合长期缓存。
- **yt-dlp 不能依赖**：对头条 share 链 + `m_redirect` 中间页基本没有 extractor 覆盖，作为 fallback 可以保留但不要把它当主路径。
- **保留旧版 SSR (`RENDER_DATA` / `videoResource`)**：作为 H5 兜底仍有少量老视频生效，但要把它放在 VOD 链路之后，不要前置浪费时间。

