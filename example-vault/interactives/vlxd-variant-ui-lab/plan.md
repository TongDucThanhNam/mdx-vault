# Plan — Interactive Note (Format A Lab) — VLXD UI Lab

## Mục tiêu

Bổ sung cho Format B (`vlxd-variant-model/note.html`) — biến §4 UX/UI từ ASCII sketch
thành UI render thật bằng React. Người học:

1. Thấy được role gating (Staff KHÔNG thấy WAC/LN%; Manager thấy) trên cùng component
   bằng cách bấm toggle.
2. Trải qua POS flow thật: search → chọn variant → thêm vào giỏ → xem tổng.
3. Trải qua cascading filter: chọn Khổ → Dày → NSX, kết quả thu hẹp dần.

Format A khác Format B ở 4 điểm (theo note-structure.md):
- Dual-panel: prose trái + UI phải
- Step-through ẩn/hiện (3 step khác nhau, chuyển qua tab)
- Tương tác DÀY ĐẶC (không phải ≤3 widget — đây là lab)
- Job: dựng mental model LẦN ĐẦU, đọc 1 lần tuyến tính

## Cấu trúc note

```
┌─ Masthead (giữ editorial) ─────────────────────────────────────┐
├─ Frontmatter (id, type=lab, layer, prereq) ───────────────────┤
├─ H1 + subtitle ───────────────────────────────────────────────┤
├─ PRIMER strip: Role | Variant | Cart | Cascade ────────────────┤
├─ DUAL-PANEL ──────────────────────────────────────────────────┤
│  ┌─ PROSE (360px) ───────┬─ UI CANVAS (flex 1) ─────────────┐ │
│  │ H2 Step 1: Variant    │  <VariantMgmt/>                 │ │
│  │    Mgmt               │                                 │ │
│  │ ...                    │                                 │ │
│  │ H2 Step 2: POS Flow   │  <POSFlow/>                     │ │
│  │ ...                    │                                 │ │
│  │ H2 Step 3: Search      │  <SearchCascade/>               │ │
│  │    Cascade            │                                 │ │
│  └───────────────────────┴─────────────────────────────────┘ │
├─ Self-test (3 câu, link ngược) ───────────────────────────────┤
├─ Links ────────────────────────────────────────────────────────┤
└─ note-meta ─────────────────────────────────────────────────────┘
```

## 3 step / 3 component

### Step 1 — Variant Management (role gating)
- 2 button toggle: `[Staff]` `[Manager]`
- Hiển thị variant card với attrs (Khổ, Dày, NSX, Barcode) + stock info
- WAC, Biên LN%: chỉ Manager thấy (visibility class swap)
- Lịch sử lô nhập: cả 2 role thấy

### Step 2 — POS Flow
- Search input → chọn variant từ list → thêm vào cart
- Cart list hiển thị: tên, qty controls, selling_price, dòng tổng
- Nút "Thanh toán" → snapshot unit_cost từ WAC tại thời điểm click
- Hiển thị cart total + P&L snapshot

### Step 3 — Search Cascade
- 3 dropdown filter: Khổ → Dày → NSX (cascading — chọn Khổ 1m×2m thì Dày chỉ show option có variant tương ứng)
- List variants match → click để "chọn xem"

## Data fixture (mock, đủ cho lab)

```js
const PRODUCTS = [{
  id: 'p-van-ep', name: 'Ván ép',
  variants: [
    { id: 'v1', sku: 'VE-NH-1x2-6',  attrs: {kho:'1m×2m',   day:'6mm',  nsx:'Nam Hưng'}, sellingPrice: 145000, currentStock: 130, wac: 112308 },
    { id: 'v2', sku: 'VE-NH-1x2-9',  attrs: {kho:'1m×2m',   day:'9mm',  nsx:'Nam Hưng'}, sellingPrice: 185000, currentStock: 60,  wac: 158000 },
    { id: 'v3', sku: 'VE-NH-1.2x2.4-9', attrs: {kho:'1.2m×2.4m', day:'9mm', nsx:'Nam Hưng'}, sellingPrice: 240000, currentStock: 40, wac: 210000 },
    { id: 'v4', sku: 'VE-TL-1x2-6',  attrs: {kho:'1m×2m',   day:'6mm',  nsx:'Thái Lan'}, sellingPrice: 165000, currentStock: 80, wac: 142000 },
    { id: 'v5', sku: 'VE-TL-1x2-12', attrs: {kho:'1m×2m',   day:'12mm', nsx:'Thái Lan'}, sellingPrice: 245000, currentStock: 25, wac: 220000 },
  ],
  batches: [
    { id: 'b1', variantId: 'v1', date: '2026-05-15', qtyReceived: 200, qtyRemaining: 50,  unitCost: 100000 },
    { id: 'b2', variantId: 'v1', date: '2026-05-20', qtyReceived: 80,  qtyRemaining: 80,  unitCost: 120000 },
    { id: 'b3', variantId: 'v2', date: '2026-05-15', qtyReceived: 60,  qtyRemaining: 60,  unitCost: 158000 },
  ],
}];
```

## Term taxonomy

| Thuật ngữ       | Loại | Định nghĩa (note tự định nghĩa)        |
| --------------- | ---- | --------------------------------------- |
| Role            | 1    | Quyền hạn UI: Staff vs Manager          |
| Variant         | 2    | (prereq) — link về Format B note         |
| Cart            | 1    | Danh sách variant + qty chờ thanh toán  |
| Cascade filter  | 1    | Filter n-tier: chọn tầng trên thu hẹp option tầng dưới |

## Spoiler ordering (Format A)

Format A lab dùng step-through chứ không dùng prediction gate. Có thể spoil thoải mái
vì job là dựng mental model lần đầu — KHÔNG dùng gate.

## Frontmatter

```
id: vlxd-variant-ui-lab
type: lab
layer: domain/inventory
priority: P1
maturity_target: L2
current_maturity: L1
labs: [[vlxd-variant-ui-lab]]  (note này chính nó)
prereq: [[vlxd-product-variant-model]]
review_interval_days: 30
```

## Out of scope (cố ý)

- KHÔNG render multi-tenant — đó là §5 của Format B, không thuộc UI lab
- KHÔNG render form nhập lô (purchase flow) — job của lab này là UI selling side
- KHÔNG có persistence (refresh = reset) — đúng tinh thần Format A single-session
- KHÔNG dùng shadcn — inline Tailwind utility, vì file standalone

## Audit scope

Dùng `scripts/audit.py` cho Format A có khác không? Kiểm tra sau khi viết xong.
Nếu Format A khác hẳn Format B, có thể audit.py fail vì check `overflow:hidden` ở body.
