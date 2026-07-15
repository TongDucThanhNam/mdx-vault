# Registry Components — Interactive Note Kit

Tất cả là trusted registry component của app: viết PascalCase trực tiếp trong MDX, KHÔNG import. Props sai schema → app render cảnh báo (không crash) — nên viết đúng ngay từ đầu. Kích hoạt theme editorial bằng frontmatter `theme: interactive-note`.

## Cấu trúc & primer

| Component | Props | Dùng cho |
|---|---|---|
| `NotePrimer` | children | Khung "từ cần biết trước" đầu note; chứa các `PrimerTerm` |
| `PrimerTerm` | `term: string`, `href?: string`; children = định nghĩa | Một thuật ngữ Loại 1; `href` anchor `#section` hoặc link |
| `HighlightBox` | `title?: string`; children | Cảnh báo / version boundary / caveat |
| `FormulaLine` | children | Một dòng công thức monospace |
| `Recap` | children | Tổng kết tĩnh SAU widget (spoiler hợp lệ) |

## Mental model & visual tĩnh

| Component | Props | Dùng cho |
|---|---|---|
| `MentalModel` | children (các Row) | Grid Extends/Conflicts/Requires/Misapplication |
| `MentalModelRow` | `label: string`, `conflict?: boolean`; children | Một hàng; `conflict` → label đỏ |
| `TraceBlock` | children (pre, giữ whitespace) | Trace cơ chế từng bước |
| `ComparisonBars` | `items: {label: string, value: number, display?: string, bad?: boolean}[]`, `caption?: string` | So sánh định lượng ngang; bar scale theo max |
| `CellGrid` | `columns: number (1..32)`, `cells: {label?: string, state?: 'default'\|'current'\|'hit'\|'miss'\|'cached'\|'dim'}[]`, `caption?: string`, `groupSize?: number`, `groupLabels?: string[]` | Bố cục không gian: ô nhớ, hash slot, cache line; `groupSize` vẽ ngoặc nhóm |
| `FlowSequence` | `nodes: {label: string, sublabel?: string, accent?: boolean}[]`, `edgeLabels?: string[]`, `caption?: string`, `direction?: 'row'\|'column'` (mặc định `row`) | Trình tự/path: resolution, handshake, pipeline |

```mdx
<ComparisonBars
  items={[
    { label: "Row-major misses", value: 4, display: "4" },
    { label: "Column-major misses", value: 16, display: "16", bad: true }
  ]}
  caption="Cùng số phép toán, khác số line fill"
/>
```

```mdx
<CellGrid
  columns={4}
  cells={[
    { label: "0" },
    { label: "1", state: "current" },
    { label: "2", state: "hit" },
    { label: "3", state: "cached" }
  ]}
  groupSize={4}
  groupLabels={["LINE 0"]}
  caption="Bốn địa chỉ liền kề thuộc cùng cache line"
/>

<FlowSequence
  nodes={[
    { label: "Stub resolver", sublabel: "local" },
    { label: "Recursive resolver", accent: true },
    { label: "Authoritative", sublabel: "answer" }
  ]}
  edgeLabels={["query", "~30ms"]}
  caption="Đường phân giải DNS"
/>
```

## Widget & prediction

| Component | Props | Hành vi app tự lo |
|---|---|---|
| `WidgetFrame` | `title: string`, `misconception?: string`; children | Khung + badge LOCKED→READY→DONE; misconception line |
| `PredictionGate` | `question: string`, `options: string[]`, `answer?: string`, `explain?: string` | Commit MỘT LẦN; có `answer` → verdict đúng/sai + explain ngay sau commit |

Lưu ý: `<Interactive>` chạy trong iframe sandbox — KHÔNG nhận context từ WidgetFrame. Gate đứng trước, island đứng sau, Recap chốt hạ.

## Retrieval layer

| Component | Props | Hành vi |
|---|---|---|
| `SelfTest` | children | Container section self-test |
| `SelfTestItem` | `level: number (3/4/5)`, `question: string`; children = đáp án | Đáp án ẩn tới khi bấm reveal |
| `EvidenceLog` | children | Container evidence |
| `EvidenceItem` | `cmd: string`; children = kết quả thật (optional) | KHÔNG children → ô đỏ `[CHƯA CÓ]`. Cấm bịa kết quả |

## Island custom (ngoài kit)

- `<Interactive src="../interactives/ten-folder" />` — folder phải có `manifest.json` (`runtime: "react"` + `component.tsx` export default, hoặc `runtime: "html"` + `index.html`) với `permissions: { network: false, filesystem: false, dataPaths: [] }` trừ khi thật sự cần.
- `<SandboxedHTML src="../interactives/x/index.html" />` — HTML tùy ý, luôn iframe sandbox.
- Dataset cho chart: để trong `assets/datasets/`, truyền path qua props.

## Cấm trong toàn bộ note

`import` / `export` / `<style>` / `<script>` / inline handler / gradient / border-radius (theme đã đúng design system, đừng override).
