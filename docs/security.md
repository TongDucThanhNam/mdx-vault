# Security Model — mdx-vault

> Bất biến của dự án. Mọi goal đều phải tuân theo. Nếu một feature mâu thuẫn với file này → feature sai, không phải file này sai.

## Nguyên tắc gốc

**MDX/HTML interactive biến document thành code.** `@mdx-js/mdx` compile MDX thành JavaScript; `evaluate()` thực sự eval JS. Note có thể chứa code do AI, user khác, hoặc plugin sinh ra. Vì vậy:

> User được tạo code bằng AI, nhưng app không được tin code đó tuyệt đối.

Non-coder không đọc được code để biết nó nguy hiểm → app phải có seatbelt mặc định.

## Trust levels

| Level | Nội dung                                                                     | Cách render                                                                                                  |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **0** | Plain Markdown / static MDX (không JS, không dynamic component)              | Render trực tiếp                                                                                             |
| **1** | Safe HTML / safe SVG                                                         | `rehype-sanitize`: strip script, inline event handler, `javascript:` URL; không external network mặc định    |
| **2** | Trusted React components (built-in registry của app)                         | Render trong preview renderer, props validate bằng zod schema                                                |
| **3** | Vault custom components (user viết / AI generate, nằm trong `interactives/`) | Cần explicit trust từ user; compile riêng (esbuild); có `manifest.json`; dependency theo allowlist           |
| **4** | Arbitrary HTML/CSS/JS                                                        | LUÔN chạy trong iframe sandbox; giao tiếp qua postMessage; permission theo manifest; không có quyền mặc định |

Mặc định cho AI-generated code: Level 3 với permission hẹp, hoặc Level 4.

## Electron hardening (bắt buộc, làm từ Goal 01)

```ts
new BrowserWindow({
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true, // template mặc định để false — PHẢI bật lại
    webSecurity: true
  }
})
```

- Content Security Policy cho renderer (meta tag hoặc `session.defaultSession.webRequest`): không `unsafe-eval` ở renderer chính nếu tránh được; nếu MDX evaluate cần `unsafe-eval`, giới hạn scope và ghi rõ trade-off trong code.
- `setWindowOpenHandler` → deny + `shell.openExternal` cho link ngoài (template đã có, giữ nguyên).
- Validate `event.senderFrame` trong IPC handler nếu app có nhiều frame.
- Không bao giờ `enableRemoteModule`, không load remote URL vào window chính.

## Filesystem

- Mọi path từ renderer đi qua `safeJoin(vaultRoot, relativePath)`:

```ts
export function safeJoin(root: string, relativePath: string): string {
  const target = resolve(root, relativePath)
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path escapes vault root')
  return target
}
```

- Renderer chỉ biết relative path. Absolute path không rời khỏi main process.
- Ghi file: write-then-rename (atomic) để không corrupt note khi crash.

## Sandbox islands (Level 4 — Goal 05)

- `<iframe sandbox="allow-scripts">` — KHÔNG `allow-same-origin` (nếu cần same-origin cho blob URL, dùng origin riêng biệt).
- Nội dung load qua blob/data URL hoặc custom protocol readonly, không qua `file://` của vault.
- CSP trong sandbox document: `default-src 'none'` + chỉ mở thứ manifest cho phép.
- postMessage RPC: validate message schema bằng zod cả hai chiều; kiểm tra `event.origin`/`event.source`.
- Permission manifest quyết định: network (mặc định false), đọc dataset từ vault (mặc định false, cấp theo file), storage (mặc định false).

## manifest.json cho custom component

```json
{
  "name": "BayesSimulator",
  "version": "1.0.0",
  "runtime": "react",
  "permissions": { "network": false, "filesystem": false },
  "propsSchema": { "prior": "number", "sensitivity": "number", "specificity": "number" },
  "dependencies": {},
  "fallback": "./fallback.png"
}
```

- Dependencies ngoài allowlist (react, d3, ... — danh sách cụ thể quyết định ở Goal 05) → từ chối compile.
- Component không có manifest → chỉ được chạy như Level 4.

## AI-generated code

- AI không có quyền ghi file trực tiếp — chỉ trả patch, user approve.
- Pipeline bắt buộc: generate → compile (typecheck) → lint → test đơn giản (mount được, props hợp lệ, không import ngoài allowlist, không gọi API cấm) → preview trong sandbox → repair loop → approve → lưu.
- Lưu provenance: prompt/source/context tạo ra component (trong manifest hoặc file cạnh nó).

## Known risks đã ghi nhận

- MDX maintainer cảnh báo: evaluate MDX từ nguồn không tin cậy = evaluate JS không tin cậy.
- CVE tồn tại quanh compile/render untrusted MDX (vd GHSA-g4xw-jxrg-5f6m với next-mdx-remote). Không dùng pattern "render MDX từ nguồn ngoài" mà không qua trust model ở trên.
