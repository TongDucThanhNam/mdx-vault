"""Live Electron verification for GOAL-29 through the existing CDP test boundary."""

from __future__ import annotations

import argparse
import json
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
        if page.url.startswith(("http://localhost:", "file://")):
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
    page.keyboard.press("Control+P")
    dialog.wait_for(state="visible", timeout=5_000)
    query = page.get_by_role(
        "combobox", name="Search files by title, alias, path, or extension"
    )
    query.fill(relative_path)
    option = dialog.get_by_role("option").filter(has_text=relative_path).first
    option.wait_for(state="visible", timeout=10_000)
    option.click()
    dialog.wait_for(state="hidden", timeout=15_000)


def ensure_context_panel(page: Page) -> None:
    show = page.get_by_role("button", name="Show context panel")
    if show.count() > 0 and show.first.is_visible():
        show.first.click()
    page.get_by_label("Context utility").select_option("outline")
    page.get_by_text("On this note", exact=True).wait_for(state="visible", timeout=5_000)


def active_outline_label(page: Page) -> str:
    return page.locator('button[aria-current="location"]').get_attribute("aria-label") or ""


def find_in_editor(page: Page, query: str) -> None:
    line = page.locator(".cm-editor:visible .cm-line").filter(has_text=query).first
    line.scroll_into_view_if_needed()
    line.click(position={"x": 180, "y": 8})


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []
    external_requests: list[str] = []
    evidence: dict[str, object] = {}

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
                  await window.appApi.updateSettings({
                    theme: 'light',
                    locale: 'en',
                    defaultNoteView: 'source'
                  })
                  await window.vaultApi.openVaultPath(vaultPath)
                  window.location.reload()
                }""",
                str(Path(args.vault).resolve()),
            )
        except (PlaywrightError, PlaywrightTimeoutError):
            pass

        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        open_file(page, "notes/GOAL-23 Preview Target.mdx")
        page.get_by_role("button", name="Source view").click()
        page.locator('.cm-editor[data-display-mode="source"]').wait_for(
            state="visible", timeout=15_000
        )
        ensure_context_panel(page)

        outline_buttons = page.locator('button[aria-label^="Heading level"]')
        assert outline_buttons.count() == 7, outline_buttons.count()
        assert "Preview target" in active_outline_label(page)

        find_in_editor(page, "Later section")
        page.wait_for_function(
            "document.querySelector('button[aria-current=\"location\"]')?.getAttribute('aria-label')?.includes('Later section')"
        )
        evidence["sourceCaret"] = active_outline_label(page)

        generated_sections = "\n\n".join(
            f"## Runtime Section {index}\nRuntime proof body {index}." for index in range(1, 31)
        )
        editor_content = page.locator(".cm-editor:visible .cm-content")
        editor_content.click()
        page.keyboard.press("Control+End")
        page.keyboard.insert_text(f"\n\n{generated_sections}\n")
        final_heading = page.get_by_role(
            "button", name="Heading level 2: Runtime Section 30"
        )
        final_heading.wait_for(state="visible", timeout=10_000)
        page.wait_for_function(
            "document.querySelector('button[aria-current=\"location\"]')?.getAttribute('aria-label')?.includes('Runtime Section 30')"
        )
        evidence["unsavedHeadingCount"] = outline_buttons.count()
        assert evidence["unsavedHeadingCount"] == 37

        outline_scroll = page.locator(
            "#context-utility-panel-outline > div > div.overflow-auto"
        )
        source_outline_scroll_top = outline_scroll.evaluate("element => element.scrollTop")
        assert source_outline_scroll_top > 0
        evidence["longOutlineScrollTop"] = source_outline_scroll_top
        page.screenshot(path=str(output / "goal-29-source-live-outline.png"), full_page=True)

        page.get_by_role("button", name="Reading view").click()
        reading = page.get_by_test_id("reading-preview-scroll")
        reading.wait_for(state="visible", timeout=20_000)
        page.locator('[data-mdx-heading-id="runtime-section-30"]').wait_for(
            state="attached", timeout=20_000
        )
        assert page.locator('[data-mdx-heading-id="caching"]').count() == 1
        assert page.locator('[data-mdx-heading-id="caching-2"]').count() == 1

        reading.evaluate(
            "element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')) }"
        )
        page.wait_for_function(
            "document.querySelector('button[aria-current=\"location\"]')?.getAttribute('aria-label')?.includes('Preview target')"
        )
        evidence["readingTop"] = active_outline_label(page)

        reading.evaluate(
            "element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event('scroll')) }"
        )
        page.wait_for_function(
            "document.querySelector('button[aria-current=\"location\"]')?.getAttribute('aria-label')?.includes('Runtime Section 30')"
        )
        evidence["readingBottom"] = active_outline_label(page)

        connector = page.locator(
            "#context-utility-panel-outline ol > svg.pointer-events-none"
        )
        connector.wait_for(state="visible", timeout=5_000)
        assert connector.get_attribute("aria-hidden") == "true"
        assert connector.locator("path").count() == 2
        evidence["connectorPath"] = connector.locator("path").first.get_attribute("d")
        page.screenshot(path=str(output / "goal-29-reading-scrollspy.png"), full_page=True)

        page.keyboard.press("Control+Shift+F")
        search_dialog = page.get_by_role("dialog", name="Search notes")
        search_dialog.wait_for(state="visible", timeout=5_000)
        search_input = search_dialog.get_by_label("Search notes")
        search_input.fill("independently scrollable")
        section_result = search_dialog.get_by_role("button").filter(has_text="Later section")
        section_result.wait_for(state="visible", timeout=15_000)
        assert "H3" in section_result.inner_text()
        section_result.click()
        search_dialog.wait_for(state="hidden", timeout=10_000)
        page.wait_for_timeout(500)
        later_position = page.evaluate(
            """() => {
              const root = document.querySelector('[data-testid="reading-preview-scroll"]')
              const heading = document.querySelector('[data-mdx-heading-id="later-section"]')
              if (!(root instanceof HTMLElement) || !(heading instanceof HTMLElement)) return null
              return {
                scrollTop: root.scrollTop,
                offset: heading.getBoundingClientRect().top - root.getBoundingClientRect().top,
              }
            }"""
        )
        assert later_position and later_position["scrollTop"] > 0
        assert later_position["offset"] < 140
        evidence["sectionSearchReveal"] = later_position

        set_window_size(page, 1000, 800)
        page.wait_for_function(
            "document.querySelector('main[data-layout-mode]')?.getAttribute('data-layout-mode') === 'compact'"
        )
        dock = page.locator('[data-supplementary-dock="overlay"]')
        dock.wait_for(state="visible", timeout=5_000)
        assert page.get_by_role("tab", name="Context").get_attribute("aria-selected") == "true"
        evidence["compactDockWidth"] = dock.evaluate(
            "element => element.getBoundingClientRect().width"
        )
        page.screenshot(path=str(output / "goal-29-compact-outline.png"), full_page=True)

        browser.close()

    filtered_console_errors = [
        message
        for message in console_errors
        if "Download the React DevTools" not in message
    ]
    assert not filtered_console_errors, filtered_console_errors
    assert not page_errors, page_errors
    assert not external_requests, external_requests
    result = {
        "evidence": evidence,
        "consoleErrors": filtered_console_errors,
        "pageErrors": page_errors,
        "externalRequests": external_requests,
        "screenshots": sorted(path.name for path in output.glob("goal-29-*.png")),
    }
    (output / "goal-29-live-results.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
