# @deepseek-ai/dsh-client-ui-aqua

[English](README.md) | 中文

Aqua 是一层高自由度的玻璃质感主题 + 一只多宠物桌宠，套在 DeepSeek Harness 网页端。顶栏、侧边栏、输入框、统计行、轨迹视图都成了磨砂玻璃片；右下角住着一只可切换的桌面宠物（首个角色：Eason）。关掉开关就回到原生界面，不改 DSH 任何一行源码。

![](assets/1.png)

![](assets/2.png)

![](assets/3.png)

![](assets/4.png)

## 特性

- **双模式**：**云母效果**把布局改成悬浮玻璃卡片（模糊度、磨砂度可调）；**兼容模式**保持原版排版一字不动，只把材质换成通用玻璃，其他插件的界面也会自动玻璃化
- **背景自由**：流体板（颜色可调）或自定义壁纸——**原图无损保存**（宿主 `/aqua-wallpaper` 路由落盘服务，不压缩不降分辨率；旧宿主自动回退本地压缩），支持**交互式裁剪**（拖动构图 + 滚轮/滑杆缩放，裁剪框即屏幕比例，按原图分辨率无损应用，可反复重裁）与适配方式（填充/适应/拉伸）、缩放、水平/垂直位置、模糊度/磨砂度；浅色壁纸配浅色模式、深色壁纸配深色模式观感更佳
- **背景亮度**：自动跟随深浅模式——深色模式 0–50 压暗、浅色模式 50–100 提亮，50 原样
- **粒子鲸鱼**：deepseek.com/harness 同款粒子鱼（官网粒子引擎移植），显示在聊天区域正中央（不含侧边栏），深色模式白粒子、浅色模式灰粒子，设置里可开关
- **Harness 光泽铭牌**：深色模式下侧边栏铭牌换成官网同款「Harness」药丸（135° 渐变描边 + 柔光），浅色模式保持原版铭牌
- **边缘渐变模糊**：页面顶部/底部各 5px 渐变模糊带，悬浮在聊天内容上层，内容滚到边缘渐入模糊；浅色微泛白、深色微泛黑
- **多宠物桌宠**：18 段 Eason 专属透明动画（演唱会/编程/日常），待机呼吸、随机动作链、点击/拖拽互动、漫游模式；**宠物与主题开关互相独立**，设置 → 桌宠 里可切换角色
- 一键开关：关闭即完全还原原生界面，所有效果随插件卸载一并消失

## 安装

### Windows（一条命令）

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/WYH66666666/DSH-Transparent-UI-Plugin/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

默认安装**最新发布版**。不需要装 git，安装器会退回到直接下载 zip。脚本会把插件链接进 profile 的 `node_modules`，并在 `cordis.patch.yml` 里登记 `ui-aqua`（幂等，重复跑不会重复登记）。刷新 Web 界面即可。

指定版本或跟随开发分支：

```powershell
.\install.ps1 -Version 'v1.1.0'   # 指定某个发布版
.\install.ps1 -Version 'main'     # 开发分支
```

### macOS / Linux（手动，三步）

```sh
git clone --depth 1 --branch v1.1.0 https://github.com/WYH66666666/DSH-Transparent-UI-Plugin.git
ln -s "$PWD/DSH" "$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-client-ui-aqua"
```

然后往 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: ui-aqua
      name: '@deepseek-ai/dsh-client-ui-aqua'
```

## 使用

刷新 Web 界面。Aqua **默认开启**；总开关在 **设置 → 插件 → 玻璃主题** 卡片上（形状与其他插件卡片一致），卡片内点**「展开设置」**折叠区即可调节全部效果（与其他插件的折叠设置一致）：模式、模糊度/磨砂度（云母模式）、流体颜色、背景亮度、背景（流体/壁纸）与壁纸设置、粒子鲸鱼/小鱼开关。总开关关闭时折叠区收起且不可展开，**通用设置保持原样**、不再混入任何主题控件。

## 桌宠（多宠物）

宠物与主题总开关**互相独立**：主题关了宠物照常活动。设置面板左侧底部有一页 **「桌宠」**：

| 设置项 | 说明 |
|---|---|
| 显示宠物 | 关闭后隐藏宠物并停止全部视频解码，其余设置保留 |
| 当前宠物 | 角色切换下拉（装了多个宠物包时出现）；**右键宠物 → 切换到…** 也可快捷切换 |
| 漫游模式 | 开启后宠物随机起身行走（右键宠物也可切换） |
| 尺寸 | 显示高度滑杆，160–420px，拖动实时预览 |
| 默认角落 | 未被拖拽/漫游时停靠右下角或左下角 |
| 重置位置 | 立即送回默认角落 |

以上设置持久化在浏览器 localStorage（键 `aqua-pet.*`）；从独立 eason-pet 插件迁移时会自动沿用旧设置（尺寸/角落/漫游/隐藏）。

### 添加新宠物（不用改代码）

宠物 = 一个目录，契约见 [`assets/pets/pet.schema.md`](assets/pets/pet.schema.md)：

1. 准备素材：待机×1、转向×1、动作×10+、点击回应×2、拖拽×1、左右步行×2（WebM VP9 `yuva420p` 透明、真实帧率 ≥20fps、同一角色、脚底 y 一致——可用 `dsh-pet-from-image` skill 从母版图生成）
2. 建目录 `assets/pets/<新角色>/`，放 `pet.json`（描述动画目录与画布参数）和 `thumb/*.webm`
3. `node scripts/check-pets.mjs` 校验通过 → 重启 `dsh web` → 设置 → 桌宠 → 当前宠物 里即可切换

也可以不动插件包：把宠物目录放进 `$DSH_HOME/aqua-pets/`（1200×1200 原始母版放该目录的 `full/` 子目录，经 `/aqua-pet/<petId>/full/<file>.webm` 提供）。

### 路由

宿主半侧注册两个前缀路由：

- `/aqua-pet`：`manifest.json`（宠物清单）、`<petId>/thumb/<file>`（360 播放变体，内存缓存 + 启动预热）、`<petId>/full/<file>`（原始母版，不缓存）
- `/aqua-wallpaper`：`current`（采纳探测，含 `originalUrl`）、`img`（GET 显示图 / PUT 上传原图 ≤40MB / DELETE 删除）、`original`（GET 未改动的原图，裁剪编辑器的源）、`cropped`（PUT 裁剪结果，仅写显示图）；文件存于 `$DSH_HOME/aqua-wallpaper/`（`original.<ext>` + `wallpaper.<ext>`）
