# 琴园智清

[在线体验](https://iamai-dev.github.io/hubu-waste-platform/) · [源代码](https://github.com/IAMAI-Dev/hubu-waste-platform)

湖北大学垃圾分类全过程管理前端演示原型。四页覆盖项目概览、投放与暂存、后勤清运、反馈处置，所有业务数据均为模拟演示。使用现有 6 个投放点、3 辆车和预设线路，未接入后端、账号、真实定位或 AI 调度。

## 在线发布

GitHub Pages 从 `main` 分支根目录发布；`.nojekyll` 保留原生静态文件，无需构建。向 `main` 推送更新后，等待 Pages 发布流程完成即可。观众反馈保存在访问者自己的浏览器，不会汇总到服务器。

## 启动

页面无需构建。进入本目录，在 PowerShell 中执行：

```powershell
if (!(Test-Path -LiteralPath '.\map-config.js')) {
  Copy-Item -LiteralPath '.\map-config.example.js' -Destination '.\map-config.js'
}
python preview.py 8765
```

打开 <http://127.0.0.1:8765/index.html>。请使用同源 HTTP 服务，避免直接双击 HTML 导致跨页存储行为不一致。

| 页面 | 用途 |
| --- | --- |
| `index.html` | 项目叙事、校园示意、共用模拟摘要与故事入口 |
| `monitor.html` | 分类容器、投放记录、暂存预警、治理建议与午间处置故事 |
| `detail.html` | 车辆、点位、轨迹回放、图表、记录和故事导览 |
| `feedback.html` | 反馈提交、满意度与关联工单进展 |

高德地图是可选底图。在本机 `map-config.js` 中配置网页端 key 和 securityJsCode；本次公开展示版已包含该配置文件。看板默认展示原创立体校园场景，可切换到地理底图。没有密钥或加载失败时，地理底图使用明确标注的本地 SVG 校园示意图，仍可操作车辆、点位和回放。校园示意图不表示测绘边界。

## 代码架构

```text
routes.js               原有校园路线坐标
seed-data.js            原有历史反馈示例，保留原文与时间
core.js                 window.HUBU 公共业务接口
                        模拟时钟、分类批次库存、收运、工单、反馈、快照与存储
ui.js                   SVG 图标、导航、主题、提示、动画时钟
motion.js               滚动进度、入场、数据飞行、减少动效与后台暂停
campus-model.js         六个 POI 对应的建筑、运动场与园林模型
scene.js                分层 SVG 校园、镜头投影、线路、标记和跟随
motion.css              电影式首页、沉浸看板及响应式动效布局
map.js                  共用地图适配器：高德 / 原创本地 SVG
tour.js                 四幕导览及临时演示状态的进入、恢复
home.js                 滚动分幕、独立演示会话、镜头调度与首页摘要
dashboard.js            看板选择、筛选、回放、详情与 ECharts
monitor.js / monitor.css 分类监测、暂存环境、治理规则及独立六幕演示
feedback.js             表单、可选评分、筛选、时间线与清除确认
style.css               设计变量、深浅主题、响应式组件、动效
libs/echarts.min.js     本地 ECharts 5.5.1，保留原版权声明
tests/                  模拟回归与浏览器交互检查
qa/                     验收截图、检查结果及已知验证边界
```

页面通过 `HUBU.getSnapshot()` 读取同一时刻的数据；页面脚本负责呈现，不另算清运量或工单状态。`addFeedback()` 与 `reportOrder()` 共用创建逻辑。路线和点位属于公共数据；地图、列表、详情、图表和故事通过 ID 关联。

连续播放时刻与已处理整数分钟分离，每个分钟事件只处理一次。回拖时从 06:00 确定性重建，未来事件不会进入当前列表。收运事件及系统工单使用稳定 ID。满溢和延迟清运问题关联下一次线路到站，其余点位问题使用 18 / 55 模拟分钟的受理、办结规则。

## 投放与暂存

`getSnapshot().monitoring` 提供六个点位的四类容器、投放批次、重量和体积库存、最早未收运时长及设施配置。投放按确定性时序生成，收运按先入先出扣减 95% 库存；剩余批次继续计算年龄。点位标记显示最高负荷类别，页面总容量指标显示全部容器的总体占用。

容量预警和厨余暂存超时合并到当前未完成收运任务，保洁按独立的 18 / 55 分钟规则处理。治理建议给出触发依据和相关趋势、反馈入口。全局信息按钮说明原型阈值与数据口径。

[全过程管理验收记录与截图](qa/monitor/README.md)。

## 本轮动效

首页使用原生滚动驱动局部固定场景：校园展开、发现满溢、安排路线、跟车抵达、收运完成、回到校园全景。章节可点击跳转，也可直接跳过故事。桌面、平板、手机分别采用 420 / 340 / 260 svh 的叙事长度；减少动态效果与矮屏横屏呈现静态章节。

`HUBU.createDemoSession()` 创建独立引擎实例，只暴露 `seek()`、快照、工单时间线与 `dispose()`；它不读取或写入本机业务存储。首页滚动不会推进看板播放时刻，也不会改变用户反馈。`scene.js` 接收快照来源，首页和看板复用同一套投影与路线渲染。场景由 `HUBU_UI.clock()` 驱动，滚动监听只标记待更新状态。

看板新增路线悬停高亮、镜头聚焦、容量环、车辆跟随、面板收起、到站重量飞行、时间轴扫描和位置残影。只有新发生的正向收运触发动效；拖动时间轴立即取消尚未完成的数据飞行。反馈提交仅在存储成功后展开新记录并播放到达动效，手机直接切换进展页。

[本轮验收截图与录屏](qa/cinematic/README.md) · 原版 Git 基线：`3b9bf91`。

## 演示操作

- 首次进入从 09:45 开始，1× 表示每秒推进 10 模拟分钟；支持 4×、16×，20:00 自动暂停。
- 页面间保持时刻、暂停状态、倍率和选中对象；反馈页保持时刻，回看板可继续播放。
- 手机使用地图、车辆、点位、图表、记录页签，时间轴通过模拟时刻旁的按钮展开。
- 跟随车辆时，手动拖动地图会退出跟随；减少动态效果设置会关闭自动视角移动。
- “桃李园的一次满溢处置”使用独立临时状态，退出后恢复原来的时刻和选择，不保存或清除本机反馈。
- 问题反馈可关联点位工单；建议和表扬不创建工单。满意度允许不填，只有实际评分进入统计。
- 分类准确率为模拟值；碳减排为清运重量乘以 0.30 的演示估算，不代表经过验证的减排收益。

## 本机存储

| Key | 位置 | 内容 |
| --- | --- | --- |
| `qy-theme` | localStorage | 深浅主题 |
| `qy-feedback` | localStorage | 本机提交；兼容旧记录，不按正文推断旧工单 |
| `qy-work-orders-v2` | localStorage | 用户创建的关联工单 |
| `qy-playhead` | sessionStorage | 兼容旧版的播放时刻 |
| `qy-session-v2` | sessionStorage | 时刻、倍率、暂停状态、选择、跟随 |

反馈只保存在当前浏览器和当前来源下，不会发送到学校或服务器。切换端口、浏览器或设备不会共享记录。清除本机提交需二次确认，系统示例继续保留。存储失败会显示错误，不会报告保存成功。

## 开发与验证

业务测试仅需 Node.js：

```powershell
node tests/core.test.cjs
```

浏览器测试依赖开发工具，与页面运行无关：

```powershell
npm install
# 先保持上面的本地 HTTP 服务运行
npm run test:browser
# 动效专项与录屏，需要 Playwright FFmpeg
npx playwright install ffmpeg
npm run test:cinematic
```

测试默认调用 `C:/Program Files/Google/Chrome/Application/chrome.exe`，可通过 `CHROME_PATH` 指定其他 Chromium 可执行文件。结果写入 `qa/`。测试使用独立临时浏览器，不读取日常浏览器数据。

阅读 [验收说明](qa/README.md)，了解截图、已通过检查以及高德、真机等尚未验证的边界。

## Git 协作

本目录是独立 Git 仓库，主分支 `main`。地图本机配置、依赖目录和日志已忽略；页面、业务逻辑、测试和验收材料纳入版本控制。相邻 `group work1` 不属于本仓库。

```powershell
git status
git switch -c ui/your-change
# 修改并验证后，选择本次相关文件暂存
git add <文件路径>
git commit -m "描述这次修改"
git log --oneline
```

当前仅使用本地版本控制。需要多人同步时，再由小组确定远程仓库地址和托管平台。

2026-10-23 校园模型重绘：[设计说明与验收截图](qa/campus-model/README.md)。模型位置沿用现有点位，建筑细节按功能示意设计。


## 预览缓存更新

使用 `python preview.py 8765` 启动本地预览。该服务固定从当前项目目录提供资源，返回 `Cache-Control: no-store`，并禁止 Windows 同端口重复监听。若端口已被占用，先关闭旧预览进程。

三个页面的公共脚本、样式及图标带内容指纹。修改静态资源后运行 `python tools/version_assets.py` 更新引用；页面仍无需构建。该命令不修改本机地图配置。旧标签页可通过带查询参数的页面地址重新进入，例如 `http://127.0.0.1:8765/detail.html?v=campus-model-20261023`。

2026-10-23 缓存修复验证：模拟上一版 scene.js 被浏览器缓存后，普通刷新能加载版本化资源并显示六组新模型；预览响应不受旧条件请求影响。检查源码为 `tests/cache.test.cjs`，结果见 `qa/cache/results.json`。
