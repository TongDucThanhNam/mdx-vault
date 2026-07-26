# MDX Conventions — mdx-vault

> Convention cho nội dung note trong vault. App enforce các convention này ở tầng render/index/lint.

## Nguyên tắc: Separation of prose and behavior

Note phải **đọc được như văn bản** trong bất kỳ editor nào. Code component nằm ngoài note.

❌ Không khuyến khích:

```mdx
import React, { useState } from 'react'
import * as d3 from 'd3'

export default function Whatever() { ... }
```

✅ Khuyến khích:

```mdx
# Linear Regression

Linear regression tries to fit a line through data points.

<EquationPlayground formula="y = mx + b" />

<Interactive src="../interactives/linear-regression-playground" />
```

## Anatomy của một note

```mdx
---
title: Bayes Theorem
tags: [probability, statistics]
---

# Bayes Theorem

Bayes theorem lets us update belief after observing evidence.
Xem thêm [[Conditional Probability]].

<BayesSimulator prior={0.01} sensitivity={0.95} specificity={0.9} />

## Intuition

When the base rate is low, even a good test can produce surprising results.

<details>
  <summary>Show derivation</summary>
  ...safe HTML, render trực tiếp sau sanitize...
</details>
```

## Frontmatter schema

```yaml
title: string # optional — fallback: heading đầu tiên, rồi filename
tags: string[] # optional
created: YYYY-MM-DD # optional
aliases: string[] # optional — tên thay thế cho wikilink resolution
```

Frontmatter lạ không gây lỗi — bỏ qua khi index, giữ nguyên khi save.

## Wikilinks & tags

- `[[Note Name]]` và `[[Note Name|display text]]` — resolve theo title/aliases/filename (không phân biệt hoa thường), giống Obsidian.
- Tag: khai báo trong frontmatter `tags:`; inline `#tag` trong text là nice-to-have (Goal 02 quyết định).
- Wikilink được parse bằng custom remark plugin, KHÔNG bằng regex trên rendered output.

## Ba loại island trong note

1. **Trusted component (registry)** — element viết hoa, không import: `<QuizBlock ... />`, `<DataChart ... />`. Map qua `components` prop khi render. Component không tồn tại trong registry → render placeholder cảnh báo, không crash.
2. **Vault component** — `<Interactive src="../interactives/foo" />`. `src` là đường dẫn tương đối tới folder có `manifest.json`.
3. **Sandboxed HTML** — `<SandboxedHTML src="../interactives/bar/index.html" />`. Luôn iframe sandbox.

## Cấu trúc một vault interactive

```
interactives/bayes-simulator/
  component.tsx       # export default React component
  manifest.json       # bắt buộc — xem docs/security.md
  README.md           # mô tả, assumptions, provenance (prompt AI nếu có)
  tests.ts            # optional — input/output tests
  fallback.png        # optional — static fallback khi export
```

App-owned create flow tạo đúng ba file bắt buộc trong một transaction:
`component.tsx`, `manifest.json`, `README.md`; đồng thời chèn
`<Interactive src="..." />` bằng đường dẫn POSIX tương đối từ note. Root là segment
ngay sau `interactives/`; local `.ts/.tsx/.js/.jsx/.json` có thể nằm trong root đó,
nhưng import không được escape root hoặc đi qua `.app`, `.trash`, `.git`,
`node_modules` hay symlink.

`manifest.json` của starter React mặc định zero-capability:

```json
{
  "name": "React counter",
  "version": "1.0.0",
  "runtime": "react",
  "permissions": {
    "network": false,
    "filesystem": false,
    "dataPaths": []
  },
  "propsSchema": {},
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

Trong Interactive Proof, preview props chỉ là session input để thử component; app
không tự ghi chúng trở lại MDX/manifest. Save source đang incomplete vẫn hợp lệ:
Problems ledger/typecheck báo lỗi, còn proof giữ last-known-good document.

## Assets

- Ảnh: `![alt](../assets/img.png)` — path tương đối trong vault.
- Dataset cho chart: `../assets/datasets/*.csv|json`; component nhận đường dẫn qua props, app đọc file qua IPC (không cho island tự đọc filesystem).

## Naming

- File note: tên tự do, giữ nguyên như user đặt (kể cả dấu cách). Extension: `.mdx` (mặc định) và `.md` (tương thích, render như Markdown thuần).
- Component registry: PascalCase.
- Folder interactives: kebab-case.
