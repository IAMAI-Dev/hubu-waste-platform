# 电影式动效改版验收

日期：2026-10-14。以本机 HTTP 服务、独立 Chromium 浏览器验证；不读取日常浏览器账号和数据。上一版 Git 基线为 `3b9bf91`。

## 直接观看

- [桌面完整录屏，1366×768](walkthrough-1366.webm)
- [手机完整录屏，390×844](walkthrough-390.webm)

录屏包含首页连续滚动故事、点位聚焦、车辆跟随、收起面板、时间轴回放与反馈提交。使用实际页面录制，业务数据仍是模拟值。

## 关键画面

| 状态 | 桌面 | 手机 |
| --- | --- | --- |
| 校园展开 | [查看](home-opening-1366.png) | [查看](home-opening-390.png) |
| 发现满溢 | [查看](home-alert-1366.png) | [查看](home-alert-390.png) |
| 安排路线 | [查看](home-assignment-1366.png) | [查看](home-assignment-390.png) |
| 跟车抵达 | [查看](home-arrival-1366.png) | [查看](home-arrival-390.png) |
| 收运完成 | [查看](home-result-1366.png) | [查看](home-result-390.png) |
| 返回全景 | [查看](home-finale-1366.png) | [查看](home-finale-390.png) |
| 点位聚焦 | [查看](dashboard-focus-1366.png) | [查看](dashboard-focus-390.png) |
| 沉浸跟车 | [查看](dashboard-follow-1366.png) | [查看](dashboard-follow-390.png) |
| 反馈保存 | [查看](feedback-saved-1366.png) | [查看](feedback-saved-390.png) |

[减少动态效果：静态四幕](reduced-motion.png)。三页深浅主题截图见[上级验收说明](../README.md)。

## 已验证

- 9 项业务回归：不同帧率和倍率、回拖重播、未来事件过滤、反馈工单闭环、失败存储、旧记录兼容、故事状态恢复；新增独立演示实例在已有用户反馈时不读写业务存储、不改变正常播放状态。
- 30 项页面及交互检查：三页七种视口无横向溢出；深浅主题、手机列表/图表/详情/记录、跟随、时间轴、故事、反馈提交与清除、键盘和减少动态效果。
- 6 项运行检查：自动导览到站、动画帧采样、模拟后台暂停、跨页时刻、20:00 停止重播、地理底图失败后的本地示意图操作。
- 6 项新增动效检查：桌面和手机滚动故事可逆且状态隔离；沉浸选择、跟随和拖动时间轴；减少动态效果的四个静态章节；无未捕获的页面脚本异常。
- 系统图标扫描通过，未引入 emoji、字符星星或字符箭头图标。历史反馈和用户正文不做表情清洗。
- 三秒本机动画采样：181 帧，中位帧间隔 16.7ms，P95 为 16.8ms，超过 50ms 的帧为 0。该采样不等于真机性能保证。

结果：[动效专项](results.json)、[业务回归](../core-results.json)、[页面交互](../browser-results.json)、[运行与异常](../motion-results.json)、[静态检查](../static-results.json)。

## 验证边界

高德在线底图及服务鉴权未验证成功，验收覆盖了切换入口与加载失败的本地回退；默认校园场景无需高德。手机、平板和横屏使用视口模拟，未做 iOS/Android 真机、软键盘及不同 GPU 性能测试。后台暂停使用可见性事件模拟。未做完整屏幕阅读器审计。无首次访问离线缓存；页面资源加载后，模拟操作可以在断网时继续。

## 复现

保持项目根目录的 `python -m http.server 8765 --bind 127.0.0.1` 运行，安装开发依赖后执行：

```powershell
npm test
npm run test:browser
npx playwright install ffmpeg
npm run test:cinematic
```

可通过 `CHROME_PATH`、`HUBU_ROOT`、`PLAYWRIGHT_MODULE` 和 `PLAYWRIGHT_BROWSERS_PATH` 指定本机测试环境。页面本身不依赖 Node.js、Playwright 或 FFmpeg，也不需要构建。
