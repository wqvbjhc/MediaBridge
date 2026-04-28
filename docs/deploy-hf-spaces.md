# 部署到 Hugging Face Spaces

完全免费、不绑卡。前提：有一个 [huggingface.co](https://huggingface.co/) 账号。

## 一次性准备

1. 浏览器打开 https://huggingface.co/new-space
2. 填写：
   - **Owner**：你的 HF 用户名
   - **Space name**：`mediabridge`（或任意名字）
   - **License**：mit
   - **Space SDK**：**Docker** → **Blank**
   - **Space hardware**：CPU basic（free）
   - **Visibility**：Public
3. 点 Create Space
4. 拿到 Space 仓库地址，类似：`https://huggingface.co/spaces/<你的用户名>/mediabridge`

## 推送代码

仓库根目录里执行（PowerShell 或 Git Bash 都行）：

```bash
# 1) 加 HF 远端
git remote add hf https://huggingface.co/spaces/<你的用户名>/mediabridge

# 2) 首次需要登录（HF 会提示输入 username + access token）
#    去 https://huggingface.co/settings/tokens 生成一个 "write" 权限的 token
git push hf main
```

> token 当成密码粘贴。Git 凭据管理器会缓存，下次免输。

## cookies.txt（可选）

HF Spaces 不支持环境变量持久化 secret 时落盘到 home 目录之外的位置，但 `start.sh` 已经处理好了，只需要在 Space 设置里加 secret：

1. 进入你的 Space → **Settings** → **Variables and secrets** → **New secret**
2. Name：`COOKIES_TXT_B64`
3. Value：把本地 `cookies/cookies.txt` 的 base64 粘进去

PowerShell 生成 base64：
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("v:\MediaBridge\cookies\cookies.txt"))
```

## 部署后验证

1. Space 页面会自动 build（5–10 分钟，进度在 "Logs"）
2. build 完后访问 `https://<你的用户名>-mediabridge.hf.space`
3. 测试解析：抖音 / 头条 / 小红书（fetch 链路秒成功）
4. 测试下载：YouTube 短视频（yt-dlp 链路）
5. 长视频：≥ 5 分钟，HF Spaces 无单请求超时上限

## 已知约束

- **闲置 48h** Space 自动休眠，下次访问冷启 ~30s
- HF 面向 ML demo，做视频下载站属灰色用途，**不要做大流量、不要做商用**
- 公开 Space 任何人能看，私有需要 HF Pro
