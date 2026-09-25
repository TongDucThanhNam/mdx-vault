"""Live Electron verification for GOAL-26 via Playwright over CDP.

The caller owns the disposable vault and user-data lifecycle. This script only
uses visible UI and the app's narrow preload bridge to select that fixture.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", default="http://127.0.0.1:9222")
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


def emulate_viewport(page: Page, width: int, height: int) -> None:
    session = page.context.new_cdp_session(page)
    session.send(
        "Emulation.setDeviceMetricsOverride",
        {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False,
        },
    )
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
            page.wait_for_timeout(750)
    query = page.get_by_role(
        "combobox", name="Search files by title, alias, path, or extension"
    )
    query.fill(relative_path)
    option = dialog.get_by_role("option").filter(has_text=relative_path).first
    option.wait_for(state="visible", timeout=10_000)
    option.click()
    dialog.wait_for(state="hidden", timeout=15_000)


def shell_snapshot(page: Page) -> dict[str, object]:
    return page.evaluate(
        """() => {
          const workspace = document.querySelector('[data-layout-mode]')
          const documentSurface = document.querySelector('[data-document-surface="active"]')
          const dock = document.querySelector('[data-supplementary-dock]')
          const rect = documentSurface?.getBoundingClientRect()
          const dockRect = dock?.getBoundingClientRect()
          return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            mode: workspace?.getAttribute('data-layout-mode'),
            documentWidth: rect?.width ?? 0,
            dockKind: dock?.getAttribute('data-supplementary-dock') ?? null,
            dockWidth: dockRect?.width ?? 0,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
            rootFontSize: getComputedStyle(document.documentElement).fontSize,
            language: document.documentElement.lang,
            dark: document.documentElement.classList.contains('dark'),
            density: document.documentElement.dataset.density ?? null,
          }
        }"""
    )


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []
    events: list[str] = []
    measurements: dict[str, dict[str, object]] = {}

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

        try:
            page.evaluate(
                """async (vaultPath) => {
                  await window.appApi.updateSettings({
                    theme: 'light', locale: 'en', density: 'comfortable', uiScale: 100
                  })
                  await window.vaultApi.openVaultPath(vaultPath)
                  window.location.reload()
                }""",
                str(Path(args.vault).resolve()),
            )
        except (PlaywrightError, PlaywrightTimeoutError):
            pass

        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        open_file(page, "notes/Cache Hierarchy & Locality.mdx")
        page.get_by_role("button", name="Reading view").click()
        evidence_buttons = page.locator('[data-evidence-rail="headings"] button')
        evidence_buttons.first.wait_for(state="visible", timeout=20_000)
        assert evidence_buttons.count() > 0
        events.append("opened a heading-rich note and exposed named Evidence Rail controls")

        if page.get_by_role("button", name="Show context panel").count():
            page.get_by_role("button", name="Show context panel").click()
        ai_toggle = page.get_by_role("button", name="Toggle AI assistant")
        if ai_toggle.get_attribute("aria-pressed") != "true":
            ai_toggle.click()
        ai_settings = page.get_by_role("alertdialog", name="AI assistant")
        try:
            ai_settings.wait_for(state="visible", timeout=2_000)
            ai_settings.get_by_role("button", name="Close").click()
            ai_settings.wait_for(state="hidden")
        except PlaywrightTimeoutError:
            pass
        page.locator('[data-supplementary-dock="tracked"]').wait_for(timeout=10_000)
        measurements["wide"] = shell_snapshot(page)
        assert measurements["wide"]["mode"] == "wide"
        assert measurements["wide"]["dockKind"] == "tracked"
        page.screenshot(path=str(output / "goal-26-wide-light.png"), full_page=True)
        events.append("wide mode kept Context and AI as tracked supplementary regions")

        page.emulate_media(reduced_motion="reduce")
        reduced_motion_style = ai_toggle.evaluate(
            """node => ({
              property: getComputedStyle(node).transitionProperty,
              duration: getComputedStyle(node).transitionDuration
            })"""
        )
        assert reduced_motion_style["property"] == "none"
        page.emulate_media(reduced_motion="no-preference")
        events.append("reduced-motion media preference removed control transitions")

        emulate_viewport(page, 1024, 760)
        page.locator('[data-layout-mode="compact"]').wait_for(timeout=10_000)
        tablist = page.get_by_role("tablist", name="Supplementary dock")
        tablist.wait_for(state="visible")
        context_tab = page.locator("#supplementary-context-tab")
        context_tab.focus()
        context_tab.press("ArrowRight")
        ai_tab = page.locator("#supplementary-ai-tab")
        assert ai_tab.get_attribute("aria-selected") == "true"
        assert page.evaluate("document.activeElement?.id") == "supplementary-ai-tab"
        measurements["compact"] = shell_snapshot(page)
        assert measurements["compact"]["dockKind"] == "overlay"
        assert float(measurements["compact"]["horizontalOverflow"]) <= 1
        page.screenshot(path=str(output / "goal-26-compact-light-initial.png"), full_page=True)
        events.append("compact dock overlaid the document and passed keyboard tab switching")

        page.keyboard.press("Control+Comma")
        settings = page.get_by_role("dialog", name="Settings")
        settings.wait_for(state="visible", timeout=10_000)
        settings.get_by_text("Tiếng Việt", exact=True).click()
        page.wait_for_function("document.documentElement.lang === 'vi'")
        settings.get_by_text("Compact", exact=True).click()
        page.locator('input[name="settings-ui-scale"]').fill("110")
        settings.get_by_text("Dark", exact=True).click()
        page.wait_for_function("document.documentElement.classList.contains('dark')")
        page.screenshot(path=str(output / "goal-26-settings.png"), full_page=True)
        page.keyboard.press("Escape")
        settings.wait_for(state="hidden")
        page.get_by_role("button", name="Ẩn bảng vault").wait_for(state="visible")
        events.append("Vietnamese, compact density, 110% scale, and dark theme applied live")

        page.get_by_role("button", name="Ẩn bảng vault").click()
        emulate_viewport(page, 640, 720)
        page.locator('[data-layout-mode="overlay"]').wait_for(timeout=10_000)
        measurements["overlay"] = shell_snapshot(page)
        assert float(measurements["overlay"]["horizontalOverflow"]) <= 1
        page.screenshot(path=str(output / "goal-26-overlay-dark-vi.png"), full_page=True)
        events.append("overlay mode preserved the document at a 640 CSS-pixel viewport")

        page.get_by_role("button", name="Ẩn bảng ngữ cảnh").click()
        page.get_by_role("button", name="Ẩn bảng AI").click()
        page.locator('[data-supplementary-dock="overlay"]').wait_for(state="hidden")
        emulate_viewport(page, 490, 700)
        page.locator('[data-layout-mode="overlay"]').wait_for(timeout=10_000)
        measurements["zoom_200_equivalent"] = shell_snapshot(page)
        assert float(measurements["zoom_200_equivalent"]["horizontalOverflow"]) <= 1
        evidence_buttons.first.click()
        events.append("490 CSS-pixel / 200%-equivalent view remained operable without root overflow")

        emulate_viewport(page, 1024, 760)
        page.keyboard.press("Control+Comma")
        settings.wait_for(state="visible", timeout=10_000)
        settings.get_by_text("Light", exact=True).click()
        page.wait_for_function("!document.documentElement.classList.contains('dark')")
        page.keyboard.press("Escape")
        measurements["light"] = shell_snapshot(page)
        page.screenshot(path=str(output / "goal-26-compact-light.png"), full_page=True)
        events.append("light theme applied without reload")

        assert not page_errors, page_errors
        assert not console_errors, console_errors
        result = {
            "events": events,
            "measurements": measurements,
            "reducedMotionTransition": reduced_motion_style,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "screenshots": sorted(path.name for path in output.glob("goal-26-*.png")),
        }
        (output / "goal-26-live-results.json").write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n"
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
