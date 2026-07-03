# interactives/

Custom components của vault (Trust Level 3/4) — mỗi component một folder:

```
interactives/<kebab-name>/
  component.tsx     # export default React component
  manifest.json     # bắt buộc — schema xem docs/security.md của repo app
  README.md         # mô tả, assumptions, provenance
  tests.ts          # optional
  fallback.png      # optional — dùng khi export static
```

Folder này còn trống có chủ đích: demo interactive đầu tiên được tạo ở GOAL-05.
