from pathlib import Path

from playwright.sync_api import sync_playwright


REPO = Path(__file__).resolve().parents[1]
OUTPUT = REPO / "docs" / "ux" / "goal-24-graph-view" / "baseline-previews"
PREVIEWS = {
    "app-layout": Path(
        "C:/Users/terasumi/Documents/source_code/improve-ux-ui/"
        "artifacts/applayout-20260725T041314Z/preview.html"
    ),
    "main-editor": Path(
        "C:/Users/terasumi/Documents/source_code/improve-ux-ui/"
        "artifacts/maineditor-20260725T042355Z/preview.html"
    ),
    "editor-tabs": Path(
        "C:/Users/terasumi/Documents/source_code/improve-ux-ui/"
        "artifacts/editortabs-20260725T042355Z/preview.html"
    ),
    "right-panel": Path(
        "C:/Users/terasumi/Documents/source_code/improve-ux-ui/"
        "artifacts/rightpanel-20260725T042355Z/preview.html"
    ),
}

INTERACTIONS = {
    "app-layout": "#mobileRightToggle",
    "main-editor": "[data-workbench='global-graph']",
    "editor-tabs": "#openContextButton",
    "right-panel": "#utility-trigger",
}


def inspect_preview(browser, name: str, preview: Path, width: int, height: int) -> dict:
    errors: list[str] = []
    page = browser.new_page(viewport={"width": width, "height": height})
    page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}"))
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.goto(preview.resolve().as_uri())
    page.wait_for_load_state("networkidle")

    selector = INTERACTIONS[name]
    target = page.locator(selector)
    if target.count() and target.first.is_visible():
        try:
            target.first.click(timeout=1_000)
        except Exception as error:
            errors.append(f"interaction-blocked:{type(error).__name__}")
            target.first.click(force=True)
        page.wait_for_timeout(100)

    suffix = "desktop" if width > 500 else "narrow"
    page.screenshot(path=str(OUTPUT / f"{name}-{suffix}.png"), full_page=True)
    metrics = page.evaluate(
        """() => ({
          title: document.title,
          buttons: document.querySelectorAll('button').length,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          visibleText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 220)
        })"""
    )
    metrics["overflow"] = metrics["bodyWidth"] > metrics["viewportWidth"]
    metrics["errors"] = errors
    page.close()
    return metrics


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for name, preview in PREVIEWS.items():
            if not preview.is_file():
                raise FileNotFoundError(preview)
            desktop = inspect_preview(browser, name, preview, 1440, 900)
            narrow = inspect_preview(browser, name, preview, 320, 760)
            print(f"{name}: desktop={desktop}")
            print(f"{name}: narrow={narrow}")
        browser.close()


if __name__ == "__main__":
    main()
