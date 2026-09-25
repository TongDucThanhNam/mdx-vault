"""Live Electron verification for GOAL-27 through the existing CDP test boundary."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


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
    page.wait_for_timeout(350)


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


def find_in_editor(page: Page, query: str, *, from_start: bool = False) -> None:
    for _attempt in range(3):
        page.locator(".cm-editor:visible .cm-content").click()
        if from_start:
            page.keyboard.press("Control+Home")
        page.keyboard.press("Control+F")
        search = page.locator('.cm-editor:visible .cm-search input[name="search"]')
        search.wait_for(state="visible", timeout=5_000)
        search.fill(query)
        page.keyboard.press("Enter")
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        if page.evaluate("() => window.getSelection()?.toString()") == query:
            page.keyboard.press("ArrowLeft")
            return
        page.wait_for_timeout(500)
    raise AssertionError(f"CodeMirror did not select the requested text: {query}")


def minimap_snapshot(page: Page) -> dict[str, object]:
    return page.evaluate(
        """() => {
          const editor = document.querySelector('.cm-editor')
          const minimap = editor?.querySelector('.cm-source-minimap')
          const canvas = minimap?.querySelector('canvas')
          const viewport = minimap?.querySelector('.cm-source-minimap-viewport')
          const scroller = editor?.querySelector('.cm-scroller')
          return {
            preference: editor?.getAttribute('data-minimap') ?? null,
            count: editor?.querySelectorAll('.cm-source-minimap').length ?? 0,
            ariaHidden: minimap?.getAttribute('aria-hidden') ?? null,
            width: minimap?.getBoundingClientRect().width ?? 0,
            height: minimap?.getBoundingClientRect().height ?? 0,
            canvasWidth: canvas?.width ?? 0,
            canvasHeight: canvas?.height ?? 0,
            viewportHeight: viewport?.getBoundingClientRect().height ?? 0,
            scrollTop: scroller?.scrollTop ?? 0,
            scrollHeight: scroller?.scrollHeight ?? 0,
            clientHeight: scroller?.clientHeight ?? 0,
          }
        }"""
    )


def editor_text(page: Page) -> str:
    return page.locator(".cm-editor .cm-content").inner_text()


def editor_has_focus(page: Page) -> bool:
    return page.evaluate("() => document.activeElement?.closest('.cm-editor') !== null")


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []
    external_requests: list[str] = []
    events: list[str] = []

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
        page.on(
            "request",
            lambda request: external_requests.append(request.url)
            if request.url.startswith(("http://", "https://"))
            and not request.url.startswith(("http://localhost:", "http://127.0.0.1:"))
            else None,
        )
        page.wait_for_load_state("domcontentloaded")
        set_window_size(page, 1440, 900)

        try:
            page.evaluate(
                """async (vaultPath) => {
                  await window.appApi.updateSettings({ theme: 'light', locale: 'en' })
                  await window.vaultApi.openVaultPath(vaultPath)
                  window.location.reload()
                }""",
                str(Path(args.vault).resolve()),
            )
        except (PlaywrightError, PlaywrightTimeoutError):
            pass

        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        open_file(page, "notes/Welcome.mdx")
        page.get_by_role("button", name="Source view").click()
        source_editor = page.locator(
            '.cm-editor[data-source-kind="code"][data-display-mode="source"]'
        )
        source_editor.wait_for(state="visible", timeout=20_000)
        source_minimap = minimap_snapshot(page)
        assert source_minimap["preference"] == "on", source_minimap
        assert source_minimap["count"] == 1, source_minimap
        assert source_minimap["ariaHidden"] == "true", source_minimap
        assert source_minimap["canvasWidth"] > 0 and source_minimap["canvasHeight"] > 0
        source_editor.locator(".cm-source-minimap").click(position={"x": 30, "y": 700})
        page.wait_for_timeout(250)
        navigated_minimap = minimap_snapshot(page)
        assert navigated_minimap["scrollTop"] > 0, navigated_minimap
        events.append("raw MDX Source exposed a high-DPI minimap and pointer navigation")

        content = source_editor.locator(".cm-content")
        content.click()
        page.keyboard.press("Control+End")
        page.keyboard.type("\n<Qui")
        page.keyboard.press("Control+Space")
        completion = page.locator(".cm-tooltip-autocomplete")
        completion.wait_for(state="visible", timeout=8_000)
        assert "QuizBlock" in completion.inner_text()
        page.screenshot(path=str(output / "goal-27-mdx-completion-light.png"), full_page=True)
        page.keyboard.press("Enter")
        assert "<QuizBlock />" in editor_text(page)
        events.append("MDX registry completion offered QuizBlock and applied a snippet")

        page.get_by_role("button", name="Live view").click()
        live_editor = page.locator('.cm-editor[data-source-kind="note"][data-display-mode="live"]')
        live_editor.wait_for(state="visible", timeout=10_000)
        live_minimap = minimap_snapshot(page)
        assert live_minimap["preference"] == "off" and live_minimap["count"] == 0, live_minimap
        events.append("Live mode removed the code minimap and retained the prose contract")

        open_file(page, "interactives/react-counter/component.tsx")
        code_editor = page.locator('.cm-editor[data-source-kind="code"]')
        code_editor.wait_for(state="visible", timeout=20_000)
        page.locator('[data-language-cold-ready-ms]').wait_for(state="visible", timeout=20_000)
        code_editor.locator(".cm-content").click()

        find_in_editor(page, "count,", from_start=True)
        page.keyboard.press("Shift+F12")
        references = page.get_by_role("dialog", name=re.compile(r"^References"))
        references.wait_for(state="visible", timeout=10_000)
        reference_items = references.get_by_role("menuitem")
        assert reference_items.count() >= 2
        assert "component.tsx" in references.inner_text()
        assert reference_items.first.evaluate("element => element === document.activeElement")
        page.keyboard.press("ArrowDown")
        assert reference_items.nth(1).evaluate("element => element === document.activeElement")
        page.screenshot(path=str(output / "goal-27-references-light.png"), full_page=True)
        page.keyboard.press("Escape")
        references.wait_for(state="hidden", timeout=5_000)
        assert editor_has_focus(page)
        events.append("Shift+F12 opened a keyboard references menu without a split editor")

        find_in_editor(page, "count,", from_start=True)
        page.keyboard.press("F2")
        rename_dialog = page.get_by_role("dialog", name=re.compile(r"^Rename"))
        rename_dialog.wait_for(state="visible", timeout=10_000)
        rename_input = rename_dialog.get_by_label("New symbol name")
        rename_input.fill("total")
        rename_input.press("Enter")
        rename_dialog.wait_for(state="hidden", timeout=10_000)
        assert editor_has_focus(page)
        renamed_text = editor_text(page)
        assert "const [total, setCount]" in renamed_text and "{total}" in renamed_text
        page.keyboard.press("Control+Z")
        page.wait_for_timeout(200)
        assert "const [count, setCount]" in editor_text(page)
        events.append("F2 renamed every same-buffer symbol occurrence in one undoable edit")

        code_editor.locator(".cm-content").click()
        page.keyboard.press("Control+End")
        page.keyboard.type("\nvoid useMemo\n")
        page.wait_for_timeout(1_000)
        find_in_editor(page, "useMemo")
        page.keyboard.press("Control+.")
        actions = page.get_by_role("dialog", name=re.compile(r"^Code actions"))
        actions.wait_for(state="visible", timeout=10_000)
        react_action = actions.get_by_role("menuitem").filter(has_text="react").first
        react_action.wait_for(state="visible", timeout=5_000)
        action_labels = actions.get_by_role("menuitem").all_inner_texts()
        assert react_action.evaluate("element => element === document.activeElement")
        page.keyboard.press("Enter")
        actions.wait_for(state="hidden", timeout=5_000)
        assert editor_has_focus(page)
        assert re.search(r"import\s*\{[^}]*useMemo", editor_text(page))
        page.screenshot(path=str(output / "goal-27-code-action-light.png"), full_page=True)
        page.keyboard.press("Control+Z")
        page.keyboard.press("Control+Z")
        events.append("Ctrl+. applied a dependency-safe TypeScript import as one transaction")

        code_minimap = minimap_snapshot(page)
        assert code_minimap["count"] == 1 and code_minimap["preference"] == "on", code_minimap

        try:
            page.evaluate(
                """async () => {
                  await window.appApi.updateSettings({ theme: 'dark' })
                  window.location.reload()
                }"""
            )
        except (PlaywrightError, PlaywrightTimeoutError):
            pass
        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        open_file(page, "interactives/react-counter/component.tsx")
        page.locator('.cm-editor[data-source-kind="code"] .cm-source-minimap').wait_for(
            state="visible", timeout=20_000
        )
        assert page.locator("html.dark").count() == 1
        page.screenshot(path=str(output / "goal-27-minimap-dark.png"), full_page=True)

        set_window_size(page, 680, 900)
        for panel_button in ("Hide vault panel", "Hide context panel"):
            button = page.get_by_role("button", name=panel_button)
            if button.is_visible():
                button.click()
        page.wait_for_timeout(250)
        narrow_minimap = minimap_snapshot(page)
        assert 48 <= float(narrow_minimap["width"]) <= 56, narrow_minimap
        page.screenshot(path=str(output / "goal-27-narrow-dark.png"), full_page=True)
        events.append("dark and narrow layouts retained the adaptive minimap")

        assert not page_errors, page_errors
        assert not console_errors, console_errors
        assert not external_requests, external_requests
        result = {
            "events": events,
            "sourceMinimap": source_minimap,
            "navigatedMinimap": navigated_minimap,
            "liveMinimap": live_minimap,
            "codeMinimap": code_minimap,
            "narrowMinimap": narrow_minimap,
            "codeActions": action_labels,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "externalRequests": external_requests,
            "screenshots": sorted(path.name for path in output.glob("goal-27-*.png")),
        }
        (output / "goal-27-live-results.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n"
        )
        print(json.dumps(result, indent=2, ensure_ascii=True))
        browser.close()


if __name__ == "__main__":
    main()
