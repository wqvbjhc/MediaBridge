# Video Downloader & Editor

基于 Next.js 的多平台视频下载与浏览器内在线剪辑工具，支持无水印解析，采用 Neo-brutalist 风格界面。

## 功能特性

- **多平台下载**：YouTube、Bilibili、抖音、TikTok、小红书
- **无水印解析**：抖音、小红书通过云端网关或 SSR 获取原片直链
- **在线剪辑**：浏览器内时间轴裁剪，基于 ffmpeg.wasm，无需上传至服务器
- **智能分流**：直链由服务端转发，YouTube 等需合并音视频的由 yt-dlp 处理

## 环境要求

| 项目 | 要求 |
|------|------|
| Node.js | 18+ |
| yt-dlp | 需安装在系统 PATH 中 |
| 浏览器（剪辑功能） | Chrome / Edge，需支持 SharedArrayBuffer |

## 安装 yt-dlp

### Windows

```bash
# 使用 winget
winget install yt-dlp.yt-dlp

# 或使用 pip
pip install yt-dlp
```

### macOS

```bash
brew install yt-dlp
```

### Linux

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

安装后执行 `yt-dlp --version` 确认可用。

## 安装与运行

1. 克隆项目（或进入项目目录）：

   ```bash
   git clone <你的仓库地址> MediaBridge
   cd MediaBridge
   ```

2. 安装依赖（需先安装 [pnpm](https://pnpm.io/)）：

   ```bash
   pnpm install
   ```

3. 启动开发服务器：

   ```bash
   pnpm dev
   ```

4. 浏览器访问 `http://localhost:3000`

### 生产构建

```bash
npm run build
npm run start
```

## 使用说明

### 视频下载

1. 在首页输入框粘贴视频链接（支持 YouTube、Bilibili、抖音、TikTok、小红书等）
2. 点击「解析」
3. 解析成功后显示封面、标题、时长
4. 点击「下载 MP4」保存到本地

### 在线剪辑

1. 点击解析结果下的「立即剪辑」或直接访问 `/editor`
2. 点击「Init Engine」加载 ffmpeg.wasm（首次约 30MB）
3. 选择本地视频文件（建议不超过 500MB）
4. 拖动滑块设置开始 / 结束时间
5. 点击「Export Clip」导出裁剪后的视频

## Cookies 配置（可选）

部分平台（如 B 站、YouTube 需登录内容）可能返回 403，可配置 cookies 绕过：

1. 安装浏览器插件 [Get cookies.txt LOCALLY](https://github.com/rotemdan/ExportCookies)
2. 在目标平台登录后，导出为 `cookies.txt`
3. 将文件放到项目根目录下的 `cookies/cookies.txt`（首次使用需手动创建 `cookies` 目录）
4. 重启应用后，yt-dlp 会自动使用该 cookies

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 样式 | TailwindCSS v4, shadcn/ui |
| 下载引擎 | yt-dlp, 自定义抖音/小红书解析 |
| 剪辑引擎 | ffmpeg.wasm (浏览器端) |

## 项目结构

```
src/
├── app/
│   ├── api/video/      # 解析、下载、代理 API
│   ├── editor/         # 在线剪辑页面
│   └── page.tsx        # 首页
├── components/         # UI 组件（Neo-brutalist 风格）
└── lib/engines/        # 解析引擎（yt-dlp、custom 等）
cookies/                # 可选，存放 cookies.txt
```
