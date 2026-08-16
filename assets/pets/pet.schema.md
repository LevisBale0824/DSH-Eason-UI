# 宠物包契约（pet pack contract）

一个"宠物" = `assets/pets/` 下的一个子目录。**新增宠物不需要改任何代码**：
放好目录 → 重启一次 `dsh web`（首次扫描）→ 设置页「桌宠 → 当前宠物」下拉即出现新宠物。

## 目录结构

```
assets/pets/<petId>/            # petId：小写英文，全局唯一
  pet.json                      # 描述符（见下）
  thumb/<动画名>.webm           # 360×360 播放变体（必须，随包分发）
  full/<动画名>.webm            # 可选：1200×1200 原始母版（建议放 $DSH_HOME，别进包）
```

## pet.json 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 与目录名一致 |
| `label` | string | 设置页/菜单里显示的名字 |
| `description` | string | 可选，一句话介绍 |
| `order` | number | 可选，下拉排序（小在前） |
| `canvas` | `{w,h}` | thumb 画布尺寸（如 360×360） |
| `feetY` | number | 画布上"脚底"的 y 坐标（落地对齐用，如 330） |
| `catalog.idle` | string | 待机动画名（循环播放的"呼吸"节点） |
| `catalog.turns` | string[] | 转向动画池（播完程序翻转朝向） |
| `catalog.acts` | string[] | 随机动作池（等概率、避免连续重复） |
| `catalog.clicks` | string[] | 点击回应池 |
| `catalog.drag` | string | 拖拽时循环的动画 |
| `catalog.walkLeft` / `walkRight` | string | 方向锁定步行动画（素材本身朝行进方向，不做镜像） |

## 硬性规则（沿用 dsh-pet-from-image 经验）

- 目录里引用的每个动画名必须有同名 `.webm`（`node scripts/check-pets.mjs` 双向核对）。
- thumb 用 WebM VP9 `yuva420p`（带透明），真实帧率 ≥ 20fps。
- 所有片段同一角色、同镜头设定：人物大小与脚底 y 一致。
- 一段 6~12 秒；idle 需首尾可衔接。

## 额外的宠物根目录（不改插件包也能加宠物）

宿主侧还会扫描（同 id 时**后者覆盖前者**）：

1. 插件包内 `assets/pets/`（随包发布）
2. patch 配置 `extraPetRoots: [...]`（绝对路径数组）
3. `$DSH_HOME/aqua-pets/`（用户投放区，结构与上面相同；1200 母版放这里的 `full/`）

浏览器经 `/aqua-pet/manifest.json` 拿到全部宠物清单；
动画地址 `/aqua-pet/<petId>/thumb/<动画名>.webm`、母版 `/aqua-pet/<petId>/full/<动画名>.webm`。
