"""Live Source editor verification through Electron's CDP endpoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import (
    Error as PlaywrightError,
    Page,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", default="http://127.0.0.1:9333")
    parser.add_argument("--vault", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def app_page(pages: list[Page]) -> Page:
    for page in pages:
        if page.url.startswith("http://localhost:"):
            return page
    if not pages:
        raise RuntimeError("Electron exposed no renderer page")
    return pages[0]


def set_window_size(page: Page, width: int, height: int) -> None:
    session = page.context.new_cdp_session(page)
    try:
        window = session.send("Browser.getWindowForTarget")
        session.send(
            "Browser.setWindowBounds",
            {
                "windowId": window["windowId"],
                "bounds": {"width": width, "height": height, "windowState": "normal"},
            },
        )
    except PlaywrightError:
        page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(300)


def open_file(page: Page, relative_path: str) -> None:
    dialog = page.get_by_role("dialog", name="Open file")
    for attempt in range(3):
        page.keyboard.press("Control+P")
        try:
            dialog.wait_for(state="visible", timeout=4_000)
            break
        except PlaywrightTimeoutError:
            if attempt == 2:
                raise
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
    query = page.get_by_role(
        "combobox", name="Search files by title, alias, path, or extension"
    )
    query.fill(relative_path)
    option = dialog.get_by_role("option").filter(has_text=relative_path).first
    option.wait_for(state="visible", timeout=10_000)
    option.click()
    dialog.wait_for(state="hidden", timeout=15_000)


def editor_snapshot(page: Page) -> dict[str, object]:
    return page.evaluate(
        """() => {
          const editor = document.querySelector('.cm-editor')
          const scroller = editor?.querySelector('.cm-scroller')
          const gutter = editor?.querySelector('.cm-gutters')
          const activeLine = editor?.querySelector('.cm-activeLine')
          const content = editor?.querySelector('.cm-content')
          const line = editor?.querySelector('.cm-line')
          const scrollerStyle = scroller ? getComputedStyle(scroller) : null
          const gutterStyle = gutter ? getComputedStyle(gutter) : null
          const activeStyle = activeLine ? getComputedStyle(activeLine) : null
          const contentStyle = content ? getComputedStyle(content) : null
          const lineStyle = line ? getComputedStyle(line) : null
          return {
            classes: editor?.className ?? '',
            kind: editor?.getAttribute('data-source-kind'),
            displayMode: editor?.getAttribute('data-display-mode'),
            wrap: editor?.getAttribute('data-word-wrap'),
            fontFamily: scrollerStyle?.fontFamily ?? '',
            fontSize: scrollerStyle?.fontSize ?? '',
            fontWeight: scrollerStyle?.fontWeight ?? '',
            lineHeight: scrollerStyle?.lineHeight ?? '',
            gutterBackground: gutterStyle?.backgroundColor ?? '',
            gutterBorderRight: gutterStyle?.borderRightWidth ?? '',
            editorBackground: editor ? getComputedStyle(editor).backgroundColor : '',
            editorOutline: editor ? getComputedStyle(editor).outline : '',
            activeLineBackground: activeStyle?.backgroundColor ?? '',
            activeLineShadow: activeStyle?.boxShadow ?? '',
            contentWidth: content?.getBoundingClientRect().width ?? 0,
            gutterWidth: gutter?.getBoundingClientRect().width ?? 0,
            contentMinWidth: contentStyle?.minWidth ?? '',
            linePaddingLeft: lineStyle?.paddingLeft ?? '',
            scrollerWidth: scroller?.getBoundingClientRect().width ?? 0,
            scrollerClientWidth: scroller?.clientWidth ?? 0,
            scrollLeft: scroller?.scrollLeft ?? -1,
            rulerColumn: getComputedStyle(document.documentElement)
              .getPropertyValue('--editor-wrap-column').trim(),
          }
        }"""
    )


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.connect_over_cdp(args.cdp)
        context = browser.contexts[0]
        page = app_page(context.pages)
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.wait_for_load_state("domcontentloaded")
        set_window_size(page, 1440, 900)

        page.evaluate(
            """async (vaultPath) => {
              await window.appApi.updateSettings({
                theme: 'light',
                locale: 'en',
                editorFontFamily: 'maple-mono',
                editorFontSize: 14,
                editorFontWeight: 'regular',
                editorLineHeight: 1.45,
                editorLigatures: true,
                editorTabSize: '2',
                editorNoteWordWrap: 'bounded',
                editorCodeWordWrap: 'off',
                editorWrapColumn: 88,
                editorIndentGuides: true,
                editorWhitespace: 'none',
                editorRuler: true
              })
              await window.vaultApi.openVaultPath(vaultPath)
              window.location.reload()
            }""",
            str(Path(args.vault).resolve()),
        )

        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        open_file(page, "notes/Welcome.mdx")
        page.get_by_role("button", name="Source view").click()
        note_editor = page.locator(
            '.cm-editor[data-source-kind="code"][data-display-mode="source"]'
        )
        note_editor.wait_for(state="visible", timeout=20_000)
        note_editor.locator(".cm-scroller").click(position={"x": 120, "y": 180})
        note = editor_snapshot(page)
        assert note["kind"] == "code", note
        assert note["displayMode"] == "source", note
        assert note["wrap"] == "off", note
        assert "Maple Mono" in str(note["fontFamily"]), note
        assert note["fontSize"] == "14px", note
        assert note["fontWeight"] == "400", note
        assert note["rulerColumn"] == "88", note
        assert note["activeLineShadow"] == "none", note
        assert note["gutterBorderRight"] == "0px", note
        assert note["contentMinWidth"] == "0px", note
        assert note["linePaddingLeft"] == "12px", note
        assert float(note["contentWidth"]) + float(note["gutterWidth"]) + 1 >= float(note["scrollerClientWidth"]), note
        note_status = page.locator("footer").inner_text()
        assert "Ln " in note_status and "MDX" in note_status, note_status
        page.screenshot(path=str(output / "source-note.png"), full_page=True)

        page.get_by_role("button", name="Live view").click()
        live_editor = page.locator(
            '.cm-editor[data-source-kind="note"][data-display-mode="live"]'
        )
        live_editor.wait_for(state="visible", timeout=10_000)
        live = editor_snapshot(page)
        assert live["wrap"] == "bounded", live
        page.screenshot(path=str(output / "source-live.png"), full_page=True)
        page.get_by_role("button", name="Source view").click()
        note_editor.wait_for(state="visible", timeout=10_000)

        content = note_editor.locator(".cm-content")
        content.click()
        page.keyboard.press("Control+End")
        format_target = "format_target"
        page.keyboard.type(f"\n{format_target}")
        page.wait_for_timeout(650)
        for _ in format_target:
            page.keyboard.press("Shift+ArrowLeft")

        assert page.locator('[role="toolbar"][aria-label="Format selection"]').count() == 0
        page.screenshot(path=str(output / "source-selection-no-toolbar.png"), full_page=True)

        page.keyboard.press("Control+b")
        bold_line = note_editor.locator(".cm-line").last.text_content()
        assert bold_line == f"**{format_target}**", bold_line
        assert page.get_by_label("Vault files").is_visible()
        page.keyboard.press("Control+z")

        page.keyboard.press("Control+h")
        highlight_line = note_editor.locator(".cm-line").last.text_content()
        assert highlight_line == f"=={format_target}==", highlight_line
        page.keyboard.press("Control+z")
        page.keyboard.press("Control+z")

        open_file(page, "interactives/normal-canvas/index.html")
        code_editor = page.locator('.cm-editor[data-source-kind="code"]')
        code_editor.wait_for(state="visible", timeout=20_000)
        code_editor.locator(".cm-scroller").click(position={"x": 120, "y": 180})
        code = editor_snapshot(page)
        assert code["wrap"] == "off", code
        assert "cm-wrap-off" in str(code["classes"]), code
        assert float(code["contentWidth"]) + float(code["gutterWidth"]) + 1 >= float(code["scrollerClientWidth"]), code
        assert float(code["scrollLeft"]) == 0, code
        code_status = page.locator("footer").inner_text()
        assert "Ln " in code_status and "HTML" in code_status, code_status
        page.screenshot(path=str(output / "source-code.png"), full_page=True)

        page.keyboard.press("Control+Comma")
        settings = page.get_by_role("dialog", name="Settings")
        settings.wait_for(state="visible", timeout=10_000)
        settings.get_by_role("button", name="Editor", exact=True).click()
        settings.get_by_role("heading", name="Editor", exact=True).wait_for()
        assert settings.get_by_role("radio", name="Maple Mono Distinct source-editing voice").is_checked()
        settings.locator("#editor-font-size").fill("15")
        page.wait_for_function(
            "getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '15px'"
        )
        settings.locator("#editor-font-size").fill("14")
        page.screenshot(path=str(output / "source-settings.png"), full_page=True)
        page.keyboard.press("Escape")
        settings.wait_for(state="hidden")

        assert not page_errors, page_errors
        assert not console_errors, console_errors
        result = {
            "note": note,
            "live": live,
            "code": code,
            "formatting": {
                "toolbarCount": 0,
                "bold": bold_line,
                "highlight": highlight_line,
            },
            "status": {"note": note_status, "code": code_status},
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "screenshots": sorted(path.name for path in output.glob("source-*.png")),
        }
        (output / "source-editor-live-results.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n"
        )
        print(json.dumps(result, indent=2, ensure_ascii=True))
        browser.close()


if __name__ == "__main__":
    main()
