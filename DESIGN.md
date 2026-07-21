# Design — mdx-vault

> **Editorial newspaper.** App được thiết kế như một tờ báo in: giấy ấm, mực đen,
> viền cứng 2px, shadow offset, ba kiểu chữ tách bạch (Playfair / Lora / Courier Prime).
> Note là bài báo — markdown là văn xuôi, islands là sidebar widget. Đỏ nhấn, xanh chứng minh.

Đây là nguồn tham chiếu **system style** cho UI của mdx-vault. Token thật thi hành nằm ở `src/renderer/src/globals.css` (`@theme inline` + CSS custom properties); file này là hợp đồng định nghĩa vì sao các token đó có giá trị đó. Khi conflict giữa mô tả ở đây và `globals.css` → `globals.css` là source of truth, cập nhật file này cho khớp.

## Nguyên tắc

- **In giấy, không phải glass.** Surface phẳng, không gradient, không blur ngoại trừ nơi cấu trúc yêu cầu (overlay scrim). Đường kẻ (`border`) là device cấu trúc chính — viền 2px mực đen ranh giới section.
- **Hai giọng chữ (writing voice vs reading voice).** Editor = mono "writing voice" (Courier Prime); preview `.mdx-preview` = serif "reading voice" (Lora body, Playfair headline). Sự tách bạch này có chủ đích, không phải lỗi.
- **Đỏ nhấn, không đỏ nền.** `--editorial-red` (#d32f2f) dùng cho accent, focus, miss, destructive. Không bao giờ làm surface lớn. Xanh `--editorial-blue` (#2b5797) = success / hit / result — màu "bằng chứng".
- **Sharp corners (radius 0).** Card, button, dialog, input đều `rounded-none`. Slider thumb, checkbox, dot marker là control hình học riêng — vẫn giữ round. Radius 0 = newspaper in giấy, không phải mobile card.
- **Offset hard shadow.** `box-shadow: 4px 4px 0 var(--foreground)`. Không blur. Shadow là device nhấn mạnh sự hiện diện của widget trên giấy, không phải elevation.material.
- **Local-first → self-host font.** Font serve từ `'self'` qua `@fontsource/*`, không CDN, không relax CSP. Offline OK.

## Bảng màu

### Light — "Warm paper edition"

| Token                  | Giá trị                | Vai trò                                          |
| ---------------------- | ---------------------- | ------------------------------------------------ |
| `--background`         | `#f9f9f7`              | Paper — surface chính, ấm chứ không phải zinc    |
| `--paper-dark`         | `#efefea`              | Paper tối — sidebar section, table zebra, hover  |
| `--foreground`         | `#111111`              | Ink — text, border chính, masthead bg            |
| `--card`               | `#ffffff`              | Card bề mặt sáng hơn paper                       |
| `--primary`            | `#111111`              | Default button = ink (chữ trắng trên đen)        |
| `--primary-foreground` | `#f9f9f7`              | Text trên primary                                |
| `--muted`              | `#efefea`              | Muted surface                                    |
| `--muted-foreground`   | `oklch(0.50 0.009 95)` | Text thứ cấp                                     |
| `--accent`             | `#efefea`              | Hover bg (shadcn semantic)                       |
| `--destructive`        | `#d32f2f`              | **Editorial red** — destructive / warning / miss |
| `--editorial-red`      | `#d32f2f`              | Alias rõ ràng cho red                            |
| `--editorial-blue`     | `#2b5797`              | **Result blue** — success / hit / resolved link  |
| `--success`            | `#2b5797`              | Alias cho blue (semantic)                        |
| `--success-foreground` | `#ffffff`              | Text trên success                                |
| `--border`             | `#111111`              | **Border mặc định = ink** — load-bearing line    |
| `--line`               | `#cccccc`              | Subtle divider (zebra row, dashed)               |
| `--ring`               | `#d32f2f`              | Focus ring = red                                 |
| `--radius`             | `0`                    | Sharp toàn bộ                                    |
| `--shadow-hard`        | `4px 4px 0 #111`       | Offset shadow cho widget/dialog                  |
| `--shadow-hard-sm`     | `2px 2px 0 #111`       | Offset shadow cho button                         |

### Dark — "Tonight's edition"

Dark không phải "tối hơn" — là **tờ báo buổi tối**, cùng grammar nhưng inverted:

| Token              | Giá trị                | Ghi chú                                    |
| ------------------ | ---------------------- | ------------------------------------------ |
| `--background`     | `oklch(0.18 0.005 60)` | Warm-graphite, ấm không phải dead terminal |
| `--foreground`     | `oklch(0.93 0.005 80)` | Warm off-white                             |
| `--card`           | `oklch(0.21 0.006 60)` | Card sáng hơn paper một bậc                |
| `--muted`          | `oklch(0.25 0.006 60)` |                                            |
| `--border`         | `var(--foreground)`    | **Line inverted** — paper-color trên dark  |
| `--editorial-red`  | `#ef5350`              | Lighten để contrast trên dark              |
| `--editorial-blue` | `#5b9bd5`              | Lighten để contrast                        |
| `--destructive`    | `#ef5350`              | Theo editorial-red                         |
| `--ring`           | `#ef5350`              |                                            |

## Typography

| Việc                | Font                                     | Weights   | Size cơ sở           |
| ------------------- | ---------------------------------------- | --------- | -------------------- |
| Body (UI + prose)   | Lora (`var(--font-sans)`)                | 400, 400i | 1rem / 1.85 LH       |
| Headline (H1/H2)    | Playfair Display (`var(--font-display)`) | 700, 900  | H1 2.5rem, H2 1.7rem |
| Mono / UI label     | Courier Prime (`var(--font-mono)`)       | 400, 700  | 0.7–0.85rem          |
| Editor (CodeMirror) | Courier Prime                            | 400, 700  | 13.5px / 1.7 LH      |

**Quy ước UI label**: metadata, eyebrow, section header, status chip = Courier Prime uppercase + letter-spacing 1–2px. Đây là dấu hiệu nhận biết editorial (xem `.subtitle`, `.widget-head`, masthead brand).

**Quy ước prose** (`.mdx-preview`):

- Body Lora 1rem, line-height 1.85, color `#222`
- H1 Playfair 900, border-bottom 2px ink
- H2 Playfair 700, border-top 2px ink, scroll-margin-top cho anchor link
- Inline code = Courier Prime, **inverted** (black bg, paper text) — "machine in prose"
- Pre = Courier Prime, border 2px ink, offset shadow `3px 3px 0 ink`
- List marker = square dash đỏ (không phải bullet tròn)
- Link = xanh `--editorial-blue`, underline 40% mix
- Table = Courier Prime uppercase header (black bg + paper text), ink cell border, zebra `--paper-dark`

## Border & shadow

| Việc             | Recipe                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Card / widget    | `border-2 border-foreground rounded-none shadow-[3px_3px_0_0_var(--foreground)]`                                            |
| Dialog / overlay | `border-2 border-foreground rounded-none shadow-[4px_4px_0_0_var(--foreground)]`                                            |
| Button outline   | `border-2 border-foreground bg-background shadow-[2px_2px_0_0_var(--foreground)] hover:bg-foreground hover:text-background` |
| Section divider  | `border-b-2 border-foreground` (không dùng 1px)                                                                             |
| Subtle divider   | `border-b border-[var(--line)]` (dashed/zebra context)                                                                      |
| Focus ring       | `outline-2 outline-var(--ring)` hoặc `ring-[3px] ring-[color-mix(...)]`                                                     |

## Phân vùng layout

```
┌─────────────── MASTHEAD (sticky, bg ink, h-11) ───────────────┐
│ BRAND · vault name ................... [toolbar buttons]      │
├──────────┬───────────────────────┬───────────────────┬────────┤
│ SIDEBAR  │ EDITOR (CodeMirror)   │ PREVIEW (.mdx-    │ AI     │
│ bg paper │ Courier Prime         │  preview) Lora +  │ panel  │
│ border-2 │ border-r-2            │  Playfair         │        │
│          │                       │ border-r-2        │        │
└──────────┴───────────────────────┴───────────────────┴────────┘
```

- Mỗi pane cách nhau bằng `border-r-2 border-foreground` (đường kẻ mực rõ ràng, không phải hairline)
- Pane header (`h-9 border-b`) chứa Courier Prime uppercase label
- Masthead **sticky top-0 z-50**, luôn biết đang ở note nào

### Workbench interaction grammar

- **Visual order khác MRU order.** Tab strip luôn giữ vị trí thị giác ổn định; Left/Right/Home/End đi theo strip. `Ctrl/Cmd+Tab` mở switcher gọn theo lịch sử sử dụng, chỉ commit item khi thả modifier/Enter; Escape giữ nguyên document gốc.
- **Tab state phải đọc được bằng mắt lẫn assistive tech.** Dirty dùng marker riêng, missing dùng label gạch + trạng thái “File deleted”, active/focused là hai state khác nhau. Các file trùng basename luôn kèm directory để phân biệt; icon/kind không được là tín hiệu duy nhất.
- **Pointer và keyboard tương đương.** Click activate, nút close hoặc middle-click close. Tablist dùng một roving tab stop; Enter/Space activate, Delete close, và focus sau close chuyển tới một tab còn tồn tại hoặc document surface — không để lại focus trên DOM đã bị gỡ.
- **Picker là command ledger, không phải form rời rạc.** File Finder, Command Palette và MRU switcher dùng cùng row grammar: query/header rõ, selected row có contrast + active-descendant, secondary path/shortcut thẳng cột, recent/open state có label chữ. Up/Down chọn, Enter commit, Escape/backdrop cancel; row được chọn luôn scroll vào view.
- **Overlay có một owner.** Chỉ một global picker/settings surface nhận shortcut tại một thời điểm; scrim được phép vì nó biểu diễn ownership. Cancel restore invoking control nếu còn hợp lệ, successful navigation focus document. Dialog xác nhận nằm trên surface bị suspend và chặn mọi mutation phía sau.
- **Settings giữ editorial system.** Sidebar category + searchable content cho General, Editor, Workbench và Keymap; mỗi row có label, mô tả, control/reset cùng baseline. Keymap chip hiển thị chord, conflict replacement phải explicit, recorder có focus ring rõ và không bắt phím chỉnh sửa ở background.

## Component vocabulary

- **`.mdx-preview`** — prose surface (xem `src/renderer/src/globals.css:159`). Đây là nơi editorial style đậm nhất.
- **Island wrapper** — `<Counter>`, `<QuizBlock>`, `<EquationSlider>`, `<DataChart>`, `<AlgorithmVisualizer>`, `<SandboxHost>` đều chia chung recipe: `border-2 border-foreground rounded-none shadow-[3px_3px_0_0_var(--foreground)]`, header Courier Prime uppercase.
- **Interactive iframe** — content bên trong iframe sandbox **không inherit** CSS của app (cố ý, vì lý do security + component isolation). Mỗi interactive file `interactives/*/index.html` có inline `<style>` riêng. Outer wrapper (host) thì theo editorial.
- **Button** — `default` (ink), `outline` (paper + offset shadow + hover invert), `destructive` (red), `success` (blue), `ghost` (hover only).

## Semantic color mapping

App dùng tight palette (đỏ + xanh + đen), không dùng Tailwind palette mở rộng (amber/emerald/rose) cho feedback:

| Semantic                     | Token                                 | Khi nào                                                  |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------- |
| Destructive / Warning / Miss | `--destructive` (`--editorial-red`)   | Error, validation warning, diff remove, miss, quiz wrong |
| Success / Hit / Result       | `--success` (`--editorial-blue`)      | Save OK, diff add, hit, quiz correct, resolved link      |
| Neutral / Info               | `--foreground` / `--muted-foreground` | Default text, info chip                                  |

## Out of scope

- **Iframe sandbox content** (`example-vault/interactives/*.html`) — có inline style riêng theo chủ đích. Nếu muốn đồng bộ style vào interactive, inject stylesheet qua `createSandboxHtmlDocument` (xem `docs/security.md`).
- **Dead code** `src/renderer/src/assets/{base.css,main.css}` — unused Electron scaffold, không trong build.

## Tham chiếu

| File                                     | Vai trò                                       |
| ---------------------------------------- | --------------------------------------------- |
| `src/renderer/src/globals.css`           | Source of truth — token, `.mdx-preview`, base |
| `components.json`                        | shadcn config (new-york, neutral, var-based)  |
| `src/renderer/index.html`                | CSP (font serve từ `'self'`)                  |
| `src/renderer/src/main.tsx`              | Import `@fontsource/*` (self-host font)       |
| `src/renderer/src/editor/MdxEditor.tsx`  | CodeMirror theme riêng (writing voice)        |
| [docs/tech-stack.md](docs/tech-stack.md) | UI section liệt kê Tailwind/shadcn/CodeMirror |
