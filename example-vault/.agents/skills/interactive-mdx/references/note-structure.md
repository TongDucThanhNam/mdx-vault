# Note Structure — Interactive MDX (Format B)

Triết lý chi phối: **kinh tế học lần đọc thứ N** — interaction trả giá trị lần đầu nhưng thu phí mọi lần sau; static visual trả giá trị mọi lần đọc. Mẫu: distill.pub — full prose, figure tĩnh dày, 2–4 widget/bài. Vì vậy budget 2 chiều: trần ≤3 để không thành Lab, sàn ≥2 (note ≥6 section) để không thành bài văn xuôi.

## Ba tầng medium

```
Tier 1 — TEXT           one-liner, links, định nghĩa 1 câu
Tier 2 — STATIC VISUAL  không cần misconception, KHÔNG tính budget
                        BẮT BUỘC cho section có: so sánh định lượng /
                        bố cục không gian / trình tự
                        → so sánh định lượng → ComparisonBars / bảng
                        → bố cục không gian → CellGrid; trình tự/path → FlowSequence
                        → TraceBlock / MentalModel khi cần trace chữ / quan hệ khái niệm
Tier 3 — INTERACTIVE    budget sàn-trần theo SKILL.md, bắt buộc misconception + gate
```

## Thứ tự section (map từ 15 section HTML gốc sang MDX)

```
1.  Frontmatter YAML: title, tags, theme: interactive-note, prerequisites,
    id, type, layer, priority, maturity, review_interval_days, next_review
2.  H1 + dòng subtitle nghiêng
3.  <NotePrimer> — thuật ngữ Loại 1: MỖI CÁI 1 <PrimerTerm> + href anchor ↓.
    PrimerTerm cuối = đáy closure: "Kiến thức nền assume sẵn: [[X]], [[Y]]"
4.  One-liner  — h2 id="one-liner", 1–2 câu đậm, KHÔNG visual
5.  Mental Model — <MentalModel> 4 hàng Extends/Conflicts/Requires/
    Misapplication. Hàng Conflicts đáng 1 visual — NHƯNG chỉ vẽ nửa
    MISCONCEPTION, giấu correction cho widget (spoiler rule)
6.  Mechanism — <TraceBlock> step-by-step + visual độ lớn nếu có
7.  (Nếu widget cần) Section định nghĩa khái niệm riêng — đi từ gốc
8.  Widget(s) — anatomy dưới. Xen giữa các section nội dung, KHÔNG dồn cuối
9.  Tradeoffs — bảng markdown + ComparisonBars nếu định lượng
10. Failure Modes — bảng failure/cơ chế/symptom + <HighlightBox> nói rõ
    failure nào KHÔNG có widget và VÌ SAO (→ Evidence)
11. <EvidenceLog> — lệnh chạy được thật; ô trống = EvidenceItem không children;
    ghi "Note chưa đạt L3 khi bảng trống"
12. <SelfTest> — ĐÚNG 3 <SelfTestItem> level 3 (mechanism) / 4 (tradeoff) /
    5 (production case); đáp án link ngược anchor/wikilink; KHÔNG visual
13. Links — Prereq / Downstream / Bridge / Lab / Source (wikilinks)
14. Footer note-meta — 1 dòng ý: format B, số widget/budget, ngày
```

## Anatomy widget

```mdx
<WidgetFrame title="Tương tác 0N · Tên" misconception="...">
  <PredictionGate question="...?" options={[...]} answer="..." explain="..." />
  <SandboxedHTML src="../interactives/ten-island/index.html" />   {/* nếu cần slow-motion */}
</WidgetFrame>

<Recap>Đáp án + tổng kết đầy đủ — cho lần đọc thứ N, sau khi đã qua gate.</Recap>
```
Gate đứng TRƯỚC island. App tự lo commit-một-lần + verdict + LOCKED→READY.
PARAM explorer (slider trong island): không gate cứng — caption bắt buộc "tự dự đoán trước khi kéo".

## Phân biệt [W] vs [E] — chống simulation rởm

Simulation chỉ hợp lệ khi mechanism cần slow-motion để NHÌN từng bước
(probe sequence, cache line fill, B-tree traversal, TCP handshake, rehash migration).
Khi giá trị nằm ở CON SỐ THẬT trên máy thật (benchmark, false sharing, thrash cliff)
→ [E]: simulation tự code ra con số lập trình sẵn = tự viết đáp án rồi tự chấm = zero value.
Số liệu lý thuyết (công thức expected) được phép trong ComparisonBars nếu ghi rõ
"theo model/công thức, không phải benchmark" + nguồn.
