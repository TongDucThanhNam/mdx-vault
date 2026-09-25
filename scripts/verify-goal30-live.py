"""Live Electron verification for GOAL-30 through the existing CDP test boundary."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", default="http://127.0.0.1:9334")
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
        set_window_size(page, 1180, 760)

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
        main_menu = page.get_by_role("button", name="Main menu")
        vault_selector = page.get_by_role("button", name="Switch vault: example-vault")
        main_menu.wait_for(state="visible")
        vault_selector.wait_for(state="visible")
        header = page.locator("header").first
        resting_text = header.inner_text()
        assert "mdx vault" not in resting_text.lower()
        assert all(label not in resting_text.splitlines() for label in ("File", "Edit", "View", "Go", "Window"))
        evidence["restingHeaderText"] = resting_text.splitlines()
        evidence["vaultSelectorWidth"] = vault_selector.evaluate(
            "element => element.getBoundingClientRect().width"
        )

        main_menu.click()
        categories = ["File", "Edit", "View", "Go", "Window"]
        for category in categories:
            page.get_by_role("menuitem", name=category, exact=True).wait_for(state="visible")
        evidence["menuCategories"] = categories
        page.screenshot(path=str(output / "goal-30-compact-menu.png"), full_page=True)

        page.get_by_role("menuitem", name="File", exact=True).hover()
        page.get_by_role("menuitem", name="Open Vault…", exact=True).wait_for(state="visible")
        page.get_by_role("menuitem").filter(has_text="Settings…").wait_for(state="visible")
        evidence["fileMenuOpen"] = True
        page.screenshot(path=str(output / "goal-30-file-submenu.png"), full_page=True)

        page.keyboard.press("Escape")
        page.keyboard.press("Escape")
        page.get_by_role("menuitem", name="File", exact=True).wait_for(state="hidden")

        main_menu.focus()
        page.keyboard.press("Enter")
        file_group = page.get_by_role("menuitem", name="File", exact=True)
        file_group.wait_for(state="visible")
        file_group.focus()
        page.keyboard.press("ArrowRight")
        page.get_by_role("menuitem").filter(has_text="New Note…").wait_for(state="visible")
        evidence["keyboardSubmenu"] = True
        page.keyboard.press("Escape")
        page.keyboard.press("Escape")

        set_window_size(page, 680, 720)
        vault_selector.wait_for(state="visible")
        assert vault_selector.inner_text() == "example-vault"
        evidence["narrowVaultSelectorWidth"] = vault_selector.evaluate(
            "element => element.getBoundingClientRect().width"
        )
        page.screenshot(path=str(output / "goal-30-narrow-titlebar.png"), full_page=True)
        browser.close()

    assert not console_errors, console_errors
    assert not page_errors, page_errors
    assert not external_requests, external_requests
    result = {
        "evidence": evidence,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "externalRequests": external_requests,
        "screenshots": sorted(path.name for path in output.glob("goal-30-*.png")),
    }
    (output / "goal-30-live-results.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
