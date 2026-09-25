# Design System — Format B (editorial theme)

## Fonts — import đúng 3 font này, không thêm bớt
```html
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Lora:ital,wght@0,400;1,400&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet"/>
```
Playfair Display 700/900: h1, h2 · Lora 400: body · Courier Prime 400/700: code, label, UI.

## Quy tắc màu
Chỉ 2 accent: `--ink` (đen) và `--accent` (đỏ). Computed/result: `--result` #2b5797.
Tint được phép: `#dce6f5` (result-tint), `#f5d5d5` (accent-tint).
TUYỆT ĐỐI KHÔNG: gradient, border-radius, drop-shadow mờ, pastel, màu ngoài palette.

## CSS đầy đủ — copy nguyên khối vào <style>
(Trích trực tiếp từ examples/note-cache-hierarchy-locality.html — bản chuẩn đã audit.
Điểm khác Format A quan trọng nhất: body KHÔNG overflow:hidden — note scroll tự do.)

```css
:root{
  --paper:#f9f9f7; --paper-dark:#efefea; --ink:#111111;
  --accent:#d32f2f; --line:#cccccc; --shadow:4px 4px 0 var(--ink); --result:#2b5797;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}

/* ============================================================
   FORMAT B — INTERACTIVE NOTE
   Khác Lab một cách CÓ CHỦ ĐÍCH:
   - body SCROLL tự do  → random access, Ctrl+F, skim được
   - KHÔNG dual-panel   → text là xương sống, widget inline
   - KHÔNG ẩn content   → mọi section visible, link vào giữa note được
   ============================================================ */
body{
  background:var(--paper); color:var(--ink);
  font-family:"Lora",serif;
  /* overflow: auto — ĐÂY là điểm khác biệt cốt lõi với Lab */
}

/* Slim top bar — sticky để luôn biết đang ở note nào */
.masthead{
  position:sticky; top:0; z-index:50; height:40px;
  padding:0 1.5rem; background:var(--ink);
  border-bottom:2px solid var(--ink);
  display:flex; align-items:center; justify-content:space-between;
}
.brand{font-family:"Courier Prime",monospace;font-size:.8rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--paper)}
.brand-sub{font-family:"Courier Prime",monospace;font-size:.7rem;letter-spacing:1px;text-transform:uppercase;color:var(--accent)}

.page{max-width:820px;margin:0 auto;padding:2.5rem 2rem 6rem}

/* Frontmatter — queryable metadata, hiển thị như trong Obsidian */
.frontmatter{
  font-family:"Courier Prime",monospace;font-size:.78rem;line-height:1.7;
  background:var(--paper-dark);border:2px solid var(--ink);
  padding:1rem 1.2rem;margin-bottom:2.5rem;white-space:pre;overflow-x:auto;
}
.frontmatter .k{color:var(--accent);font-weight:700}
.frontmatter .v{color:var(--result)}

h1{font-family:"Playfair Display",serif;font-size:2.5rem;font-weight:900;line-height:1.15;margin-bottom:.4rem}
.subtitle{font-family:"Courier Prime",monospace;font-size:.8rem;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-bottom:2rem}

h2{font-family:"Playfair Display",serif;font-size:1.7rem;font-weight:700;margin:3rem 0 1rem;padding-top:1rem;border-top:2px solid var(--ink);scroll-margin-top:56px}
h2 .tag{
  font-family:"Courier Prime",monospace;font-size:.65rem;font-weight:700;
  vertical-align:middle;letter-spacing:1px;padding:.15rem .5rem;margin-left:.6rem;
  background:var(--ink);color:var(--paper);text-transform:uppercase;
}
h2 .tag.w{background:var(--accent)}
h2 .tag.e{background:var(--result)}

p{font-size:1rem;line-height:1.85;margin-bottom:.9rem;color:#222}
strong{color:var(--ink)}
code{font-family:"Courier Prime",monospace;background:var(--ink);color:var(--paper);padding:2px 7px;font-size:.85rem}
.formula-line{font-family:"Courier Prime",monospace;font-size:1.05rem;background:var(--paper);border:2px solid var(--ink);padding:.7rem 1rem;margin:.8rem 0;display:block;box-shadow:3px 3px 0 var(--ink)}
.highlight-box{background:var(--paper);border:2px solid var(--accent);border-left:5px solid var(--accent);padding:.7rem 1rem;margin:.8rem 0;font-size:.92rem;line-height:1.65}
.highlight-box strong{color:var(--accent)}

/* Bảng editorial */
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
th{font-family:"Courier Prime",monospace;font-size:.75rem;text-transform:uppercase;letter-spacing:1px;text-align:left;background:var(--ink);color:var(--paper);padding:.5rem .7rem}
td{border:1px solid var(--ink);padding:.55rem .7rem;line-height:1.55;vertical-align:top}
tr:nth-child(even) td{background:var(--paper-dark)}

/* Mental model 4 chiều */
.mm-grid{display:grid;grid-template-columns:130px 1fr;border:2px solid var(--ink);margin:1rem 0}
.mm-grid>div{padding:.6rem .9rem;font-size:.9rem;line-height:1.6;border-bottom:1px solid var(--line)}
.mm-grid>div:nth-last-child(-n+2){border-bottom:none}
.mm-key{font-family:"Courier Prime",monospace;font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:1px;background:var(--paper-dark);border-right:2px solid var(--ink);display:flex;align-items:center}
.mm-key.conflict{color:var(--accent)}

/* Mechanism trace */
.trace{font-family:"Courier Prime",monospace;font-size:.85rem;line-height:1.9;background:var(--paper-dark);border:2px solid var(--ink);padding:1rem 1.3rem;margin:1rem 0;white-space:pre;overflow-x:auto}
.trace .hit{color:var(--result);font-weight:700}
.trace .miss{color:var(--accent);font-weight:700}

/* ===== WIDGET FRAME — điểm neo tương tác inline ===== */
.widget{border:2px solid var(--ink);box-shadow:var(--shadow);margin:1.4rem 0 2rem;background:var(--paper)}
.widget-head{display:flex;justify-content:space-between;align-items:center;padding:.55rem 1rem;background:var(--paper-dark);border-bottom:2px solid var(--ink);font-family:"Courier Prime",monospace;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.widget-status{background:var(--ink);color:var(--paper);padding:.15rem .6rem;font-size:.7rem}
.widget-body{padding:1.3rem}
.widget-misconception{font-family:"Courier Prime",monospace;font-size:.75rem;padding:.45rem 1rem;border-bottom:2px dashed var(--line);background:var(--paper)}
.widget-misconception b{color:var(--accent)}

/* Prediction gate */
.gate{border:2px dashed var(--accent);padding:1rem 1.2rem;margin-bottom:1.2rem;background:var(--paper)}
.gate-q{font-family:"Lora",serif;font-size:.95rem;margin-bottom:.8rem;line-height:1.6}
.gate-q b{color:var(--accent)}
.gate-opts{display:flex;gap:.6rem;flex-wrap:wrap}
.gate-btn{font-family:"Courier Prime",monospace;font-weight:700;font-size:.8rem;padding:.5rem 1rem;border:2px solid var(--ink);background:var(--paper);cursor:pointer;box-shadow:2px 2px 0 var(--ink);text-transform:uppercase;letter-spacing:.5px;transition:background .1s,color .1s}
.gate-btn:hover{background:var(--ink);color:var(--paper)}
.gate-btn.chosen{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:none;transform:translate(2px,2px)}
.gate-verdict{margin-top:.9rem;font-family:"Courier Prime",monospace;font-size:.85rem;line-height:1.7;display:none;padding:.7rem 1rem;border:2px solid var(--ink);background:var(--paper-dark)}
.gate-verdict.show{display:block}
.gate-verdict .right{color:var(--result);font-weight:700}
.gate-verdict .wrong{color:var(--accent);font-weight:700}

/* Lab buttons + slider (kế thừa từ Lab) */
.lab-btn{font-family:"Courier Prime",monospace;font-weight:700;font-size:.82rem;padding:.5rem 1rem;border:2px solid var(--ink);background:var(--paper);cursor:pointer;box-shadow:2px 2px 0 var(--ink);text-transform:uppercase;letter-spacing:.5px;transition:background .1s,color .1s}
.lab-btn:hover:not(:disabled){background:var(--ink);color:var(--paper)}
.lab-btn:active:not(:disabled){transform:translate(2px,2px);box-shadow:none}
.lab-btn.accent{background:var(--accent);color:#fff;border-color:var(--accent)}
.lab-btn.accent:hover:not(:disabled){background:#b71c1c}
.lab-btn:disabled{opacity:.3;cursor:not-allowed;box-shadow:none}
.lab-slider{-webkit-appearance:none;width:150px;height:4px;background:var(--ink);outline:none;cursor:pointer}
.lab-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;background:var(--accent);border:2px solid var(--ink);cursor:pointer}
.slider-label{font-family:"Courier Prime",monospace;font-size:.82rem;text-transform:uppercase;letter-spacing:1px}
.controls-row{display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;margin-top:1rem;padding-top:1rem;border-top:2px solid var(--ink)}

/* Grid cache viz */
.viz-flex{display:flex;gap:2.5rem;flex-wrap:wrap;justify-content:center;align-items:flex-start}
.viz-col{display:flex;flex-direction:column;align-items:center;gap:.5rem}
.viz-label{font-family:"Courier Prime",monospace;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.cell-grid{display:grid;grid-template-columns:repeat(4,38px);gap:5px}
.cell{width:38px;height:38px;border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:"Courier Prime",monospace;font-size:.8rem;font-weight:700;background:var(--paper);transition:background .15s,color .15s}
.cell.current{background:var(--accent);color:#fff}
.cell.visited-hit{background:#dce6f5}
.cell.visited-miss{background:#f5d5d5}
.cell.inline-cache{outline:3px solid var(--result);outline-offset:2px}
.counter-box{font-family:"Courier Prime",monospace;font-size:1rem;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink);padding:.8rem 1.4rem;margin-top:1.2rem;text-align:center;line-height:1.8}
.counter-box .m{color:var(--accent);font-weight:700}
.counter-box .h{color:var(--result);font-weight:700}

/* Stride dots */
.stride-row{display:grid;grid-template-columns:repeat(16,1fr);gap:4px;margin:.6rem 0}
.sdot{aspect-ratio:1;border:2px solid var(--ink);background:var(--paper);display:flex;align-items:center;justify-content:center;font-family:"Courier Prime",monospace;font-size:.6rem}
.sdot.hit{background:var(--result);color:#fff}
.sdot.miss{background:var(--accent);color:#fff}
.sdot.skip{opacity:.25}
.line-brackets{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:2px}
.line-brackets div{font-family:"Courier Prime",monospace;font-size:.62rem;text-align:center;border-top:2px solid var(--ink);border-left:2px solid var(--ink);border-right:2px solid var(--ink);padding:1px 0;letter-spacing:1px}

/* Evidence log */
.evidence-empty{font-family:"Courier Prime",monospace;font-size:.82rem;color:var(--accent);font-weight:700}
.cmd{font-family:"Courier Prime",monospace;font-size:.78rem;background:var(--ink);color:var(--paper);padding:.6rem .9rem;display:block;margin:.4rem 0;white-space:pre;overflow-x:auto}

/* Self-test */
.q-item{border:2px solid var(--ink);margin:1rem 0;background:var(--paper)}
.q-head{padding:.8rem 1rem;font-size:.95rem;line-height:1.6;display:flex;gap:.8rem;align-items:baseline}
.q-level{font-family:"Courier Prime",monospace;font-size:.68rem;font-weight:700;background:var(--ink);color:var(--paper);padding:.15rem .5rem;white-space:nowrap;text-transform:uppercase;letter-spacing:1px}
.q-actions{padding:0 1rem .8rem}
.q-answer{display:none;border-top:2px dashed var(--line);padding:.8rem 1rem;font-size:.9rem;line-height:1.7;background:var(--paper-dark)}
.q-answer.show{display:block}

/* Links */
.links-list{list-style:none}
.links-list li{font-family:"Courier Prime",monospace;font-size:.85rem;line-height:2}
.links-list a,.wikilink{color:var(--result);font-weight:700;text-decoration:none;border-bottom:2px solid var(--result)}

.note-meta{font-family:"Courier Prime",monospace;font-size:.72rem;text-transform:uppercase;letter-spacing:1px;opacity:.6;margin-top:4rem;padding-top:1rem;border-top:2px solid var(--ink)}

/* ===== TIER 2 — STATIC VISUALS (không tính vào widget budget) ===== */
.lat-ladder{border:2px solid var(--ink);padding:1rem 1.2rem;margin:1rem 0;background:var(--paper-dark)}
.lat-row{display:grid;grid-template-columns:130px 1fr 70px;gap:.6rem;align-items:center;margin:.35rem 0;font-family:"Courier Prime",monospace;font-size:.78rem}
.lat-bar{height:13px;background:var(--ink)}
.lat-bar.ram{background:var(--accent)}
.lat-cap{font-family:"Courier Prime",monospace;font-size:.68rem;opacity:.65;margin-top:.6rem;text-transform:uppercase;letter-spacing:1px}
.mem-flex{display:flex;gap:1.4rem;flex-wrap:wrap;align-items:center;justify-content:center;margin:1.2rem 0 .6rem}
.mem-grid{display:grid;grid-template-columns:repeat(4,52px);gap:4px}
.mem-cell{height:32px;border:2px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:"Courier Prime",monospace;font-size:.6rem}
.mem-arrow{font-family:"Courier Prime",monospace;font-weight:700;font-size:.85rem;text-transform:uppercase;letter-spacing:1px}
.mem-strip{display:grid;grid-template-columns:repeat(16,1fr);gap:3px;margin:.5rem 0 .3rem}
.mem-strip .mem-cell{height:28px;font-size:.58rem}
.row0{background:var(--paper)}
.row1{background:var(--paper-dark)}
.row2{background:#dce6f5}
.row3{background:#f5d5d5}
.mem-caption{font-family:"Courier Prime",monospace;font-size:.7rem;text-align:center;letter-spacing:.5px;text-transform:uppercase}
.cmp-block{border:2px solid var(--ink);padding:.8rem 1rem;margin:.7rem 0 0;background:var(--paper)}
.cmp-row{display:grid;grid-template-columns:150px 1fr 45px;gap:.5rem;align-items:center;font-family:"Courier Prime",monospace;font-size:.72rem;margin:.28rem 0}
.cmp-bar{height:11px;background:var(--ink)}
.cmp-bar.bad{background:var(--accent)}
.cmp-divider{border-top:2px dashed var(--line);margin:.45rem 0;font-family:"Courier Prime",monospace;font-size:.65rem;text-transform:uppercase;letter-spacing:1px;padding-top:.35rem;opacity:.7}
.mem-strip.w12{grid-template-columns:repeat(12,1fr)}
.mem-strip.w8{grid-template-columns:repeat(8,1fr)}
.mem-cell.dim{opacity:.18}
.primer{border:2px dashed var(--ink);padding:.8rem 1.1rem;margin:0 0 2.2rem;background:var(--paper)}
.primer-head{font-family:"Courier Prime",monospace;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--accent);margin-bottom:.5rem}
.primer-row{font-size:.88rem;line-height:1.7;margin:.3rem 0}
.primer-row b{font-family:"Courier Prime",monospace;font-size:.78rem;background:var(--paper-dark);padding:1px 6px;border:1px solid var(--ink)}
.primer-row a{color:var(--result);font-weight:700;text-decoration:none;font-family:"Courier Prime",monospace;font-size:.72rem;white-space:nowrap}
```
