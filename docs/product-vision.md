# Product Vision — mdx-vault

## Thesis

AI làm content generation trở nên rẻ. Thứ còn khan hiếm là **hiểu, nhớ, kiểm chứng, thao tác, và hình thành mental model**. Vì vậy định dạng tri thức không nên chỉ là văn bản tĩnh — note nên có khả năng chứa **interactive artifacts** (theo tinh thần Explorable Explanations của Bret Victor, Seeing Theory, VisuAlgo).

Nhưng: đây vẫn là một **note app**. Không phải "AI notebook".

## Positioning

> **Obsidian alternative with native MDX and interactive islands.**
>
> A local-first MDX note app where Markdown remains the base layer, and React/HTML islands make notes interactive. AI helps only when invoked.

Giữ các invariant làm nên Obsidian:

- Local-first vault = một folder trên filesystem
- Note = plain-text file, mở được bằng bất kỳ editor nào, version control được
- Wikilink `[[...]]`, backlinks, tags, graph, command palette, editor nhanh
- File là source of truth; SQLite chỉ là index/cache có thể xóa và rebuild

Thay lõi Markdown-only bằng **MDX-first static/dynamic document model**.

## Mental model: PPR cho note

Giống Partial Prerendering của Next.js: một note là **static document shell + dynamic interactive islands**.

```
MDX Note
├── Static prose                    ← default, chiếm đa số
│   ├── Markdown, headings, wikilinks, tags, callouts
│   └── safe HTML (details/summary, SVG sạch, table)
│
├── Trusted interactive islands
│   ├── React components từ built-in registry
│   └── React components từ vault đã được trust
│
└── Sandboxed interactive islands
    ├── AI-generated React/HTML/CSS/JS
    └── arbitrary user code — permission hẹp, chạy trong iframe
```

## Vai trò của AI

**AI là trợ lý được gọi, không phải tác giả mặc định.** Người dùng viết note. Khi cần, họ bôi đen một đoạn và gọi command:

- Make interactive / Generate figure / Generate React component
- Create quiz / Explain with analogy
- Fix this component / Refactor this MDX / Convert code block to runnable playground

Quy tắc bất biến của AI workflow:

1. AI trả về **diff/patch**, không tự ghi đè file.
2. User approve trước khi ghi vào vault.
3. AI-generated component đi qua pipeline: generate → compile → lint → test → preview → repair.
4. App **không tin code AI sinh ra**: chạy sandbox, permission manifest, allowlist dependency.

Anti-goal rõ ràng: KHÔNG build UX kiểu "nhập topic → AI tự viết toàn bộ note → AI tự sinh toàn bộ component". Có thể tồn tại như command phụ, không bao giờ là core UX.

## Tiêu chuẩn chất lượng cho interactive block

Interactive không tự động tốt hơn text. Một island tốt phải:

- Cho user thao tác với **biến quan trọng**, không chỉ bấm play animation
- Phản hồi ngay lập tức, làm lộ quan hệ nhân-quả
- Có guidance ("kéo slider này", "dự đoán trước khi bấm")
- Có trạng thái ban đầu hợp lý và fallback tĩnh (text/hình) khi export
- Không bắt người học điều khiển quá nhiều thứ cùng lúc

Vì vậy ưu tiên **template components chuẩn** (AI chọn template + điền props) thay vì generate arbitrary code mỗi lần: `QuizBlock`, `EquationSlider`, `DataChart`, `AlgorithmVisualizer`, `DistributionPlayground`, `TimelineSimulator`, `CanvasSimulation`, ...

## Target users (theo thứ tự ưu tiên)

1. Developer, CS learners, technical writers — hiểu giá trị MDX/Git/component/local-first
2. Giáo viên, tutor, education creator — muốn bài học sinh động nhưng không code
3. Người tự học nghiêm túc (toán, xác suất, ML, thuật toán, vật lý, quant)
4. Internal training trong công ty (interactive runbook, onboarding lab)

## Killer demo (north star)

User import bài Markdown khô về binary search → bấm "Make explorable" → AI tạo interactive array với pointer low/mid/high, step-by-step animation, câu hỏi dự đoán bước tiếp theo → user nói "thêm case array chưa sort để thấy vì sao fail" → AI thêm toggle sorted/unsorted. Note trở thành mini-lab **do user chủ động tạo ra**, edit được, share được.

## Moat

Không phải MDX parser. Moat = sandbox an toàn + AI authoring loop tốt + template library chất lượng + interactive UX tốt + export/share tốt + vault vẫn portable như plain files.
