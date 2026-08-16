# @deepseek-ai/dsh-client-ui-aqua

English | [中文](README.zh.md)

Aqua is a highly customizable glassmorphism theme with a multi-pet desktop companion for the DeepSeek Harness web UI. The header, sidebar, composer, stats line, and trajectory view all become panes of frosted glass, while a switchable pet (Eason first) lives in the corner. Switch it off and the stock UI comes back exactly, with no source changes to DSH itself.

![](assets/1.png)

![](assets/2.png)

![](assets/3.png)

![](assets/4.png)

## Features

- **Two modes**: **Mica** restyles the layout into floating glass cards (blur and frost adjustable), while **Compatibility Mode** keeps the stock layout byte-for-byte and only swaps the material to generic glass — other plugins' UI gets the same treatment automatically
- **Free backdrop**: a living fluid board (hue adjustable) or your own wallpaper — stored **losslessly** on the host side (`/aqua-wallpaper` route: no downscale, no re-encode; hosts without the route fall back to local compression), with an **interactive crop editor** (drag to recompose, wheel/slider to zoom, the frame matches the screen ratio exactly, applied losslessly at original resolution — re-crop anytime) plus fit mode (crop-fill / fit / stretch), zoom, horizontal/vertical position, blur, and frost; light wallpapers look best in light mode, dark wallpapers in dark mode
- **Background brightness**: follows the resolved scheme — dark mode darkens (0–50), light mode brightens (50–100), 50 is unchanged
- **Particle whale**: the deepseek.com/harness centerpiece fish (a 2D port of the site's particle engine), centered in the chat area right of the sidebar — white particles on dark, gray on light, toggleable in settings
- **Glossy "Harness" badge**: in dark mode the sidebar wordmark wears the official nameplate pill (135° gradient ring + soft glow); light mode keeps the stock plate
- **Edge fades**: 5px gradient blur bands pinned to the top and bottom of the page, above the chat content — scrolling content melts into the edges; faint white veil on light, faint black on dark
- **Multi-pet desktop companion**: 18 Eason-only transparent animations (concert, coding, daily life), idle breathing, a random-act chain, click/drag interaction, and an optional roaming mode — **independent of the theme master switch**; switch characters in Settings → Pet
- One switch: off restores the stock UI exactly, and every effect is removed with the plugin

## Installation

### Windows (one command)

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/WYH66666666/DSH-Transparent-UI-Plugin/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

Installs the **latest release** by default. No git needed — the installer falls back to a plain zip download. It links the plugin into the profile's `node_modules` and registers `ui-aqua` in `cordis.patch.yml` (idempotent — safe to run again). Reload the web UI and it is on.

Pin a version or track the dev branch:

```powershell
.\install.ps1 -Version 'v1.1.0'   # a specific release
.\install.ps1 -Version 'main'     # the development branch
```

### macOS / Linux (manual, three steps)

```sh
git clone --depth 1 --branch v1.1.0 https://github.com/WYH66666666/DSH-Transparent-UI-Plugin.git
ln -s "$PWD/DSH" "$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-client-ui-aqua"
```

then append to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: ui-aqua
      name: '@deepseek-ai/dsh-client-ui-aqua'
```

## Usage

Reload the web UI. Aqua is **on by default**; the master switch lives in **Settings → Plugins → Glass theme** (same shape as the other plugin cards). The card carries a **Show settings** collapse area (the same expand/collapse language as the other plugin cards) holding every control: mode, blur/frost (Mica mode), fluid color, background brightness, backdrop (fluid/wallpaper) with its wallpaper controls, and the whale/critters toggles. With the master switch off the area collapses and cannot be expanded — **the General settings stay stock**, with no theme controls mixed in.

## Desktop pet (multi-pet)

The pet is **independent of the theme master switch** — turn the glass off and the pet keeps living. Its page sits at the bottom of the settings navigation, **Settings → Pet**:

| Setting | Effect |
|---|---|
| Show pet | Hides the pet and stops all video decoding; other settings survive |
| Current pet | Character dropdown (shown when several pet packs are installed); the pet's right-click menu also offers quick switching |
| Roaming mode | The pet randomly gets up and walks (also in the right-click menu) |
| Size | Display height slider, 160–420px, live preview |
| Default corner | Bottom-right or bottom-left dock when not dragged/roaming |
| Reset position | Sends the pet back to its corner immediately |

Settings persist in localStorage (keys `aqua-pet.*`); migrating from the standalone eason-pet plugin adopts your old size/corner/roaming/hidden choices automatically.

### Adding a pet (no code changes)

A pet is a directory; the contract lives in [`assets/pets/pet.schema.md`](assets/pets/pet.schema.md):

1. Prepare the assets: idle ×1, turn ×1, acts ×10+, click responses ×2, drag ×1, walks ×2 (WebM VP9 `yuva420p` with alpha, real ≥20fps, one character, consistent feet line — the `dsh-pet-from-image` skill can generate a pack from a master image)
2. Create `assets/pets/<new-pet>/` with a `pet.json` (catalog + canvas metrics) and `thumb/*.webm`
3. Pass `node scripts/check-pets.mjs`, restart `dsh web`, then switch in Settings → Pet → Current pet

Or keep the package untouched: drop pet directories into `$DSH_HOME/aqua-pets/` (original 1200×1200 masters go in that directory's `full/`, served at `/aqua-pet/<petId>/full/<file>.webm`).

### Routes

The node half registers two prefix routes:

- `/aqua-pet`: `manifest.json` (pet list), `<petId>/thumb/<file>` (360px playback variant, memory-cached and warmed at startup), `<petId>/full/<file>` (original master, uncached)
- `/aqua-wallpaper`: `current` (adoption probe, includes `originalUrl`), `img` (GET the displayed image / PUT upload originals ≤40MB / DELETE remove), `original` (GET the untouched upload — the crop editor's source), `cropped` (PUT the crop result, display file only); files live at `$DSH_HOME/aqua-wallpaper/` (`original.<ext>` + `wallpaper.<ext>`)
