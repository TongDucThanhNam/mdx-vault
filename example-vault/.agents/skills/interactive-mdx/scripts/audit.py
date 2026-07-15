#!/usr/bin/env python3
"""Mechanical auditor for Interactive MDX notes.

Usage from the vault root:
    python .agents/skills/interactive-mdx/scripts/audit.py notes/example.mdx

The implementation deliberately uses only the Python standard library.  It is
not an MDX compiler; it is a conservative structural judge for the mechanical
rules documented in references/audits.md.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
VAULT_ROOT = SKILL_DIR.parents[2]
COMPONENT_REFERENCE = SKILL_DIR / "references" / "components.md"

# Used only when references/components.md is missing or its component tables
# cannot be parsed. Keep this fallback synchronized with that reference file.
FALLBACK_COMPONENTS = {
    "NotePrimer",
    "PrimerTerm",
    "HighlightBox",
    "FormulaLine",
    "Recap",
    "MentalModel",
    "MentalModelRow",
    "TraceBlock",
    "ComparisonBars",
    "CellGrid",
    "FlowSequence",
    "WidgetFrame",
    "PredictionGate",
    "SelfTest",
    "SelfTestItem",
    "EvidenceLog",
    "EvidenceItem",
    "Interactive",
    "SandboxedHTML",
}

RULE_ORDER = {
    "FORBIDDEN": 0,
    "COMPONENTS": 1,
    "BUDGET-TRẦN": 2,
    "BUDGET-SÀN": 3,
    "WIDGET": 4,
    "RECAP": 5,
    "SELF-TEST": 6,
    "EVIDENCE": 7,
    "ISLAND": 8,
    "ANCHOR": 9,
    "FRONTMATTER": 10,
    "JSX": 11,
    "ONE-LINER": 12,
    "SPOILER-HEURISTIC": 13,
    "COVERAGE-HEURISTIC": 14,
    "SELF-TEST-LINK": 15,
    "EVIDENCE-RESULT": 16,
    "INPUT": 99,
}


@dataclass(frozen=True)
class Tag:
    name: str
    start: int
    end: int
    raw: str
    closing: bool
    self_closing: bool


@dataclass(frozen=True)
class Section:
    start: int
    content_start: int
    end: int
    heading_id: str
    title: str


@dataclass(frozen=True)
class Span:
    opening: Tag
    closing: Tag | None

    @property
    def end(self) -> int:
        return self.closing.end if self.closing else self.opening.end


@dataclass(frozen=True)
class Issue:
    severity: str
    rule: str
    message: str
    line: int


class Audit:
    def __init__(self, note_path: Path, text: str) -> None:
        self.note_path = note_path
        self.text = text
        self.masked = mask_non_markup(text)
        self.tags = scan_tags(text, self.masked)
        self.sections = find_sections(text, self.tags)
        self.issues: list[Issue] = []

    def line(self, offset: int) -> int:
        return self.text.count("\n", 0, max(0, offset)) + 1

    def report(
        self,
        severity: str,
        rule: str,
        message: str,
        offsets: Iterable[int] | None = None,
    ) -> None:
        positions = sorted(set(offsets or [0]))
        line = self.line(positions[0])
        lines = [self.line(position) for position in positions]
        location = f"line {lines[0]}" if len(lines) == 1 else "lines " + ", ".join(map(str, lines))
        self.issues.append(Issue(severity, rule, f"{message} ({location})", line))

    def run(self) -> list[Issue]:
        self.check_forbidden()
        self.check_components()
        widget_spans = spans_for(self.tags, "WidgetFrame")
        self.check_budget(widget_spans)
        self.check_widgets(widget_spans)
        self.check_recaps(widget_spans)
        self.check_self_test()
        self.check_evidence()
        self.check_islands()
        self.check_anchors()
        self.check_frontmatter()
        self.check_jsx()
        self.check_one_liner()
        self.check_spoilers()
        self.check_coverage()
        self.issues.sort(key=lambda issue: (RULE_ORDER.get(issue.rule, 98), issue.line))
        return self.issues

    def check_forbidden(self) -> None:
        patterns = [
            ("import declaration", re.compile(r"(?mi)^\s*import\b")),
            ("export declaration", re.compile(r"(?mi)^\s*export\b")),
            ("<script>", re.compile(r"(?i)<\s*script\b")),
            ("<style>", re.compile(r"(?i)<\s*style\b")),
            ("style=", re.compile(r"(?i)\bstyle\s*=")),
            ("onClick=", re.compile(r"(?i)\bonclick\s*=")),
        ]
        found: list[tuple[str, int]] = []
        for label, pattern in patterns:
            found.extend((label, match.start()) for match in pattern.finditer(self.masked))
        if found:
            labels = ", ".join(sorted({label for label, _ in found}))
            self.report(
                "FAIL",
                "FORBIDDEN",
                f"forbidden MDX syntax found: {labels}",
                [position for _, position in found],
            )

    def check_components(self) -> None:
        whitelist = load_component_whitelist()
        unknown = [
            tag
            for tag in self.tags
            if not tag.closing and tag.name[:1].isupper() and tag.name not in whitelist
        ]
        if unknown:
            names = ", ".join(sorted({tag.name for tag in unknown}))
            self.report(
                "FAIL",
                "COMPONENTS",
                f"PascalCase component is not in the kit whitelist: {names}",
                [tag.start for tag in unknown],
            )

    def check_budget(self, widget_spans: list[Span]) -> None:
        widget_count = len(widget_spans)
        if widget_count > 3:
            self.report(
                "FAIL",
                "BUDGET-TRẦN",
                f"found {widget_count} WidgetFrame components; maximum is 3",
                [span.opening.start for span in widget_spans[3:]],
            )

        body_sections = [section for section in self.sections if is_body_section(section)]
        section_count = len(body_sections)
        interactions = widget_count + self.count_param_explorers(widget_spans)
        minimum = 3 if section_count >= 9 else 2 if section_count >= 6 else 0
        if interactions < minimum:
            offset = body_sections[-1].start if body_sections else 0
            self.report(
                "FAIL",
                "BUDGET-SÀN",
                f"{section_count} body sections require at least {minimum} interaction points; found {interactions}",
                [offset],
            )

    def count_param_explorers(self, widget_spans: list[Span]) -> int:
        frame_ranges = [
            (span.opening.start, span.closing.end if span.closing else len(self.text))
            for span in widget_spans
        ]
        count = 0
        for tag in self.tags:
            if tag.closing or tag.name not in {"Interactive", "SandboxedHTML"}:
                continue
            if any(start <= tag.start < end for start, end in frame_ranges):
                continue
            section = next(
                (candidate for candidate in self.sections if candidate.start <= tag.start < candidate.end),
                None,
            )
            if not section:
                continue
            section_text = self.text[section.content_start : section.end].casefold()
            parameter_marker = bool(
                re.search(r"\bparam(?:eter)?\b|slider|thanh trượt|\bkéo\b", section_text)
            )
            honor_marker = "honor-system" in section_text or bool(
                re.search(r"tự\s+dự\s+đoán[\s\S]{0,180}trước\s+khi", section_text)
            )
            if parameter_marker and honor_marker:
                count += 1
        return count

    def check_widgets(self, widget_spans: list[Span]) -> None:
        problems: list[str] = []
        offsets: list[int] = []
        for index, span in enumerate(widget_spans, start=1):
            opening = span.opening
            frame_end = span.closing.start if span.closing else len(self.text)
            frame_tags = [tag for tag in self.tags if opening.end <= tag.start < frame_end]
            if not nonempty_attribute(opening.raw, "misconception"):
                problems.append(f"widget {index} lacks a non-empty misconception prop")
                offsets.append(opening.start)

            gates = [tag for tag in frame_tags if not tag.closing and tag.name == "PredictionGate"]
            if not gates:
                problems.append(f"widget {index} has no PredictionGate")
                offsets.append(opening.start)
                continue

            gate = gates[0]
            missing = [
                prop
                for prop in ("question", "options")
                if not nonempty_attribute(gate.raw, prop)
            ]
            if missing:
                problems.append(f"widget {index} gate lacks {', '.join(missing)}")
                offsets.append(gate.start)

            islands = [
                tag
                for tag in frame_tags
                if not tag.closing and tag.name in {"Interactive", "SandboxedHTML"}
            ]
            islands_after = [tag for tag in islands if tag.start > gate.end]
            if not nonempty_attribute(gate.raw, "answer") and not islands_after:
                problems.append(f"widget {index} gate needs an answer or an island after it")
                offsets.append(gate.start)
            islands_before = [tag for tag in islands if tag.start < gate.start]
            if islands_before:
                problems.append(f"widget {index} island must stand after its gate")
                offsets.extend(tag.start for tag in islands_before)

        if problems:
            self.report("FAIL", "WIDGET", "; ".join(problems), offsets)

    def check_recaps(self, widget_spans: list[Span]) -> None:
        missing: list[int] = []
        for index, span in enumerate(widget_spans):
            if not span.closing:
                continue
            later_frames = [candidate.opening.start for candidate in widget_spans[index + 1 :]]
            later_headings = [section.start for section in self.sections if section.start > span.closing.end]
            boundary = min(later_frames + later_headings + [len(self.text)])
            has_recap = any(
                not tag.closing
                and tag.name == "Recap"
                and span.closing.end <= tag.start < boundary
                for tag in self.tags
            )
            if not has_recap:
                missing.append(span.opening.start)
        if missing:
            self.report(
                "FAIL",
                "RECAP",
                "each WidgetFrame needs a Recap before the next widget or h2",
                missing,
            )

    def check_self_test(self) -> None:
        items = [tag for tag in self.tags if not tag.closing and tag.name == "SelfTestItem"]
        levels = [integer_attribute(tag.raw, "level") for tag in items]
        if len(items) != 3 or sorted(level for level in levels if level is not None) != [3, 4, 5]:
            positions = [tag.start for tag in items] or [0]
            self.report(
                "FAIL",
                "SELF-TEST",
                f"expected exactly 3 SelfTestItem components with levels {{3,4,5}}; found {len(items)} with levels {levels}",
                positions,
            )

        missing_links: list[int] = []
        for span in spans_for(self.tags, "SelfTestItem"):
            if not span.closing:
                missing_links.append(span.opening.start)
                continue
            answer = self.text[span.opening.end : span.closing.start]
            if not re.search(r"href\s*=\s*[\"']#|\[\[[^\]]+\]\]|\]\(#[^)]+\)", answer):
                missing_links.append(span.opening.start)
        if missing_links:
            self.report(
                "WARN",
                "SELF-TEST-LINK",
                "SelfTestItem answer lacks an anchor or wikilink back-reference",
                missing_links,
            )

    def check_evidence(self) -> None:
        logs = [tag for tag in self.tags if not tag.closing and tag.name == "EvidenceLog"]
        if not logs:
            self.report("FAIL", "EVIDENCE", "EvidenceLog is required", [0])

        results: list[int] = []
        for span in spans_for(self.tags, "EvidenceItem"):
            if not span.closing:
                continue
            children = self.text[span.opening.end : span.closing.start]
            children = re.sub(r"<!--.*?-->|\{/\*.*?\*/\}", "", children, flags=re.DOTALL)
            if children.strip():
                results.append(span.opening.start)
        if results:
            self.report(
                "WARN",
                "EVIDENCE-RESULT",
                "EvidenceItem contains a result; verify that it was measured and sourced",
                results,
            )

    def check_islands(self) -> None:
        problems: list[str] = []
        offsets: list[int] = []
        for tag in self.tags:
            if tag.closing or tag.name not in {"Interactive", "SandboxedHTML"}:
                continue
            src = string_attribute(tag.raw, "src")
            if not src:
                problems.append(f"{tag.name} lacks src")
                offsets.append(tag.start)
                continue
            target = (self.note_path.parent / html.unescape(src)).resolve()
            if not target.exists():
                problems.append(f"src {src!r} does not exist")
                offsets.append(tag.start)
                continue
            manifest = target / "manifest.json" if target.is_dir() else target.parent / "manifest.json"
            if not manifest.is_file():
                problems.append(f"src {src!r} has no sibling manifest.json")
                offsets.append(tag.start)
                continue
            try:
                payload = json.loads(manifest.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError) as error:
                problems.append(f"manifest for {src!r} is unreadable JSON: {error}")
                offsets.append(tag.start)
                continue
            permissions = payload.get("permissions")
            if not isinstance(permissions, dict):
                problems.append(f"manifest for {src!r} lacks permissions")
                offsets.append(tag.start)
                continue
            for permission in ("network", "filesystem"):
                if permissions.get(permission) is not False and not self.permission_exception(src, permission):
                    problems.append(f"manifest for {src!r} must set permissions.{permission}=false")
                    offsets.append(tag.start)
        if problems:
            self.report("FAIL", "ISLAND", "; ".join(problems), offsets)

    def permission_exception(self, src: str, permission: str) -> bool:
        # A plan exception must be explicit and machine-readable, for example:
        # PERMISSION-EXCEPTION: ../interactives/example network
        candidates = {VAULT_ROOT / "plan.md", self.note_path.parent / "plan.md"}
        expected = f"PERMISSION-EXCEPTION: {src} {permission}".casefold()
        for candidate in candidates:
            try:
                if candidate.is_file() and expected in candidate.read_text(encoding="utf-8").casefold():
                    return True
            except (OSError, UnicodeError):
                continue
        return False

    def check_anchors(self) -> None:
        heading_ids: set[str] = set()
        for tag in self.tags:
            if tag.closing or tag.name.casefold() not in {f"h{level}" for level in range(1, 7)}:
                continue
            heading_id = string_attribute(tag.raw, "id")
            if heading_id:
                heading_ids.add(heading_id)
        for section in self.sections:
            if section.heading_id:
                heading_ids.add(section.heading_id)

        broken: list[tuple[str, int]] = []
        for match in re.finditer(r"\bhref\s*=\s*([\"'])#([^\"']+)\1", self.masked):
            anchor = html.unescape(match.group(2))
            if anchor not in heading_ids:
                broken.append((anchor, match.start()))
        if broken:
            anchors = ", ".join(f"#{anchor}" for anchor, _ in broken)
            self.report(
                "FAIL",
                "ANCHOR",
                f"anchor target has no heading id: {anchors}",
                [position for _, position in broken],
            )

    def check_frontmatter(self) -> None:
        match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", self.text, re.DOTALL)
        missing: list[str] = []
        offset = 0
        if not match:
            missing.append("valid leading YAML fence")
        else:
            frontmatter = match.group(1)
            fields = {
                field.group(1): field.group(2).strip().strip("\"'")
                for field in re.finditer(r"(?m)^([A-Za-z0-9_-]+):\s*(.*?)\s*$", frontmatter)
            }
            if not fields.get("title"):
                missing.append("title")
            if fields.get("theme") != "interactive-note":
                missing.append("theme: interactive-note")
            if not fields.get("review_interval_days"):
                missing.append("review_interval_days")
            offset = match.start(1)
        if missing:
            self.report(
                "FAIL",
                "FRONTMATTER",
                "missing or invalid " + ", ".join(missing),
                [offset],
            )

    def check_jsx(self) -> None:
        void_tags = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
        stack: list[Tag] = []
        problems: list[str] = []
        offsets: list[int] = []
        for tag in self.tags:
            if tag.self_closing or tag.name.casefold() in void_tags:
                continue
            if tag.closing:
                if not stack:
                    problems.append(f"unexpected closing </{tag.name}>")
                    offsets.append(tag.start)
                    continue
                if stack[-1].name != tag.name:
                    problems.append(f"expected </{stack[-1].name}> before </{tag.name}>")
                    offsets.extend([stack[-1].start, tag.start])
                    matching_index = next(
                        (index for index in range(len(stack) - 1, -1, -1) if stack[index].name == tag.name),
                        None,
                    )
                    if matching_index is not None:
                        del stack[matching_index:]
                    continue
                stack.pop()
            else:
                stack.append(tag)
        if stack:
            problems.extend(f"unclosed <{tag.name}>" for tag in stack)
            offsets.extend(tag.start for tag in stack)
        if problems:
            self.report("FAIL", "JSX", "; ".join(problems), offsets)

    def check_one_liner(self) -> None:
        one_liners = [
            section
            for section in self.sections
            if section.heading_id.casefold() == "one-liner"
            or "one-liner" in section.title.casefold()
            or "ý chính trong một câu" in section.title.casefold()
        ]
        visuals: list[Tag] = []
        for section in one_liners:
            visuals.extend(
                tag
                for tag in self.tags
                if not tag.closing
                and tag.name[:1].isupper()
                and section.content_start <= tag.start < section.end
            )
        if visuals:
            self.report(
                "FAIL",
                "ONE-LINER",
                "one-liner section must not contain a visual/component",
                [tag.start for tag in visuals],
            )

    def check_spoilers(self) -> None:
        spoilers: list[int] = []
        answers: list[str] = []
        for tag in self.tags:
            if tag.closing or tag.name != "PredictionGate":
                continue
            answer = string_attribute(tag.raw, "answer")
            if not answer:
                continue
            prefix = visible_text(self.text[: tag.start]).casefold()
            normalized_answer = normalize_space(html.unescape(answer)).casefold()
            if normalized_answer and normalized_answer in normalize_space(prefix):
                spoilers.append(tag.start)
                answers.append(answer)
        if spoilers:
            self.report(
                "WARN",
                "SPOILER-HEURISTIC",
                "gate answer appears in text above the gate: " + ", ".join(repr(answer) for answer in answers),
                spoilers,
            )

    def check_coverage(self) -> None:
        uncovered_quantitative: list[Section] = []
        uncovered_spatial: list[Section] = []
        for section in self.sections:
            if not is_body_section(section):
                continue
            body = self.text[section.content_start : section.end]
            number_count = len(re.findall(r"(?<![\w.])\d+(?:[.,]\d+)?", body))
            comparison_word = re.search(r"(?iu)(?:\bvs\.?\b|\bversus\b|\bhơn\b|\bgấp\b)", body)
            spatial_word = re.search(
                r"(?iu)\b(?:path|layout|hierarchy|tầng|chuỗi|bước)\b",
                f"{section.title}\n{body}",
            )
            has_visual = bool(
                re.search(r"<(?:CellGrid|ComparisonBars|FlowSequence|MentalModel|TraceBlock)\b", body)
            )
            has_table = bool(re.search(r"(?m)^\s*\|.*\|\s*$|<table\b", body))
            if number_count >= 2 and comparison_word and not has_visual and not has_table:
                uncovered_quantitative.append(section)
            if spatial_word and not has_visual and not has_table:
                uncovered_spatial.append(section)
        if uncovered_quantitative:
            self.report(
                "WARN",
                "COVERAGE-HEURISTIC",
                "quantitative comparison section lacks ComparisonBars, TraceBlock, or a table: "
                + ", ".join(section.title for section in uncovered_quantitative),
                [section.start for section in uncovered_quantitative],
            )
        if uncovered_spatial:
            self.report(
                "WARN",
                "COVERAGE-HEURISTIC",
                "spatial/sequential section lacks a static visual; consider CellGrid for layout or "
                "FlowSequence for paths: "
                + ", ".join(section.title for section in uncovered_spatial),
                [section.start for section in uncovered_spatial],
            )


def load_component_whitelist() -> set[str]:
    try:
        reference = COMPONENT_REFERENCE.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return set(FALLBACK_COMPONENTS)
    components = {
        match.group(1)
        for match in re.finditer(r"(?m)^\|\s*`([A-Z][A-Za-z0-9]*)`\s*\|", reference)
    }
    components.update({"Interactive", "SandboxedHTML"})
    return components if components else set(FALLBACK_COMPONENTS)


def mask_non_markup(text: str) -> str:
    chars = list(text)
    patterns = [
        re.compile(r"<!--.*?-->", re.DOTALL),
        re.compile(r"\{/\*.*?\*/\}", re.DOTALL),
        re.compile(r"(?m)^\s*```.*?$.*?^\s*```\s*$", re.DOTALL),
        re.compile(r"`(?:\\.|[^`])*`", re.DOTALL),
    ]
    for pattern in patterns:
        for match in pattern.finditer(text):
            for index in range(match.start(), match.end()):
                if chars[index] != "\n":
                    chars[index] = " "
    return "".join(chars)


def find_tag_end(masked: str, start: int) -> int | None:
    quote: str | None = None
    brace_depth = 0
    escaped = False
    for index in range(start + 1, len(masked)):
        char = masked[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in {'"', "'", "`"}:
            quote = char
        elif char == "{":
            brace_depth += 1
        elif char == "}" and brace_depth:
            brace_depth -= 1
        elif char == ">" and brace_depth == 0:
            return index + 1
    return None


def scan_tags(text: str, masked: str) -> list[Tag]:
    tags: list[Tag] = []
    for match in re.finditer(r"<\s*/?\s*[A-Za-z][A-Za-z0-9.-]*\b", masked):
        start = match.start()
        end = find_tag_end(masked, start)
        if end is None:
            continue
        raw = text[start:end]
        parsed = re.match(r"<\s*(/?)\s*([A-Za-z][A-Za-z0-9.-]*)\b", raw)
        if not parsed:
            continue
        name = parsed.group(2)
        suffix = raw[parsed.end() :]
        if suffix.startswith("://") or (name.casefold() in {"http", "https", "mailto"} and ":" in suffix):
            continue
        tags.append(
            Tag(
                name=name,
                start=start,
                end=end,
                raw=raw,
                closing=bool(parsed.group(1)),
                self_closing=bool(re.search(r"/\s*>\s*$", raw)),
            )
        )
    return tags


def spans_for(tags: list[Tag], name: str) -> list[Span]:
    stack: list[Tag] = []
    spans: list[Span] = []
    for tag in tags:
        if tag.name != name:
            continue
        if tag.self_closing and not tag.closing:
            spans.append(Span(tag, None))
        elif not tag.closing:
            stack.append(tag)
        elif stack:
            opening = stack.pop()
            spans.append(Span(opening, tag))
    spans.extend(Span(opening, None) for opening in stack)
    spans.sort(key=lambda span: span.opening.start)
    return spans


def string_attribute(raw: str, name: str) -> str | None:
    pattern = re.compile(
        rf"\b{re.escape(name)}\s*=\s*(?:\"((?:\\.|[^\"])*)\"|'((?:\\.|[^'])*)'|\{{\s*\"((?:\\.|[^\"])*)\"\s*\}}|\{{\s*'((?:\\.|[^'])*)'\s*\}})",
        re.DOTALL,
    )
    match = pattern.search(raw)
    if not match:
        return None
    return next((group for group in match.groups() if group is not None), None)


def nonempty_attribute(raw: str, name: str) -> bool:
    string_value = string_attribute(raw, name)
    if string_value is not None:
        return bool(string_value.strip())
    match = re.search(rf"\b{re.escape(name)}\s*=\s*\{{([\s\S]*?)\}}", raw)
    return bool(match and match.group(1).strip())


def integer_attribute(raw: str, name: str) -> int | None:
    match = re.search(rf"\b{re.escape(name)}\s*=\s*(?:\{{\s*)?[\"']?(\d+)", raw)
    return int(match.group(1)) if match else None


def find_sections(text: str, tags: list[Tag]) -> list[Section]:
    headings: list[tuple[int, int, str, str]] = []
    h2_spans = spans_for(tags, "h2")
    for span in h2_spans:
        if not span.closing:
            continue
        heading_id = string_attribute(span.opening.raw, "id") or ""
        title = visible_text(text[span.opening.end : span.closing.start]).strip()
        headings.append((span.opening.start, span.closing.end, heading_id, title))

    for match in re.finditer(r"(?m)^##(?!#)\s+(.+?)\s*$", text):
        title = re.sub(r"\s+\{#([^}]+)\}\s*$", "", match.group(1)).strip()
        explicit_id = re.search(r"\{#([^}]+)\}\s*$", match.group(1))
        heading_id = explicit_id.group(1) if explicit_id else slugify(title)
        headings.append((match.start(), match.end(), heading_id, title))

    headings.sort(key=lambda heading: heading[0])
    sections: list[Section] = []
    for index, (start, content_start, heading_id, title) in enumerate(headings):
        end = headings[index + 1][0] if index + 1 < len(headings) else len(text)
        sections.append(Section(start, content_start, end, heading_id, title))
    return sections


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
    ascii_value = ascii_value.casefold()
    ascii_value = re.sub(r"[^a-z0-9\s-]", "", ascii_value)
    return re.sub(r"[-\s]+", "-", ascii_value).strip("-")


def is_body_section(section: Section) -> bool:
    identity = f"{section.heading_id} {section.title}".casefold()
    excluded_ids = {"links", "evidence", "evidence-log", "self-test", "footer", "note-meta"}
    if section.heading_id.casefold() in excluded_ids:
        return False
    excluded_phrases = (
        "links",
        "liên kết",
        "evidence",
        "nhật ký bằng chứng",
        "self-test",
        "tự kiểm tra",
        "footer",
        "note-meta",
    )
    return not any(phrase in identity for phrase in excluded_phrases)


def visible_text(value: str) -> str:
    value = re.sub(r"\A---\r?\n.*?\r?\n---", " ", value, flags=re.DOTALL)
    value = re.sub(r"<!--.*?-->|\{/\*.*?\*/\}", " ", value, flags=re.DOTALL)
    value = re.sub(r"<[^>]*>", " ", value, flags=re.DOTALL)
    value = re.sub(r"[`*_{}\[\]()]", " ", value)
    return normalize_space(value)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit one Interactive MDX note")
    parser.add_argument("note", help="path to the .mdx note, relative to the current directory")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args(argv or sys.argv[1:])
    note_path = Path(args.note)
    if not note_path.is_absolute():
        note_path = (Path.cwd() / note_path).resolve()
    try:
        text = note_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        print(f"FAIL INPUT: cannot read {note_path}: {error} (line 1)")
        print("1 FAIL / 0 WARN")
        return 1

    issues = Audit(note_path, text).run()
    for issue in issues:
        print(f"{issue.severity} {issue.rule}: {issue.message}")
    fail_count = sum(issue.severity == "FAIL" for issue in issues)
    warn_count = sum(issue.severity == "WARN" for issue in issues)
    print(f"{fail_count} FAIL / {warn_count} WARN")
    return 1 if fail_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
