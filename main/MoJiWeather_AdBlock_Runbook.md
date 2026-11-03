# 墨迹天气（iOS）Loon 去广告与启动提速：故障档案 / 复现手册

> **初版存档：2026-11-01** · **更新：2026-11-03** · **快速启动基线 V7（仍存在漏网广告）** · **新实验 V9（尚未实机验证）**；V8 视频开屏广告间歇复发  
> **用途**：墨迹天气 APP 更新后若重新出现开屏广告、首页广告或 4～5 秒启动等待，优先按照本手册复现、抓包、差分定位，再修改插件。  
> **适用范围**：iOS 墨迹天气 + Loon，使用 Loon **3.5.1（978）及以上**所支持的新版 `[Rewrite]` 语法；旧版本需先核实兼容性。  
> **证据边界**：网络请求间隔 ≠ 屏幕真实停留时长；SDK 的“成功/展示”上报 ≠ 用户一定实际看到了广告。

## 0. 一分钟速查（以后遇到故障先看这里）

**新实验 V9**：[`main/MoJiWeather_AdBlock_V9.lpx`](https://github.com/hahapkpk/js/blob/main/main/MoJiWeather_AdBlock_V9.lpx) · 原始链接：`https://raw.githubusercontent.com/hahapkpk/js/main/main/MoJiWeather_AdBlock_V9.lpx`。V9 **待实机验证**，若异常回退 V8/V7。

**V8（2026-11-03 已实测，仍会间歇性出现开屏广告）**：[`main/MoJiWeather_AdBlock_V8.lpx`](https://github.com/hahapkpk/js/blob/main/main/MoJiWeather_AdBlock_V8.lpx)；**验证失败立即切回 V7**。  
**稳定基线 V7**：[`main/MoJiWeather_Adlaunch204_Test.lpx`](https://github.com/hahapkpk/js/blob/main/main/MoJiWeather_Adlaunch204_Test.lpx)  
**Loon 订阅 URL**：

```text
https://raw.githubusercontent.com/hahapkpk/js/main/main/MoJiWeather_Adlaunch204_Test.lpx
```

**V7 固定版本（避免主分支将来变更）**：[`da0d253e` 提交中的插件](https://github.com/hahapkpk/js/blob/da0d253e57087d19da0abefe04a894407fe25e8d/main/MoJiWeather_Adlaunch204_Test.lpx)  
**V6 回退版本**：[`main/MoJiWeather_Fast_NoAds_204_Test.lpx`](https://github.com/hahapkpk/js/blob/main/main/MoJiWeather_Fast_NoAds_204_Test.lpx)（[固定提交 `52ec44ac`](https://github.com/hahapkpk/js/blob/52ec44acf4923f80f92441c6f969bbc853438bcf/main/MoJiWeather_Fast_NoAds_204_Test.lpx)）  
**原始上游插件**：[`ifflagged/Romeo` 中的 `MoJiWeatherAds.lpx`](https://github.com/ifflagged/Romeo/blob/main/Modules/Loon/ddgksf2013/Beta/MoJiWeatherAds.lpx)。不要直接以新版上游覆盖当前有效版。

**曾验证的关键策略**：

1. **不要恢复** `DOMAIN-SUFFIX,adlaunch.moji.com,REJECT`：多轮对照中，该规则存在时常伴随约 5 秒级启动等待；改为精确域名 `DIRECT` 后，实机启动明显变快。属于**强相关**，并非已经单独证明的因果关系。
2. 保留 `dsp-x.jd.com/adx/sdk` 与 `opehs.tanx.com/japi` 的 **HTTP 204 快速空响应**，以及已确认的京东素材路径 `img1.360buyimg.com/pop/jfs/` 的 **1×1 GIF 替换**。
3. **放行** `/flycard/flyCard`（原始 36 B 二进制）、`/flycard/flyCardMd`（带 `md5` 的 JSON）；不要用通用空 JSON 覆盖二进制协议。
4. **放行** `/operational/novice`、`/operational/adnovice` 原始响应；之前的空 JSON Mock 未带来启动收益。
5. **不要把“当前未看见广告”等同于“长期 100% 去广告”**。本机缓存、广告轮换与投放 SDK 更新都可能改变结果。

## 1. 事件起因与最终状态

- **最初问题**：上游墨迹插件去广告效果不错，但黑色 `MOJI` 启动画面停留好几秒。
- **首次发现**：天气首页请求早于开屏结束相关请求；早期 `/operational/novice` → `/operational/adnovice` 常约 4.6～5.1 秒。仅凭时序不能证明后者造成延迟。
- **关键 A/B 结果**：把原来拒绝的 `adlaunch.moji.com` 改为 `DIRECT` 后，用户观察到启动明显变快，但出现京东双 11 开屏广告。
- **后续修复**：保持该域名 `DIRECT`，把日志中真正返回广告的京东/Tanx 数据接口改为快速 `204 No Content`，并替换已确认素材路径下的图片。
- **2026-11-01 V7 用户实测**：开屏速度正常，APP 内广告暂未发现；V7 的四轮抓包显示主要广告请求被改写，天气业务请求仍有响应。此为当日观察结果，非未来版本保证。

### V1—V7 对照时间线

| 版本 | GitHub 文件（位于 `hahapkpk/js/main/`） | 做过的关键改变 | 观察与判定 |
|---|---|---|---|
| 原始 | 上游 `MoJiWeatherAds.lpx` | `adlaunch.moji.com` 直接 REJECT；`flyCard` 以空格拒绝 | 去广告尚可；开屏等待数秒 |
| V1 | [`MoJiWeather_FastStart.lpx`](../main/MoJiWeather_FastStart.lpx) | 启动运营接口 Mock 为 JSON | 启动仍慢；并非有效根因修复 |
| V2 | [`MoJiWeather_StartupSDK_Test.lpx`](../main/MoJiWeather_StartupSDK_Test.lpx) | 增加第三方 SDK 域名拒绝 | 仍约 5 秒，不能单靠 SDK 域名封堵解决 |
| V3 | [`MoJiWeather_Protobuf_Test.lpx`](../main/MoJiWeather_Protobuf_Test.lpx) | 恢复 `flyCard/flyCardMd` 原响应 | 响应格式更安全，但仍慢 |
| V4 | [`MoJiWeather_Operational_PassThrough_Test.lpx`](../main/MoJiWeather_Operational_PassThrough_Test.lpx) | 恢复 `novice/adnovice` 原响应 | 仍慢；排除该 Mock 为主要根因 |
| V5 | [`MoJiWeather_Adlaunch_DIRECT_Test.lpx`](../main/MoJiWeather_Adlaunch_DIRECT_Test.lpx) | 仅把 `adlaunch.moji.com` 改为 DIRECT | **速度明显改善**，但京东开屏广告出现 |
| V6 | [`MoJiWeather_Fast_NoAds_204_Test.lpx`](../main/MoJiWeather_Fast_NoAds_204_Test.lpx) | 精准对京东/Tanx 数据接口返回 204、替换京东素材 | 用户一度确认开屏广告消失，但首页广告/偶发开屏广告仍出现 |
| **V7** | **[`MoJiWeather_Adlaunch204_Test.lpx`](../main/MoJiWeather_Adlaunch204_Test.lpx)** | V6 基础上，为 `adlaunch.moji.com` 增加 HTTPS MITM + 204 复写 | **当前推荐**：启动快、当时未见广告；新增复写在 191 日志中**没有观察到实际命中** |

> 重要：V7 比 V6 新增的 `adlaunch` 请求级 204 **不能认定已解决某个确定故障**；当前可确定效果良好的，是整套 V7 配置。今后改动时优先保留已验证的 V6 精准规则。

## 2. 抓包证据清单与数值基线

原始压缩日志只建议存**私有空间**，本公开档案不包含请求 Token、位置、账号、完整 URL 查询参数或响应正文。

| 日志文件 | 场景 | 核心结论 |
|---|---|---|
| `185_1793494911102.zip` | 最初上游插件 | 早期约 4.6 秒级启动接口间隔；需寻找广告 SDK 与缓存链路 |
| `186_1793495791160.zip` | 诊断版与关闭所有墨迹插件的 A/B | 启用诊断版约 5.1 秒；关闭插件后的三轮间隔波动较大，单靠间隔无法定因 |
| `187_1793496732745.zip` | V3，放行飞卡 | 仍约 4.6 秒，说明修正二进制格式本身没解决启动停顿 |
| `188_1793496999632.zip` | V4，放行运营接口 | 3 轮 `novice→adnovice` 约 5.100/5.103/5.111 秒 |
| `189_1793497330975.zip` | V5，开屏域名 DIRECT | 用户明确反馈启动变快，但出现京东开屏广告；发现京东/Tanx 投放与素材链路 |
| `190_1793497668626.zip` | V6，京东/Tanx 204 | 用户反馈启动快且开屏广告一度消失；首页仍出现美的电压力锅广告，后续又有开屏广告 |
| **`191_1793499529999.zip`** | **V7 四轮冷启动** | **当前性能与功能检查基线** |

### V7（191 号）的可复核数字

| 指标 | 记录值 | 正确解读 |
|---|---:|---|
| 请求记录 | 613 条 / 28.13 秒 | 属于多轮启动期间记录的 HTTP 流量 |
| 明显启动轮次 | 4 次 | 以每次 `/flycard/flyCardMd` 为识别锚点 |
| `novice → adnovice` | **0.623 / 0.673 / 0.665 / 0.685 秒** | 平均 **0.662 秒**；**不是屏幕动画的直接计时** |
| `dsp-x.jd.com/adx/sdk` | **30 / 30** 被改写 204 | 京东数据请求拦截生效 |
| `opehs.tanx.com/japi` | **26 / 26** 被改写 204 | Tanx 竞价请求拦截生效 |
| `/json/entrance/list` | 12 次响应改写 | 首页入口过滤仍在执行 |
| `/shortvideo/...` | 18 次被改写 | 仅说明原有视频入口屏蔽命中 |
| `/data/home` | 8 条记录，均有响应体 | 天气首页数据仍可获取；不代表所有城市/功能都经完整测试 |
| `/operational/adnovice` | 4 次，服务器响应含 `adShow: 0` | **不能以此判定所有第三方广告关闭** |
| `adlaunch.moji.com` 新增 V7 Rewrite | **未观察到命中** | 不能把本次无广告归因于该条规则 |
| `/ad/data/print` | 184 条；广告位 **4021:160、306:24** | 这是 SDK 事件/结果日志，不能直接等同用户看到广告 |
| `xlog.jd.com/v1/an` | 88 条 | 主要用于诊断 SDK 活跃状态，**不建议无差别拦截** |
| `stat.moji.com/aMoUp` | 28 条 | 属于统计相关上报，非已证实的投放入口 |

**留意**：`/ad/data/print` 的结果统计曾有 `result=0/1` 和网络连接错误；一些开屏素材可标记为 `is_local: true`，故“广告网络拦住了但仍显示旧广告”时首先排查缓存。不要把缓存推断当作唯一原因。

## 3. 关键接口字典（升级后的定位优先级）

| 域名 / URL 路径（省略查询参数） | 作用线索 | 当前 V7 行为 | 更新后的排查要点 |
|---|---|---|---|
| `adlaunch.moji.com` | 墨迹开屏广告链路候选 | `DOMAIN ... DIRECT`；另有 HTTPS 请求级 204 | **绝对不要先恢复整域 REJECT**；检查请求是否实际经过 MITM、Rewrite 是否命中、是否导致倒计时等待 |
| `dsp-x.jd.com/adx/sdk` | 京东广告数据 | `request ... reject(204)` | 出现京东开屏广告时优先看路径是否变化、204 是否仍命中 |
| `opehs.tanx.com/japi` | Tanx 广告竞价 | `request ... reject(204)` | 检查新 `/japi` 参数/路径、其他 Tanx 域名或备用源 |
| `img1.360buyimg.com/pop/jfs/` | 已见京东开屏图片素材 | `request ... reject_img(200)` | 如果素材换 CDN，先在广告展示时抓包定位确切图片 URL，**不要整域拦截京东图片站** |
| `ztoken.uyunad.com` | 早期抓包可疑 SDK | `DOMAIN ... REJECT` | 若 SDK 频繁失败重试、启动反而慢，做单变量 A/B |
| `sdk-config.tanx.com`、`et.tanx.com`、`janapi.jd.com` | 第三方广告 SDK 配置与请求 | 精确主机 `REJECT` | 仅作为已存证的规则，勿扩大到整个 `jd.com` / `tanx.com` |
| `fcard.api.moji.com/flycard/flyCard` | 飞卡二进制数据（曾为 36 B） | **放行** | 不可把二进制强替换为 `{}` 或空格 |
| `fcard.api.moji.com/flycard/flyCardMd` | 飞卡元信息，含 `md5` | **放行** | 注意 JSON 与其他飞卡接口的数据类型区别 |
| `mcmn.api.moji.com/operational/novice` | 启动运营配置 | **放行** | 与 `adnovice` 的请求时间差可作启动阶段指标，非绝对因果 |
| `mcmn.api.moji.com/operational/adnovice` | 广告/运营配置信息 | **放行** | 即使返回 `adShow:0`，第三方 SDK 广告仍可能显示 |
| `mme.api.moji.com/json/entrance/list` | 首页入口配置 | `response.json.jq(...)` | 首页广告或普通功能入口错乱时优先检查响应结构是否变化，避免 jq 类型错误 |
| `mcscnf.api.moji.com/json/mcity/getMcityBanner`、`/json/windex/getTopConfig` | 其他首页配置 | **放行** | 新出现首页横幅时检查是否从空配置变为广告内容 |
| `weather.api.moji.com/data/home` | 天气首页核心数据 | **放行** | 始终作为功能健康检查；此接口异常时优先撤销新增过滤 |
| `v1.log.moji.com/ad/data/print` | 广告 SDK 诊断事件 | **放行** | 看 `position`、`msgtype`、`result` 与 `errormsg`；仅为事件线索 |
| `xlog.jd.com/v1/an` | 京东 SDK 日志 | **放行** | 不要仅因请求数较多就屏蔽，防止 SDK 重试或状态异常 |

## 4. APP 更新后，10 分钟快速排查 SOP

### A. 先确认故障类型，不要马上改规则

1. 记录 **墨迹天气版本/构建号、iOS 版本、Loon 版本、日期、网络类型（Wi-Fi/蜂窝）**。
2. 先备份 **当前 V7 文件、Loon 模块启用情况、已有去广告插件与规则优先级**。
3. 只启用 **一个**墨迹专用去广告插件；暂时避免上游同类插件、DNS 广告拦截列表和本地 Rewrite 重复命中。
4. 分别做 **3 次冷启动**；用实际秒表或屏幕录像记录“点击 APP 图标 → 首页真正可操作”的秒数，同时记录是否出现**开屏广告、空白倒计时、首页广告**。
5. 对照 **3 次关闭墨迹专用插件**的冷启动；必要时保持 Loon 主程序运行不变，以免把不同代理/DNS 环境当成插件影响。对照组可能出现广告，属正常现象。
6. 在 Loon 导出请求与响应抓包 ZIP；单独保留用户看到广告时的截图/录屏时间点。**原始 ZIP 不要公开上传 GitHub**。

### B. 按症状走最短定位分支

| 现象 | 优先检查 | 建议的第一步 |
|---|---|---|
| 开屏再次等 4～5 秒 | `adlaunch.moji.com` 是否被别的规则 REJECT、HTTPS Rewrite/证书、广告 SDK 错误重试 | 比对插件开/关与 V5 的启动耗时；先撤销最近新增的整域 REJECT |
| 开屏速度正常，但出现京东/Tanx 广告 | `dsp-x.jd.com/adx/sdk`、`opehs.tanx.com/japi` 是否继续命中 204 | 找真实发广告的主机/路径，精确新增请求级响应，不整域一刀切 |
| 开屏广告变为白屏/空白倒计时 | SDK 已进入广告展示流程但素材响应为空 | 检查图片替换与广告请求的时序；缩小仅屏蔽素材的规则 |
| 开屏无广告，但首页有广告 | `getMcityBanner`、`getTopConfig`、`entrance/list`、广告位 `4021/306`、图片素材来源 | 在首页广告出现的时间段抓一次日志，对比页面加载前后的新域名/请求 |
| 仍有广告，但新日志找不到素材下载 | 本地缓存、APP 预加载、HTTP/3/未解密 HTTPS | 清理 APP 缓存、检查 MITM 命中；必要时备份设置后重新安装验证，不先扩大封锁 |
| 天气无法刷新、首页空白 | `weather.api.moji.com/data/home`、飞卡二进制、jq 结构变化 | **先关闭新加规则**并验证核心数据正常，再逐条恢复 |
| Loon 不见请求改写记录 | 模块没启用、规则冲突、版本/语法、MITM 证书、域名未覆盖 | 在请求详情确认实际走过的 Rule、Rewrite、MITM；不要凭文件存在就认为生效 |

### C. 只修改一个变量，逐轮回归

- **新规则必须有证据**：抓包里的真实域名 + 路径 + 方法 + 响应类型或素材来源，不根据域名名字猜测业务作用。
- 广告数据 API 能容忍时可测试 **204 无内容**； JSON API 需要结构时优先基于真实协议返回 `reject_dict(200)`、`reject_array(200)` 或仅清理广告字段；图片使用 `reject_img(200)`。
- **注意**：204 不保证所有 SDK 都能兼容，可能产生重试；必须看冷启动和功能测试。
- 不要以 `reject(200, " ")` 代替所有 JSON / 二进制响应；有解析失败风险。
- 不要大范围拦截 `.moji.com`、`jd.com`、`tanx.com`、天气/定位/账户/推送相关域名。
- 每次改动记录 **改了哪一行、修改前后 3 次启动时长、开屏/首页广告有无、天气刷新是否正常、规则命中数**。
- 提交 GitHub 时**新增实验文件**，不要直接覆盖稳定的 V7；验证后再决定是否提升为新基线。必要时立刻回退 V7/V6。

### D. 建议的回归验收标准

- 开屏：三次冷启动均没有明显恢复到过去的 4～5 秒额外等待；以屏幕录制/秒表确认。
- 广告：三次均无开屏广告；进入首页至少停留 30～60 秒、上下滑动、切换天气详情与 15 天预报，检查广告及空白占位。
- 天气：当前城市、实时天气、逐小时、15 天预报可加载；城市切换、定位、账户（使用时）正常。
- 日志：广告相关 204/图片替换规则真实命中，无异常高频失败重试；首页核心数据正常。
- **保存对照表和原始日志**；不要仅凭单次“看起来没广告”宣布永久稳定。

## 5. Loon 规则关键片段（便于从零快速恢复）

下列只是**关键片段**；最完整、准确的配置仍是上方固定提交中的 **V7 插件原文件**。如果将片段手工拼入已有插件，务必处理其他插件重复规则。

```ini
[Rule]
# 不要改成 REJECT。注意 DOMAIN 精确主机，与 DOMAIN-SUFFIX 有区别。
DOMAIN,adlaunch.moji.com,DIRECT
DOMAIN,ztoken.uyunad.com,REJECT
DOMAIN,sdk-config.tanx.com,REJECT
DOMAIN,et.tanx.com,REJECT
DOMAIN,janapi.jd.com,REJECT

[Rewrite]
# V7 增加的实验性规则：191 日志中未观察到实际命中，勿误认其已证实有效。
request if ${url} ~= /^https?:\/\/adlaunch\.moji\.com(?:\/|$)/i then reject(204)
# 证据较强：191 日志中 30 + 26 次命中 204。
request if ${url} ~= /^https:\/\/dsp-x\.jd\.com\/adx\/sdk(?:\?|$)/i then reject(204)
request if ${url} ~= /^https:\/\/opehs\.tanx\.com\/japi(?:\?|$)/i then reject(204)
# 只处理曾确认的京东素材路径，不封锁整站图片。
request if ${url} ~= /^https:\/\/img1\.360buyimg\.com\/pop\/jfs\//i then reject_img(200)

[MITM]
hostname = *.api.moji.com, tnc*-*.zijieapi.com, dsp-x.jd.com, opehs.tanx.com, img1.360buyimg.com, adlaunch.moji.com
```

在插件其他位置，仍应保留原 V7 中的入口净化和相关短视频/社区接口处理。**不要把上述片段当作完整可直接订阅的插件。**

### 新语法要点（Loon 官方）

- 新 `[Rewrite]` 语法适用于 **3.5.1（978）起**；HTTPS 必须通过 **MITM 解密**后才可执行 URL Rewrite。
- `request if ... then reject(204)`：在请求侧立即返回指定 HTTP 状态，空 Body。
- `request if ... then reject_img(200)`：用 1×1 GIF 响应图片请求。
- `reject_dict(200)` / `reject_array(200)` 可给 JSON API 返回合法的 `{}` / `[]`，但**只有接口确实接受该形状时才能使用**。
- 复写执行在普通规则匹配之前：`DOMAIN,...,DIRECT` 不等于该请求一定会到达服务器，匹配的请求级 Rewrite 仍可能先响应。

文档来源：<https://nsloon.app/docs/Rewrite/rewrite_v2/> 、<https://nsloon.app/docs/Rewrite/>。

## 6. 随手可用：Loon ZIP 本地摘要脚本（脱敏输出）

将下面代码保存为 `moji_log_quickcheck.py`，执行：

```bash
python moji_log_quickcheck.py 191_1793499529999.zip
```

脚本**只输出域名、路径（不含 `?` 后的 sign/token）、方法、状态码、改写计数与启动接口间隔**，不打印请求正文、Cookie 或坐标；仅供初筛，不能取代检查真实响应格式与 UI 行为。

```python
#!/usr/bin/env python3
# Python 3 标准库。只读 ZIP，不解压到磁盘。
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("用法: python moji_log_quickcheck.py <Loon导出.zip>")

src = Path(sys.argv[1])
with zipfile.ZipFile(src) as z:
    names = set(z.namelist())
    folders = sorted({x.rsplit('/', 1)[0] for x in names if x.endswith('/request_header_raw.txt')})
    records = []
    for folder in folders:
        req = z.read(folder + '/request_header_raw.txt').decode('utf-8', 'replace')
        def first(pattern):
            found = re.search(pattern, req, flags=re.I | re.M)
            return found.group(1).strip() if found else ''
        host = first(r'^:authority:\s*(\S+)') or first(r'^Host:\s*(\S+)')
        path = first(r'^:path:\s*(\S+)') or first(r'^(?:GET|POST|PUT|HEAD|PATCH)\s+(\S+)')
        method = first(r'^:method:\s*(\S+)') or first(r'^(GET|POST|PUT|HEAD|PATCH)\s+')
        if path.startswith('http'):
            from urllib.parse import urlsplit
            parts = urlsplit(path)
            host, path = (host or parts.netloc), parts.path
        clean_path = path.split('?', 1)[0]  # 避免输出 sign / token / requestId
        def status(file):
            p = folder + '/' + file
            if p not in names:
                return None
            s = z.read(p).decode('utf-8', 'replace')
            m = re.search(r'(?m)^:status:\s*(\d{3})|^HTTP/\S+\s+(\d{3})', s)
            return int(next(v for v in m.groups() if v)) if m else None
        try:
            ms = int(folder.rsplit('_', 1)[-1])
        except ValueError:
            continue
        records.append((ms, host, clean_path, method,
                        status('response_header_raw.txt'),
                        status('replace_response_header_raw.txt')))

records.sort()
counts = Counter((host, path, method, rewrite or orig or 'unknown', rewrite is not None)
                 for _, host, path, method, orig, rewrite in records)
print('文件:', src.name, '总请求:', len(records))
print('\n高频接口（不含参数）:')
for (host, path, method, code, modified), n in counts.most_common(30):
    print(f'{n:>4}  {method:<5} {host}{path}  status={code} rewritten={modified}')

# 相邻两轮由 flyCardMd 请求区分；数值是两个请求的时间差，非屏幕启动时间。
starts = [r[0] for r in records if r[1] == 'fcard.api.moji.com'
          and r[2] == '/flycard/flyCardMd']
print('\nnovice -> adnovice 间隔:')
for i, start in enumerate(starts):
    end = starts[i + 1] if i + 1 < len(starts) else 2**63
    subset = [r for r in records if start <= r[0] < end]
    a = [r[0] for r in subset if r[1] == 'mcmn.api.moji.com'
         and r[2] == '/operational/novice']
    b = [r[0] for r in subset if r[1] == 'mcmn.api.moji.com'
         and r[2] == '/operational/adnovice']
    print(f'  第{i+1}轮: {(b[0] - a[0]) / 1000:.3f}s' if a and b
          else f'  第{i+1}轮: 未形成完整接口对')
```

> 本脚本适用于本次导出 ZIP 的目录结构：`<请求ID>_<时间戳>/request_header_raw.txt` 等。若 Loon 将来改变导出结构，需要更新解析器。对于只有 CONNECT、加密流量、无响应头或被缓存直接展示的广告，仍然需要结合 Loon GUI 和屏幕录制分析。

## 7. 更新记录模板（下次故障直接复制）

```markdown
### YYYY-MM-DD｜墨迹天气 X.Y.Z｜Loon X.Y.Z
- 现象：开屏广告 / 首页广告 / 启动停顿 / 天气功能异常
- 复现：Wi-Fi / 蜂窝；冷启动 3 次实际耗时（秒）：__ / __ / __
- 对照：关闭本插件冷启动 3 次：__ / __ / __；有无广告：__
- 本次抓包（仅私有位置）：____.zip；对应广告截图时间：__
- 广告标识：来源 SDK：__；广告位 position：__；素材域名：__
- 请求：METHOD https://域名/路径（去掉查询参数与 Token）
- 真实返回：HTTP __；Content-Type __；Body 结构：__（只写字段形状）
- V7 基线命中：京东 204 __ 次；Tanx 204 __ 次；素材替换 __ 次
- 修改内容：只改了 __ 行；原策略 __ → 新策略 __
- 结果：启动 __；开屏 __；首页 __；天气 __；错误/重试 __
- 决定：继续试验 / 回退 V7 / 确认为 V8
- 新文件：main/MoJiWeather_*.lpx；提交 SHA：__
```

## 8. 风险与存档规范

- **不要把抓包 ZIP 原件提交到公共仓库**：其中可能包含 `sign`、会话标识、广告 ID、设备信息、位置与访问令牌。将 ZIP 私下保留并仅上传脱敏摘要或截图。
- **避免误杀普通业务**：天气、定位、账户、城市、授权和核心配置请求必须继续验证。
- **部分域名可在其他 APP 中复用**：Loon 的规则并不是自动只对墨迹天气生效；京东/Tanx 等 SDK 被拦截可能影响其他 APP，发生问题应回退或调整命中范围。
- **广告可能走缓存、预加载、另一 SDK 或新的 CDN**：一次没有素材请求不等于无广告请求；新版本要重新抓到广告实际展示时的流量。
- **不要盲目追求零广告请求**：不应单纯把 `xlog.jd.com`、`v1.log.moji.com` 等统计上报全拦掉。强行阻断可能改变 SDK 逻辑，触发重试、白屏或固定等待。
- **保留固定提交链接**：若 `main` 更新后的插件出现回归，可以按本档案中的 SHA 快速回到 V7/V6。

---

**本档案后续维护原则：** 只添加经过抓包验证的新端点、对照实验结果与对应 Git SHA；标注“确认 / 疑似 / 尚未验证”，避免以后把相关性误当作因果关系。

---


## 9. 2026-11-03 复发记录（192 号）与 V8 精准补漏

### 9.1 发现与证据（已抓包确认）

- 原始日志：`192_1793711468308.zip`（**原文件仅私下存放，不提交 GitHub**）。
- 时段：2026-11-03 21:11:08～21:11:45（北京时间），共 **544 条 HTTP 请求记录、65 条带响应替换记录**。
- 同版本交叉核验：`191` 与 `192` 的墨迹 UA 均为 **9.0950.02**；此次广告出现**不以 APP 更新为前提**，可能是投放轮换、预加载、缓存或其他上下文变化，尚不能断定唯一原因。
- 既有京东竞价接口 `dsp-x.jd.com/adx/sdk` **22/22** 返回 HTTP 204，Tanx `opehs.tanx.com/japi` **18/18** 返回 HTTP 204。V7 的核心拦截仍生效，问题不是原规则全部失效。
- **真实图片 A**：`img2.360buyimg.com/tgx/jfs/...` 返回 HTTP 200，下载约 **133,938 B** 图片，内容为京东双 11 竖幅开屏素材。V7 只拦截 `img1.360buyimg.com/pop/jfs/`，因域名与路径都不同而漏过。
- **真实图片 B**：`ilce.alicdn.com/minolta/500411571/0/...` 返回 HTTP 200，下载约 **231,104 B** 的苏泊尔电压力锅横幅素材，**高度疑似 APP 内中间广告**。此前 191 日志亦有 `ilce.alicdn.com/minolta/500411585/0/...` 请求，说明素材域名在 V7 正常时也可能出现。
- `weather.api.moji.com/data/home` 共 **8 条正常响应**；`mcmn.api.moji.com/operational/adnovice` 的原始 JSON 仍含 `adShow:0`，无法控制所有第三方广告。
- `adlaunch.moji.com` 本次无单独抓到的 HTTPS 请求，因此**不能证明 V7 的 adlaunch 204 命中了，也不能据此要求恢复整域 REJECT**。

### 9.2 V8 的最小范围改动（待用户实机验收）

新插件：`main/MoJiWeather_AdBlock_V8.lpx`（固定提交 [`c186d500`](https://github.com/hahapkpk/js/blob/c186d50060d4352072ee61a0df92bfe9cac2352c/main/MoJiWeather_AdBlock_V8.lpx)）。基于 V7 **只新增两条定向图片替换及对应 MITM hostname**：

```ini
[Rewrite]
request if ${url} ~= /^https:\/\/img2\.360buyimg\.com\/tgx\/jfs\//i then reject_img(200)
request if ${url} ~= /^https:\/\/ilce\.alicdn\.com\/minolta\/\d+\/\d+\//i then reject_img(200)

[MITM]
# 在 V7 原 hostname 末尾增补：img2.360buyimg.com, ilce.alicdn.com
```

以上仅为新增片段，必须使用 V8 **完整插件**订阅，不应将上面的独立 MITM 片段覆盖原列表。**未修改** `adlaunch.moji.com,DIRECT`、京东/Tanx HTTP 204、天气核心接口、飞卡二进制响应或运营接口。

### 9.3 测试与回退

1. 停用 V7 和其他墨迹专用模块，只打开 V8，确认 Loon Rewrite/MITM 加载成功及证书已信任。
2. 冷启动三次并实际计时，检查开屏是否有广告或空白倒计时；进入首页等待 60 秒、上下滚动，检查是否出现锅具广告或空白广告占位。
3. 在 Loon 请求记录中，观察 `img2.360buyimg.com/tgx/jfs/`、`ilce.alicdn.com/minolta/` 是否命中 **图片替换 HTTP 200**，而不是正常下载 134 KB / 231 KB。**没请求时也可能是缓存；不能因为没有命中就宣称生效。**
4. 检查 `/data/home` 数据、城市切换、每小时天气和 15 天预报是否正常。
5. 如启动重新出现 4～5 秒等待、图片大面积加载异常、空白倒计时，立即停用 V8，**回退固定版本 V7**。原始 ZIP 应脱敏后分析，不要公开上传含 Token、位置、完整请求内容的原件。
6. **V8 暂无实际验证**：新图片规则理论上匹配 192 日志中的两个素材，但是否解除已经缓存的广告和 SDK 的计时逻辑，须靠下一轮实测确认。

---


## 10. 2026-11-03 第三次复发：193 号日志确认 MP4 开屏视频本地缓存

### 10.1 核心分析（193 原包仅私下存放）

- `193_1793712068517.zip`：2026-11-03 21:21:11～21:22:40（北京时间），共 **1,125 条 HTTP 请求**，含 **13 轮 `/operational/novice` 启动相关请求**。
- V8 在本次日志中正常生效：`dsp-x.jd.com/adx/sdk` **36 条返回 204**、`opehs.tanx.com/japi` **23 条返回 204**、`ilce.alicdn.com/minolta/...` **5 条替换为 1×1 图片**。因此不能再把间歇出现广告归因于「V8 未正确加载」。
- 开屏广告的更强证据：`v2.log.moji.com/ad/data2/print` 内有 **5 条** `position=1`、`stat_type=1`、`is_local=true` 记录，且都指向 `ad_img_url=https://a1.alibabausercontent.com/prod/feupload/user/7clgu/...` 下的 **`.mp4_.mp4` 视频**。这些是广告事件上报，并非独立的视频播放录屏；但与“隔 1～2 次又出现广告”的实测表现吻合。
- 在真实流量中，`a1.alibabausercontent.com` 的该目录还出现了 **2 条视频 HTTP 200 下载**：294,293 B 和 378,673 B，`Content-Type: video/mp4`。此前所有版本均未针对这条视频路径拦截；V8 只覆盖了京东/阿里 **图片**路径。
- `ad.api.moji.com/ad/log/stat` 亦有 **5 条** `ad_index=1`、`stat_type=1` 的上报，进一步支持开屏广告路径仍在工作。
- `ad_id=100010060282` 为本次上报中出现的广告位或素材标识，仅用于此次日志关联；**不要仅匹配这个 ID**，因为下一次广告投放可能轮换。
- 本次 `/data/home` **25 条均为 HTTP 200**；没有证据表明天气主业务依赖该视频资源。
- 结论：可确认 **V8 漏掉了视频素材下载**，同时日志标明 **可能使用本地缓存**。这并不保证只拦截下载就能立刻移除既有缓存；后续需在启用新规则后清缓存并复测。

### 10.2 V9 新增的精确 MP4 规则（待实机测试）

V9：[`main/MoJiWeather_AdBlock_V9.lpx`](https://github.com/hahapkpk/js/blob/main/main/MoJiWeather_AdBlock_V9.lpx)，固定提交 `af017a30e84ace10c92cb458fd1833a6712cd953`。基于 V8 **仅新增 1 条媒体 URL Rewrite 及 1 个 MITM 主机名**：

```ini
[Rewrite]
request if ${url} ~= /^https:\/\/a1\.alibabausercontent\.com\/prod\/feupload\/user\/7clgu\/[^/?]+\.mp4_\.mp4(?:\?|$)/i then reject(204)
[MITM]
# 在 V8 已有 hostname 列表末尾新增：a1.alibabausercontent.com（不要覆盖原列表）
```

作用：阻止 **未来** 再下载这条已证实属于开屏广告的 `mp4_.mp4` 路径，不屏蔽整个阿里 CDN；不改飞卡、天气、定位、账户、运营接口，也不改变 `adlaunch.moji.com,DIRECT`。

### 10.3 实机验收（先测试再把 V9 定为稳定版）

1. 停用 V8 和其他墨迹专用插件，只启用 V9，保证 Loon MitM 信任证书及改写正常工作。建议 Loon 最低版本 3.5.1（978）。
2. 先冷启动 5～10 次，分别记录广告出现与否和实际启动秒数；观察 `a1.alibabausercontent.com/prod/feupload/user/7clgu/...mp4_.mp4` 是否命中 `reject(204)`。
3. **已经缓存的视频不会因为网络规则生效自动消失**。如仍有广告，先在墨迹天气内清理缓存；若仍无效、且确认账号/城市等个人设置有备份，再考虑删除 App 并重装（不是“卸载 App”，因为后者保留数据）。这一步会清除本地应用数据，用户自行确认。
4. 如出现开屏变慢、空白视频/倒计时、天气数据异常，停用 V9 并回退 V8 或 V7，保留测试日志和截图。
5. 拦截视频并不能保证 App 不从备用 SDK、缓存或新的 CDN 获取素材。若仍有广告，优先按 `/ad/data2/print` 的 `position=1`、`is_local`、`ad_img_url` 查真实素材 URL，不要封锁 `v2.log.moji.com` 这类**仅用于记录事件**的域名，以免失去诊断证据。
6. 完整 ZIP 中包含可能敏感的 Cookie、标识符、经纬度或用户信息，**不要提交到公开 GitHub**；只保存脱敏统计与精准规则。

