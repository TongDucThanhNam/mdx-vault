# Island Patterns — HTML sandbox islands

Island = folder trong `interactives/`: `index.html` tự chứa (runtime "html") + `manifest.json`.
Mẫu chuẩn trong vault: `interactives/hash-linear-probing/`, `interactives/cache-stride/`.

## Manifest bắt buộc

```json
{
  "name": "Tên Island",
  "version": "1.0.0",
  "runtime": "html",
  "permissions": { "network": false, "filesystem": false, "dataPaths": [] },
  "propsSchema": {},
  "dependencies": {}
}
```

## Design system trong island

CSS đầy đủ: copy nguyên khối từ `references/island-design.md` (extract tự động từ island mẫu — không tự chế). Palette tóm tắt: `--paper #f9f9f7`, `--ink #111`, `--accent #d32f2f`,
`--result #2b5797`, tint `#dce6f5`/`#f5d5d5`; font hệ monospace/serif fallback (island không
tải Google Fonts — sandbox chặn network). CẤM: gradient, border-radius, lib ngoài, localStorage, fetch.

## JS patterns (state thuần + render() pure)

### STEP — step-through simulation
```javascript
const S = { order: [], pos: 0, timer: null, playing: false };
function step() {
  if (S.pos >= S.order.length) return;
  // xử lý đúng 1 bước
  S.pos++; render();
  if (S.pos >= S.order.length) finish();
}
function play() { if (!S.playing) { S.playing = true; S.timer = setInterval(step, 380); } }
function resetSim() { clearInterval(S.timer); S.playing = false; S.pos = 0; render(); }
```
Controls tối thiểu: STEP / PLAY-PAUSE / RESET. Ô đang xử lý = accent, đã qua = tint, kết quả = result.

### PARAM — slider explorer
```javascript
slider.addEventListener('input', () => { state.x = STEPS[+slider.value]; render(); });
render(); // render ngay khi load
```
Caption BẮT BUỘC: "tự dự đoán ... trước khi kéo". Tổng kết đặt SAU widget trong note (Recap).

## Bẫy đã gặp thực chiến

1. **Sinh cả island một lần** → hỏng phần cuối. Build: HTML frame trước → CSS → JS theo pattern → mỗi phần một edit.
2. **Không tự trace** → logic sai mà demo vẫn "chạy". Bắt buộc: đi tay 3–5 bước đầu, so với con số kỳ vọng ghi trong plan.md (vd probe 6→7→0→1→2 = 5 bước).
3. **Simulation trả về con số benchmark** → vi phạm [W] vs [E]. Nếu màn hình island hiện con số hiệu năng, phải là minh họa model có ghi chú, không phải "kết quả đo".
4. **Kịch bản island lệch với câu hỏi gate** → gate hỏi một đằng sim chạy một nẻo. Island phải tái hiện được đúng kịch bản gate hỏi.
5. **Quên reduced-motion/aria** → island mẫu hash-linear-probing có sẵn cách xử lý, copy theo.

