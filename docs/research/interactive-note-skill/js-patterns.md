# JS Patterns — Format B

Không framework, không lib ngoài, không localStorage. State = object thuần;
render() = pure function chỉ đọc state → cập nhật DOM.

## Pattern GATE — prediction gate (widget có outcome rời rạc)

HTML: controls khởi tạo `disabled`. Status flow: LOCKED → READY → RUNNING → DONE.

```javascript
const W = { prediction: null /*, ...state widget... */ };

document.querySelectorAll('#w1-gate .gate-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (W.prediction !== null) return;          // commit MỘT LẦN — không cho đổi
    W.prediction = b.dataset.pred;
    b.classList.add('chosen');
    [btnPlay, btnStep, btnReset].forEach(x => x.disabled = false);
    statusEl.textContent = 'READY';
  });
});

function finish() {                              // gọi khi simulation chạy hết
  const actual = /* tính từ state, ví dụ Math.round(100*hits/total) */;
  const v = document.getElementById('w1-verdict');
  const correct = (W.prediction === String(actual));
  v.innerHTML = correct
    ? `Bạn đoán <span class="right">${W.prediction}%</span> — thực tế: <span class="right">${actual}%</span>. Model của bạn đã đúng.`
    : `Bạn đoán <span class="wrong">${W.prediction}%</span> — thực tế: <span class="right">${actual}%</span>. Khoảng lệch này là chỗ mental model cũ khác cơ chế thật — ghi con số này vào note.`;
  v.classList.add('show');
}
```

## Pattern STEP — step-through simulation (trình tự nhiều bước)

```javascript
const S = { order: [], pos: 0, hits: 0, misses: 0,
            timer: null, playing: false, history: [] };

function step() {
  if (S.pos >= S.order.length) return;
  // xử lý đúng 1 bước: cập nhật hits/misses/history từ S.order[S.pos]
  S.pos++; render();
  if (S.pos >= S.order.length) finishStep();
}
function play() {
  if (S.playing || S.pos >= S.order.length) return;
  S.playing = true; statusEl.textContent = 'RUNNING';
  S.timer = setInterval(step, 380);
}
function resetSim() {
  clearInterval(S.timer); S.playing = false;
  S.pos = 0; S.hits = 0; S.misses = 0; S.history = [];
  render();
}
function finishStep() {
  clearInterval(S.timer); S.playing = false;
  statusEl.textContent = 'DONE';
  finish();                                      // nối vào Pattern GATE nếu có
}
```

Sau khi viết xong: TỰ TRACE 3–5 bước đầu bằng tay, so với con số kỳ vọng
trong plan.md (ví dụ: row-major 4×4, line=4 → miss ở bước 1,5,9,13).

## Pattern PARAM — slider explorer (honor-system, không gate cứng)

```javascript
slider.addEventListener('input', () => {
  state.x = STEPS[+slider.value];               // map slider → giá trị rời rạc
  dispEl.textContent = state.x;
  render();
});
render();                                        // render ngay khi load
```
Caption BẮT BUỘC: "tự dự đoán ... trước khi kéo". Đoạn tổng kết/công thức
đặt SAU widget (recap hợp lệ với honor-system).

## Pattern REVEAL — self-test

```html
<button class="lab-btn"
  onclick="this.closest('.q-item').querySelector('.q-answer').classList.toggle('show')">
  Reveal</button>
```

## Bẫy đã gặp trong thực chiến

1. Guard re-render: `if (state.current === n) return;` — và nhớ force lần
   init đầu nếu dùng guard.
2. `setInterval` phải `clearInterval` ở MỌI đường ra (reset, finish, đổi mode).
3. Đổi mode/toggle giữa chừng → reset simulation state, GIỮ prediction
   (gate commit một lần cho cả widget, không reset theo mode).
4. Verdict chỉ hiện ở lượt chạy đúng chế độ mà gate hỏi (ví dụ gate hỏi
   col-major → chạy row-major xong không hiện verdict).
