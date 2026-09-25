# Island Design System — CSS chuẩn cho island mới

> KHÔNG viết tay file này. Nó được extract bằng lệnh từ island mẫu — bản chuẩn và docs không bao giờ drift.
> Khi island mẫu đổi theme, chạy lại từ root vault:
> `sed -n "/<style>/,/<\/style>/p" interactives/hash-linear-probing/index.html`
> rồi dán đè khối CSS dưới đây.

Copy nguyên khối vào `<style>` của island mới, chỉ thêm class riêng cho viz của bạn ở CUỐI:

```css
:root {
  --paper: #f9f9f7;
  --ink: #111111;
  --accent: #d32f2f;
  --accent-tint: #f3d7d7;
  --result: #2b5797;
  --rule: #c8c8c2;
  --muted: #666660;
}

*, *::before, *::after { box-sizing: border-box; }

html { font-size: 16px; }

body {
  background: var(--paper);
  color: var(--ink);
  font-family: "Courier Prime", ui-monospace, monospace;
  margin: 0 auto;
  max-width: 760px;
  padding: 1rem;
}

button, select { font: inherit; }

.eyebrow {
  color: var(--accent);
  font-size: .68rem;
  font-weight: 700;
  letter-spacing: .14em;
  margin: 0 0 .35rem;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(1.25rem, 4vw, 2rem);
  letter-spacing: -.04em;
  line-height: 1.05;
  margin: 0;
}

.lede {
  color: var(--muted);
  font-size: .84rem;
  line-height: 1.55;
  margin: .55rem 0 1rem;
  max-width: 68ch;
}

.control-grid {
  border-bottom: 2px solid var(--ink);
  border-top: 2px solid var(--ink);
  display: grid;
  gap: .75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: .75rem 0;
}

.field {
  display: grid;
  gap: .3rem;
}

.field-label {
  font-size: .64rem;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}

select {
  background: var(--paper);
  border: 2px solid var(--ink);
  color: var(--ink);
  min-height: 2.35rem;
  padding: .35rem .45rem;
  width: 100%;
}

select:disabled {
  color: var(--muted);
  opacity: .55;
}

button:focus-visible, select:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  font-size: .72rem;
  font-weight: 700;
  gap: .35rem 1rem;
  letter-spacing: .05em;
  padding: .75rem 0 .55rem;
  text-transform: uppercase;
}

.cell-grid {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
}

.cell {
  align-items: center;
  aspect-ratio: 1;
  background: var(--paper);
  border: 2px solid var(--ink);
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  padding: .32rem;
  position: relative;
}

.cell-index {
  font-size: .62rem;
  font-weight: 700;
  line-height: 1;
}

.cell-value {
  align-self: center;
  font-size: clamp(.7rem, 2.6vw, 1rem);
  font-weight: 700;
  justify-self: center;
}

.cell-state {
  align-self: end;
  font-size: .5rem;
  letter-spacing: .06em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.cell.visited {
  background: var(--accent-tint);
}

.cell.current {
  background: var(--accent);
  color: #ffffff;
}

.cell.result {
  background: var(--result);
  color: #ffffff;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  font-size: .68rem;
  gap: .45rem 1rem;
  margin: .6rem 0 .9rem;
}

.legend-item {
  align-items: center;
  display: inline-flex;
  gap: .35rem;
}

.swatch {
  border: 1px solid var(--ink);
  display: inline-block;
  height: .75rem;
  width: .75rem;
}

.swatch-current { background: var(--accent); }
.swatch-visited { background: var(--accent-tint); }
.swatch-result { background: var(--result); }

.action-row {
  align-items: center;
  border-top: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  padding-top: .8rem;
}

button {
  background: var(--paper);
  border: 2px solid var(--ink);
  color: var(--ink);
  cursor: pointer;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .07em;
  min-height: 2.4rem;
  padding: .42rem .75rem;
  text-transform: uppercase;
}

button:hover:not(:disabled) {
  background: var(--ink);
  color: var(--paper);
}

button:disabled {
  cursor: not-allowed;
  opacity: .35;
}

.probe-count {
  border-left: 2px solid var(--ink);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  margin-left: auto;
  padding: .45rem 0 .45rem .75rem;
  text-transform: uppercase;
}

.probe-count output {
  color: var(--accent);
  font-size: 1.2rem;
}

.ledger {
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
  font-size: clamp(1rem, 4vw, 1.45rem);
  font-weight: 700;
  line-height: 1.35;
  margin: .9rem 3px .75rem 0;
  min-height: 3.35rem;
  overflow-wrap: anywhere;
  padding: .65rem .75rem;
}

.status {
  color: var(--result);
  font-size: .82rem;
  font-weight: 700;
  line-height: 1.45;
  margin: 0 0 .55rem;
  min-height: 2.35rem;
}

.model-note {
  border-left: 3px solid var(--accent);
  color: var(--muted);
  font-size: .72rem;
  line-height: 1.5;
  margin: 0;
  padding-left: .65rem;
}

@media (max-width: 620px) {
  .control-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cell { padding: .22rem; }
  .probe-count { margin-left: 0; }
}

@media (max-width: 390px) {
  body { padding: .75rem; }
  .control-grid { grid-template-columns: 1fr; }
  .cell-state { display: none; }
}
```
