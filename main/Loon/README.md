# Loon · Muse / Meta 独立分流规则

更新日期：2026-11-02

## 文件说明

- `Muse.list`：Muse (`muse.ai`) 及其专用 VM / 网关域名，共 4 条。主要依据 Meta 官方公告以及第三方技术研究。
- `Meta.list`：Meta AI、Facebook、Instagram、Threads、WhatsApp、Messenger、Quest 等核心域名，共 18 条。为轻量精简版，**不是**所有 Meta 域名和 IP 的完整覆盖。
- 两个文件均为 Loon **远程规则列表**，每行只有 `DOMAIN`/`DOMAIN-SUFFIX,域名` 两段；不含策略名、`[Rule]` 或 `[Remote Rule]` 标题。
- 完整 Meta 规则可另行选用 Blackmatrix7 Facebook.list，但请避免重复订阅造成规则重复和策略冲突。

## 仓库位置

```text
hahapkpk/js (branch: main)
└── main/
    └── Loon/
        ├── Muse.list
        ├── Meta.list
        └── README.md
```

## 远程规则地址

```text
https://raw.githubusercontent.com/hahapkpk/js/main/main/Loon/Muse.list
https://raw.githubusercontent.com/hahapkpk/js/main/main/Loon/Meta.list
```

## Loon 配置

在当前 Loon 配置的现有 `[Remote Rule]` 节中加入以下两行（**不要重复添加 `[Remote Rule]` 标题**）：

```ini
# Muse / Meta：Muse 尽量放在 Meta/Facebook 等宽泛规则集之前
https://raw.githubusercontent.com/hahapkpk/js/main/main/Loon/Muse.list, policy=United States, tag=Muse AI, enabled=true
https://raw.githubusercontent.com/hahapkpk/js/main/main/Loon/Meta.list, policy=United States, tag=Meta, enabled=true
```

也可以通过 Loon：配置 → 规则 → ＋ → 添加远程规则，分别粘贴 URL、设置 `United States`、保存和更新。

**注意：** 策略组名称必须与 Loon 配置中一致，本方案按既有的 `United States` 策略组举例。优先将 Muse 和 Meta 指向同一个稳定的美国节点，以降低共享登录 API 时可能出现的出口差异。

## 域名取舍与风险说明

- `muse.ai` 是 Meta 官方确认的产品入口。
- `metaaivm.com`：第三方 Muse 客户端技术分析中观察到的加密 WebSocket / 个人 VM 网关。
- `hatch-api.meta.ai`、`edge-metaclaw-http.c10r.facebook.com`：第三方技术分析观察到的 Muse API / 网关；使用情况可能变更。
- `meta.ai`、`api.meta.ai`、`facebook.com` 等共享域名不进入 Muse 专用文件；由 Meta.list 处理（`api.meta.ai` 会被 `meta.ai` 后缀匹配）。
- 未采用 `museai.com`：截至编写时缺乏能证明其属于 Meta Muse 的可靠依据。
- 未采用 `ecto1.ai` 与 `ep7.facebook.com` 作为 Muse 专用规则：前者未核实为必要域名，后者与其他 Facebook/Instagram 服务共享。
- 未加入广泛的 `IP-CIDR` / `IP-ASN` 规则，避免意外改变非 Meta 业务的出口。
- **规则仅经过静态格式校验，未在 iPhone/Loon 环境做过实际连接验证。** 若有缺失域名，请在 Loon 请求记录里按 App 过滤后补充。

## 验证步骤

1. 在浏览器访问两个 Raw URL，确认显示纯文本且没有 404。
2. 在 Loon 更新远程规则、打开请求记录，再进入 `https://muse.ai`。
3. 核对 `muse.ai` 和 `*.metaaivm.com` 是否匹配 `Muse AI`，Meta 登录域名是否匹配 `Meta`，出口是否为预期美国节点。
4. 测试 Muse 发送消息、持续对话、登录/刷新等功能。遇到异常只根据实际连接域名增加精确规则，不要盲目把 `facebook.com` 等共享域名全部移入 Muse。

## 参考资料

- Meta 官方 Muse 日本发布：https://about.fb.com/ja/news/2026/10/muse-personal-ai-agent-launches-in-japan/
- Meta 官方 Muse 发布：https://about.fb.com/ja/news/2026/09/introducing-muse-personal-ai-agent/
- Loon 配置实例：https://github.com/Loon0x00/LoonExampleConfig/blob/master/example.conf
- Loon 远程规则文档：https://doc.repcz.link/loon/filter/
- 个人 VM 与 Muse 网关技术分析（非官方）：https://github.com/duclm1x1/Muse-Chat-MCP
- Muse macOS 应用逆向分析（非官方）：https://github.com/barkleesanders/muse-endo-teardown
- 完整 Facebook Loon 规则：https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Facebook/Facebook.list
