<div align="center">

# Movie2Ansi

**Turns a video into ASCII/ANSI art, once, and plays it back in a terminal or on a web page.**

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![Web Components](https://img.shields.io/badge/Web_Components-29ABE2?style=for-the-badge&logo=webcomponentsdotorg&logoColor=white)](https://developer.mozilla.org/docs/Web/API/Web_components)

[![Binaries](https://img.shields.io/badge/binaries-linux_%C2%B7_macOS-16A34A?style=for-the-badge)](#1-download)
[![Player](https://img.shields.io/badge/ansi--player-10.6_KB-C7205B?style=for-the-badge)](#play-it-on-a-web-page)
[![License](https://img.shields.io/badge/license-Unlicense-111827?style=for-the-badge)](LICENSE)

</div>

## What it is

Play in your terminal, or put it on a web page with one `<ansi-player>` tag. Nothing runs in the cloud, nothing is uploaded.

There are two programs and one web component:

- **`m2a-encode`** converts a video into an `.m2a` file.
- **`m2a-play`** plays an `.m2a` file in the terminal.
- **`ansi-player.js`** plays an `.m2a` file on a web page.

## Quick start

### 1. Download

Open the **Releases** page of this repository and take the files for your system.

| System                | Files                                                            |
| --------------------- | ---------------------------------------------------------------- |
| Linux, 64-bit         | `m2a-encode-linux-x64.tar.gz`, `m2a-play-linux-x64.tar.gz`       |
| Linux, ARM            | `m2a-encode-linux-arm64.tar.gz`, `m2a-play-linux-arm64.tar.gz`   |
| macOS, Intel          | `m2a-encode-darwin-x64.tar.gz`, `m2a-play-darwin-x64.tar.gz`     |
| macOS, Apple Silicon  | `m2a-encode-darwin-arm64.tar.gz`, `m2a-play-darwin-arm64.tar.gz` |

The binaries are in releases tagged `bin-v…`, the web component in releases tagged `player-v…`.

Unpack and give the files short names (Linux x64 shown, change the suffix for your system):

```bash
tar -xzf m2a-encode-linux-x64.tar.gz
tar -xzf m2a-play-linux-x64.tar.gz
mv m2a-encode-linux-x64 m2a-encode
mv m2a-play-linux-x64 m2a-play
```

Optional: check the download with `sha256sum -c SHA256SUMS --ignore-missing` (the `SHA256SUMS` file is in the same release).

On macOS the first launch may be blocked because the files are not signed. Allow them once:

```bash
xattr -d com.apple.quarantine m2a-encode m2a-play
```

### 2. Install ffmpeg

`m2a-encode` reads videos with [ffmpeg](https://ffmpeg.org), which must be installed and available as `ffmpeg` and
`ffprobe`:

```bash
sudo apt install ffmpeg         # Debian, Ubuntu
sudo pacman -S ffmpeg           # Arch, Manjaro
brew install ffmpeg             # macOS
```

`m2a-play` and the web component do not need it.

### 3. Create a config

Create a file named `encode.toml` next to the program. Only `inputPath` is required. Start from the
[**example config**](encode.toml), which lists every option with its default and a short comment:

```toml
inputPath  = "/path/to/video.mp4"   # a file path, file://… or http(s)://…
outputPath = "out/video.m2a"        # where the result goes; folders are created
cellAspect = 0.5                    # 0.5 for the terminal, 1 for web pages
```

If your editor supports it, point it at [`encode.schema.json`](encode.schema.json) to get completion and
validation.

### 4. Convert

```bash
./m2a-encode -c encode.toml
```

```
800x1080 -> 80x54, 212 frames, 262780 lit cells -> out/video.m2a (0.4 MB)
```

### 5. Play

In the terminal:

```bash
./m2a-play out/video.m2a        # add -l to loop
```

The picture is as many characters wide and tall as the grid printed by the encoder (`80x54` above). If your terminal
is smaller, `m2a-play` says so: make the window bigger, shrink the font, or convert again with a smaller
`pixelSizeFactor`.

### Play it on a web page

Download `ansi-player.js` from a `player-v…` release, put it next to your page together with the `.m2a` file, and add:

```html
<script type="module" src="ansi-player.js"></script>
<ansi-player src="video.m2a" controls autoplay loop></ansi-player>
```

Convert with `cellAspect = 1` for the web, so the cells are square.

| Attribute    | What it does                                                        |
| ------------ | ------------------------------------------------------------------- |
| `src`        | address of the `.m2a` file; shows `NO SIGNAL` until a file is loaded |
| `controls`   | play/pause button, seek bar, time and fullscreen                    |
| `autoplay`   | starts as soon as the file is loaded                                |
| `loop`       | starts over at the end                                              |
| `show-fps`   | shows how many frames per second are really drawn, in the corner    |
| `cell-width` | width of one cell in pixels                                         |

The file has to come from the same site, or from a server that allows it (CORS), and the page has to be served over
`http(s)://`, not opened as a plain file. The element works like a video tag: `play()`, `pause()`, `currentTime`,
`duration` and the usual events.

## Settings you will want to change

All of them live in `encode.toml`.

| Key               | What it does                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `fps`             | frames per second of the result; lower is smaller                                                |
| `cellAspect`      | `0.5` for the terminal (cells are about twice as tall as wide), `1` for web pages                |
| `look.pixelSizeFactor` | how many characters fit along the shorter side of the video: more is sharper, but needs a bigger terminal |
| `contrast`        | ffmpeg contrast: `1` is unchanged, `1.3`–`2` makes silhouettes sharper                            |
| `gamma`           | ffmpeg gamma: above `1` brightens midtones, below `1` darkens them                                |
| `look.threshold`  | how bright a spot must be to get a character                                                     |
| `look.fontColor`, `look.fontColor2`, `look.backgroundColor` | colors of the characters and the background           |
| `look.invert`     | draw characters in dark areas instead of bright ones                                             |
| `luminanceStep`, `deadband` | make the file smaller and calm flickering: try `8` and `6`                             |
| `seed`            | the same seed gives the same random characters every time                                        |

## Building from source

Needs [Bun](https://bun.com).

```bash
bun install
bun run encode                  # the same as m2a-encode -c encode.toml
bun run play                    # the same as m2a-play
bun run build:bin               # all binaries into dist/bin
bun run build:player            # dist/ansi-player.js
bun run dev                     # a test page that converts a video right in the browser
```

Notes on how it works are in [`docs/encoder.md`](docs/encoder.md) (in Russian).

## License

Public domain under the [Unlicense](LICENSE): copy, modify, publish and sell it, with or without attribution.
