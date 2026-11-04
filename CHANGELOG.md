# Changelog

## 1.0.0 — 2026-11-05

首个版本。

- 设置 → 通用 →「更多字体设置」里的正文 / 代码 / 终端三个字体输入框改为可搜索下拉，列出本机已安装字体。
- 触发器与弹层按 Harness 官方控件规格复刻：36px 高、`module-platform` 填充、`radius-md`、无边框；弹层用官方菜单材质（`--dsw-specific-menu` + backdrop blur + `--dsw-elevation-prominent`）。
- Host 半体用 GDI+ 枚举字体家族，`GET /plugins/font-dropdown/fonts` 返回列表，60 秒缓存并复用会话鉴权。
- Host 不可用时退回内置常用字体清单，并在列表下方提示。
- 当前值不在列表里（多字体栈）时自动补进选项，不会丢失配置。