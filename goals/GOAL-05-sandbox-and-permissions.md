# GOAL-05 — Sandbox islands + Permission model

> Agent thực thi: đọc file này + `AGENTS.md` + TOÀN BỘ `docs/security.md` trước. Đây là goal nhạy cảm nhất về security. Giả định GOAL-03 đã hoàn thành.

## Objective

Implement Trust Level 3 và 4: vault custom components (`interactives/` + manifest.json, compile bằng esbuild) và arbitrary HTML/JS — cả hai chạy trong iframe sandbox với postMessage RPC và permission manifest. Sau goal này, code do user/AI viết có chỗ chạy an toàn.

## Context

- **Lý do**: Đây là seatbelt bắt buộc trước khi AI được phép sinh component (GOAL-06). Sai ở đây = user non-coder chạy code độc hại với full quyền.
- **Ưu tiên**: security > tính năng > tốc độ. Khi phân vân, chọn phương án hẹp quyền hơn.
- **Ngày tạo**: 2026-07-03

## Current State

| Item          | Giá trị                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Render        | Level 0–2 hoàn chỉnh (GOAL-03); `<Interactive>`/`<SandboxedHTML>` chưa tồn tại |
| esbuild       | Đã có trong devDependencies                                                    |
| example-vault | [ước lượng] chưa có folder `interactives/` với nội dung thật                   |

## Target State

| Item                                                     | Giá trị                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<SandboxedHTML src="../interactives/foo/index.html" />` | Level 4: iframe `sandbox="allow-scripts"` (KHÔNG allow-same-origin), nội dung inject qua srcdoc/blob, CSP `default-src 'none'` + nới theo manifest                              |
| `<Interactive src="../interactives/bar" />`              | Level 3: main process compile `component.tsx` bằng esbuild (bundle, external theo allowlist), cache tại `.app/component-cache/`, render trong iframe sandbox có React runtime   |
| manifest.json                                            | Schema zod (xem docs/security.md): name, version, runtime, permissions{network, filesystem}, propsSchema, dependencies. Thiếu/không hợp lệ → từ chối chạy, hiện card giải thích |
| Dependency allowlist                                     | [ước lượng khởi điểm: react, react-dom — mở rộng có cân nhắc] import ngoài allowlist → compile fail với message rõ                                                              |
| postMessage RPC                                          | Protocol typed + zod hai chiều: init(props), resize(height), requestData(path) — chỉ trả khi manifest cho phép + safeJoin, error. Validate origin/source.                       |
| Trust flow                                               | Lần đầu chạy một interactive: dialog hiện permissions xin cấp → user Allow/Deny; quyết định lưu (per component + content hash) trong `.app/`; component đổi code → hỏi lại      |
| Permission mặc định                                      | network: false, filesystem: false. Iframe không thể fetch external trừ khi manifest khai + user đồng ý                                                                          |
| example-vault                                            | 1 sandboxed HTML demo (vd normal distribution bằng canvas thuần) + 1 React interactive demo có manifest                                                                         |

## Constraints

- [ ] Iframe: KHÔNG BAO GIỜ `allow-same-origin` cùng `allow-scripts` trên cùng origin với app
- [ ] Sandbox không có Node, không có `window.vaultApi`, không truy cập được contextBridge API — verify bằng test thủ công trong Success Criteria
- [ ] Mọi message RPC validate schema + nguồn; message lạ → drop + log, không throw ra UI
- [ ] Compile service chạy ở main process; renderer không bao giờ nhận raw path tuyệt đối
- [ ] KHÔNG dùng `webview` tag [cần xác nhận nếu thấy iframe không đủ — mặc định iframe]
- [ ] KHÔNG implement network permission passthrough trong goal này nếu phức tạp — được phép ship với network luôn-false, ghi rõ [ước lượng]
- [ ] KHÔNG đụng AI
- [ ] Blocker/nghi ngờ security → DỪNG và hỏi, mô tả threat model đang phân vân

## Success Criteria

- [ ] `bun run typecheck` && `bun run lint` pass
- [ ] Demo sandboxed HTML render và tương tác được trong note
- [ ] Demo React interactive (manifest hợp lệ) compile, render, nhận props từ note, resize theo nội dung
- [ ] Trong sandbox devtools: `window.vaultApi` undefined; `fetch('https://example.com')` bị chặn (CSP); `window.parent.document` throw (cross-origin/sandbox)
- [ ] Component import package ngoài allowlist → error card "dependency not allowed", không chạy
- [ ] Không có manifest / manifest sai schema → từ chối + card giải thích
- [ ] Lần đầu chạy → permission dialog; Deny → không chạy; Allow → chạy; sửa component.tsx → hỏi lại
- [ ] Sửa component.tsx → cache invalidate, bản mới được compile [kiểm bằng đổi UI thấy khác]

## Execution Plan

1. Viết threat model ngắn (10–15 dòng) vào đầu PR/báo cáo: kẻ tấn công là ai, chặn gì — đối chiếu docs/security.md
2. Iframe host component + srcdoc/blob loading + CSP + `<SandboxedHTML>` (Level 4 trước vì đơn giản hơn)
3. postMessage RPC layer (typed, zod, origin check) + auto-resize
4. manifest schema (zod) + trust store trong `.app/`
5. Permission dialog UI (shadcn AlertDialog)
6. esbuild compile service (main) + allowlist enforcement + cache theo content hash
7. `<Interactive>` host: load bundle vào sandbox có React runtime, truyền props
8. requestData RPC (đọc dataset qua manifest permission + safeJoin)
9. Demo content trong example-vault
10. Verify Success Criteria — làm ĐỦ các test security thủ công, báo cáo từng item

## Out of Scope

- AI generation/repair (GOAL-06)
- Network permission passthrough chi tiết (proxy, allowlist domain) — có thể để luôn-false
- Marketplace / cài interactive từ ngoài vault
- Hot reload cho interactive đang mở [nice-to-have]

## References

- `docs/security.md` — trust levels, sandbox rules, manifest schema
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- iframe sandbox: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
- esbuild build API: https://esbuild.github.io/api/

## Agent Instructions

1. Đọc toàn bộ file này + AGENTS.md + docs/security.md trước khi làm
2. Tuân theo Constraints tuyệt đối — đặc biệt các constraint iframe/origin
3. Execution Plan theo thứ tự, báo cáo sau mỗi bước
4. Conflict → ưu tiên Constraints; phân vân security → chọn phương án hẹp quyền hơn hoặc DỪNG hỏi
5. Khi xong: verify từng Success Criteria, bao gồm test security thủ công
