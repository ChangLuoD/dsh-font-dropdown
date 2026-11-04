# dsh-font-dropdown

把 DeepSeek Harness「设置 → 通用 → 字体」里的三个**字体名称输入框**换成**可搜索的下拉列表**，直接列出这台机器上已安装的字体。

> 官方原本要求手输字体名（`"钉钉进步体"`、`JetBrains Mono Medium`…），写错一个引号就静默回落。这个插件把它变成点选。

## 特点

- **原位替换**：不新开设置页，仍是「字号大小 → 更多字体设置」里的正文 / 代码 / 终端三行，位置和文案都不动。
- **可搜索**：输入片段即可过滤，一两百个字体也能快速定位。
- **所见即所得**：每个选项用该字体自身渲染，选之前就知道长什么样。
- **保留官方观感**：触发器按官方「语言」行的 selector 规格复刻（36px 高、`--dsw-alias-bg-module-platform` 填充、无边框、`radius-md`），弹层用官方菜单材质（半透明 + backdrop blur + elevation 阴影），深色主题下不会出现突兀的浅色方块。
- **写入路径与手输一致**：调用客户端 theme 服务的 `setFontFamily(role, value)`，持久化在同一个 `ui-theme` 设置段，重启后保留。
- **可用的降级**：Host 路由不可用时退回内置常用字体清单并在列表下方提示，界面不报错。

## 安装

通过 Harness 插件管理器（推荐）：

```
plugin_manager install_bundle(target: "dsh-font-dropdown")
```

或命令行：

```bash
dsh plugin --profile <你的 profile> add dsh-font-dropdown
```

从源码安装：把 `target` 换成本仓库目录的绝对路径。安装后**刷新页面**（Ctrl+R）——浏览器半体只在页面加载时执行。

## 使用

设置 → 通用 → 字号大小 → 展开「更多字体设置」：

- 第一项「默认字体」= 清空覆盖，回落到主题默认字体栈。
- 当前已配置但不在列表里的值（例如手写过的多字体栈）会自动补进列表，不会被悄悄丢掉。
- 点触发器展开，输入搜索，方向键移动，Enter 选中，Esc 或点击外部关闭；空间不够时弹层向上翻转。

## 实现

| 半体 | 文件 | 作用 |
|---|---|---|
| Host | `index.js` | 用 GDI+（`System.Drawing.Text.InstalledFontCollection`）枚举字体家族，提供 `GET /plugins/font-dropdown/fonts`，60 秒缓存，同源 + 会话鉴权 |
| Client | `client.js` | 在 `settings.general.item` 槽位注册一行（order 11.5），渲染三个自绘下拉；用 CSS 隐藏官方那三条输入行 |

隐藏官方行的选择器是 `[class*="_row"]:has(input[aria-label="正文字体"])`（及代码/终端、英文 aria-label 共 6 个），所以只命中官方那几行，不会误伤同列的其它控件。

## 已知限制

- **Windows 专用枚举**：字体列表来自 GDI+。macOS / Linux 宿主会退回内置清单（仍可用，但不是本机真实字体）。
- **超长名字被截断**：GDI+ 把家族名截到 19 个字符（如 `Bahnschrift SemiBold SemiConden`），写入的也是截断名，可能匹配不到原字体。
- **依赖官方 DOM**：隐藏输入行靠官方 row 的类名与 aria-label。官方改版后可能失效，表现为官方输入框和下拉同时出现——功能不受影响，等更新即可。
- **新装字体要刷新**：Host 侧缓存 60 秒。
- 与其它字体插件同时启用时，谁最后写 `--dsh-font-family-*` 谁生效，建议只留一个。

## 和同类插件的区别

社区已有不少字体插件（`dsh-font-probe`、`@klarkxy/dsh-font`、`@nakus0426/dsh-font`、`@igaozp/dsh-font-settings` 等），它们基本都是在设置里**新增**一个页面或卡片，官方那三个输入框照旧留着。本插件的取舍是相反的：不新增入口，只把官方入口换成更好用的控件。

## 开发

- `client.js` 通过 `window.__ModuleLoader__.load({ id, factory })` 注册，`id` 必须等于包名；React 从浏览器模块表拿，不打包。
- 样式全部走主题 token（`--dsw-alias-*`、`--dsw-radius-*`、`--dsw-elevation-*`），不引入外部 CSS 依赖。
- 改完 `node --check index.js client.js`，刷新页面即可看到效果（本地 link 安装时不需要重装）。

## License

[MIT](LICENSE)