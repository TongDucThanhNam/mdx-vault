# Note Structure — Format B

## Format B vs Format A (không trộn lẫn)

| | Format A — Lab | Format B — Note (file này) |
|---|---|---|
| Job | Dựng mental model LẦN ĐẦU (concept L0–L1) | Reference đọc N lần: tra, ôn, debug, link |
| Đọc | 1 lần, tuyến tính | Nhiều lần, random access, scan 90 giây |
| Layout | Dual-panel, step ẩn/hiện | Document scroll, mọi section visible |
| Interaction | Dày đặc | ≤3 widget, misconception-gated |

Triết lý chi phối: **kinh tế học lần đọc thứ N** — interaction chỉ trả giá trị lần đầu (surprise một lần) nhưng thu phí mọi lần sau; static visual trả giá trị mọi lần đọc. Mô hình mẫu: distill.pub — full prose, figure tĩnh dày, 2–4 widget/bài.

## Ba tầng medium

```
Tier 1 — TEXT           one-liner, links, checklist, định nghĩa 1 câu
Tier 2 — STATIC VISUAL  không cần misconception test, KHÔNG tính budget
                        BẮT BUỘC cho section có: so sánh định lượng /
                        bố cục không gian / trình tự
Tier 3 — INTERACTIVE    budget ≤3, bắt buộc misconception spec + gate
```

## Thứ tự section bắt buộc

```
1.  Masthead — sticky, slim 40px, dark bar (brand + brand-sub)
2.  Frontmatter YAML hiển thị: id, type, layer, priority, maturity,
    labs, review_interval_days, next_review
3.  H1 + subtitle
4.  PRIMER STRIP — thuật ngữ Loại 1: MỖI CÁI ĐÚNG 1 DÒNG + anchor ↓ tới định
    nghĩa đầy đủ. Dòng cuối khai báo đáy closure: "Kiến thức nền assume sẵn:
    X, Y → prerequisites". KHÔNG phải glossary đầy đủ (định nghĩa đầy đủ sống
    ở section dưới — tránh duplicate → drift)
5.  One-liner [T] — 1–2 câu, KHÔNG visual
6.  Mental Model 4 chiều [T+tier2] — Extends / Conflicts / Requires /
    Misapplication (dùng .mm-grid). Row Conflicts thường đáng 1 visual —
    NHƯNG chỉ vẽ nửa MISCONCEPTION (cái người học tưởng), giấu nửa
    correction cho widget (spoiler rule)
7.  Mechanism [T+tier2] — .trace step-by-step + visual độ lớn nếu có
8.  (Nếu widget cần) Section định nghĩa khái niệm riêng — đi từ gốc, có
    static diagram, có prefix [Version-dep]/[PG-specific] khi behavior
    tùy implementation
9.  🎛 Widget(s) [W] — anatomy bên dưới
10. Tradeoffs [T+tier2] — bảng + visual nếu spatial
11. Failure Modes [T+tier2] — bảng failure/cơ chế/symptom production
    + visual cho failure có bố cục không gian
    + highlight-box nói rõ failure nào KHÔNG có widget và VÌ SAO (→ Evidence)
12. Evidence Log [E] — bảng benchmark/lệnh cụ thể/kết quả; ô trống
    = [CHƯA CÓ] class evidence-empty; ghi "Note chưa đạt L3 khi bảng trống"
13. Self-test [Q] — ĐÚNG 3 câu mức 3 (mechanism) / 4 (tradeoff) /
    5 (production case); reveal button; đáp án link ngược về section/widget;
    KHÔNG visual
14. Links [T] — Prereq / Downstream / Bridge / Lab / Source
15. note-meta footer — tự khai format, số widget/budget, rules đang áp
```

## Anatomy widget có gate

```
┌ widget-head: tên + status (LOCKED → READY → RUNNING → DONE)
├ widget-misconception: "Misconception nhắm tới: ..." — ghi thẳng trên frame
├ PREDICTION GATE: câu hỏi + 3 lựa chọn (.gate-btn data-pred)
│   → chọn xong MỚI unlock controls · commit MỘT LẦN không đổi
├ visual + controls (khởi tạo disabled)
└ verdict sau khi chạy: "Bạn đoán X — thực tế Y" + 1 câu giải thích độ lệch
```
Sau widget gated: **Recap tĩnh** (.cmp-block, divider "Recap tĩnh — cho lần
đọc thứ N, sau khi đã qua gate") chứa kết quả đầy đủ.

Slider/PARAM widget: không cần gate cứng — caption BẮT BUỘC yêu cầu tự dự
đoán trước khi kéo (honor-system). Đoạn tổng kết đặt SAU widget = recap hợp lệ.

## Phân biệt [W] vs [E]

Simulation chỉ hợp lệ khi mechanism cần slow-motion để NHÌN từng bước
(cache line fill, B-tree traversal, TCP handshake). Khi giá trị nằm ở CON SỐ
THẬT trên máy thật (false sharing, thrash cliff, mọi benchmark) → [E]:
simulation tự code output con số mình lập trình sẵn = zero evidence value =
tự viết đáp án rồi tự chấm.
