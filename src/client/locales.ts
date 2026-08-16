/** `settings.aqua` namespace dictionaries (the settings-row copy). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.aqua'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'aqua.title': '玻璃主题',
  'aqua.description': '全局玻璃质感，云母/兼容双模式，模糊度、磨砂度、背景与颜色都可自由调节',
  'aqua.enable': '开启',
  'aqua.disable': '关闭',
  'aqua.expand': '展开设置',
  'aqua.collapse': '收起设置',
  'aqua.disabledHint': '先开启玻璃主题，再调整各项效果',
  'aqua.mode': '模式',
  'aqua.modeMica': '云母效果',
  'aqua.modeCompat': '兼容模式',
  'aqua.modeHint': '兼容模式保持原版排版，只把材质换成玻璃，其他插件的界面也会自动玻璃化',
  'aqua.whale': '粒子鲸鱼',
  'aqua.critters': '小鱼',
  'aqua.blur': '玻璃模糊度',
  'aqua.frost': '磨砂度',
  'aqua.fluidHue': '背景流体颜色',
  'aqua.bgBrightness': '背景亮度',
  'aqua.bgBrightnessHintDark': '深色模式：0 压暗至纯黑，50 原样',
  'aqua.bgBrightnessHintLight': '浅色模式：50 原样，100 提亮至纯白',
  'aqua.background': '背景',
  'aqua.backgroundFluid': '流体',
  'aqua.backgroundWallpaper': '壁纸',
  'aqua.wallpaper': '壁纸',
  'aqua.wallpaperHint': '浅色壁纸用浅色模式，深色壁纸用深色模式⚠️',
  'aqua.chooseWallpaper': '选择图片',
  'aqua.deleteWallpaper': '删除',
  'aqua.wallpaperBlur': '壁纸模糊度',
  'aqua.wallpaperFrost': '壁纸磨砂度',
  'aqua.wallpaperFit': '壁纸适配',
  'aqua.wallpaperFitCover': '填充',
  'aqua.wallpaperFitContain': '适应',
  'aqua.wallpaperFitFill': '拉伸',
  'aqua.wallpaperFitHint': '推荐先用「裁剪」把构图定成屏幕比例；未裁剪时：适应=完整显示，填充=裁切铺满，拉伸=变形铺满',
  'aqua.wallpaperScale': '壁纸缩放',
  'aqua.wallpaperPosX': '水平位置',
  'aqua.wallpaperPosY': '垂直位置',
  'aqua.cropWallpaper': '裁剪',
  'aqua.cropTitle': '裁剪壁纸',
  'aqua.cropHint': '拖动调整构图，滚轮或滑杆缩放；裁剪框即屏幕显示范围，应用后按原图分辨率无损保存，可随时重裁',
  'aqua.cropReset': '重置',
  'aqua.cropCancel': '取消',
  'aqua.cropApply': '应用',
  'aqua.cropZoom': '缩放',
  'aqua.cropUnsupported': '当前宿主不支持保存裁剪（需 v1.4.0 及以上的 /aqua-wallpaper 路由），请重启 dsh web 后重试',
} satisfies Record<string, string>

export type AquaLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Aqua settings row's copy. */
    'settings.aqua': AquaLocaleKey
  }
}

/** English dictionary. */
export const en = {
  'aqua.title': 'Glass theme',
  'aqua.description': 'Global glassmorphism with mica/compatibility modes — blur, frost, backdrop, and color all adjustable',
  'aqua.enable': 'On',
  'aqua.disable': 'Off',
  'aqua.expand': 'Show settings',
  'aqua.collapse': 'Hide settings',
  'aqua.disabledHint': 'Turn the glass theme on first, then tune the effects',
  'aqua.mode': 'Mode',
  'aqua.modeMica': 'Mica',
  'aqua.modeCompat': 'Compatibility',
  'aqua.modeHint': 'Compatibility keeps the stock layout and only swaps the material to glass — other plugins\' UI turns glass too',
  'aqua.whale': 'Particle whale',
  'aqua.critters': 'Fish',
  'aqua.blur': 'Glass blur',
  'aqua.frost': 'Frost',
  'aqua.fluidHue': 'Fluid color',
  'aqua.bgBrightness': 'Background brightness',
  'aqua.bgBrightnessHintDark': 'Dark mode: 0 fades to pure black, 50 is unchanged',
  'aqua.bgBrightnessHintLight': 'Light mode: 50 is unchanged, 100 brightens to pure white',
  'aqua.background': 'Backdrop',
  'aqua.backgroundFluid': 'Fluid',
  'aqua.backgroundWallpaper': 'Wallpaper',
  'aqua.wallpaper': 'Wallpaper',
  'aqua.wallpaperHint': 'Use light mode for light wallpapers, dark mode for dark wallpapers ⚠️',
  'aqua.chooseWallpaper': 'Choose image',
  'aqua.deleteWallpaper': 'Delete',
  'aqua.wallpaperBlur': 'Wallpaper blur',
  'aqua.wallpaperFrost': 'Wallpaper frost',
  'aqua.wallpaperFit': 'Wallpaper fit',
  'aqua.wallpaperFitCover': 'Fill',
  'aqua.wallpaperFitContain': 'Fit',
  'aqua.wallpaperFitFill': 'Stretch',
  'aqua.wallpaperFitHint': 'Crop first to frame the image to the screen ratio; uncropped: Fit shows it whole, Fill crops to cover, Stretch distorts',
  'aqua.wallpaperScale': 'Wallpaper zoom',
  'aqua.wallpaperPosX': 'Horizontal position',
  'aqua.wallpaperPosY': 'Vertical position',
  'aqua.cropWallpaper': 'Crop',
  'aqua.cropTitle': 'Crop wallpaper',
  'aqua.cropHint': 'Drag to recompose, wheel or slider to zoom; the frame is exactly what the screen shows — applied losslessly at original resolution, re-crop anytime',
  'aqua.cropReset': 'Reset',
  'aqua.cropCancel': 'Cancel',
  'aqua.cropApply': 'Apply',
  'aqua.cropZoom': 'Zoom',
  'aqua.cropUnsupported': 'This host cannot save crops (needs the v1.4.0+ /aqua-wallpaper route) — restart dsh web and retry',
} satisfies Record<AquaLocaleKey, string>
