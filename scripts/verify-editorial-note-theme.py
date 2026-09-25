from pathlib import Path
from tempfile import gettempdir

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_DIRECTORY = Path(gettempdir()) / "mdx-vault-verification"
SCREENSHOT_DIRECTORY.mkdir(parents=True, exist_ok=True)
DESKTOP_SCREENSHOT = SCREENSHOT_DIRECTORY / "editorial-note-desktop.png"
NARROW_SCREENSHOT = SCREENSHOT_DIRECTORY / "editorial-note-narrow.png"

FONT_STYLES = [
    ROOT / "node_modules/@fontsource/courier-prime/400.css",
    ROOT / "node_modules/@fontsource/courier-prime/700.css",
    ROOT / "node_modules/@fontsource/lora/400.css",
    ROOT / "node_modules/@fontsource/lora/400-italic.css",
    ROOT / "node_modules/@fontsource/playfair-display/700.css",
    ROOT / "node_modules/@fontsource/playfair-display/900.css",
]


def fs_url(path: Path) -> str:
    return f"http://localhost:5173/@fs/{path.as_posix()}"


style_modules = [
    "http://localhost:5173/src/globals.css",
    "http://localhost:5173/src/preview/interactive-note-theme.css",
    *(fs_url(path) for path in FONT_STYLES),
]
fixture = f"""
<!doctype html>
<html class="dark">
  <head>
    <meta charset="utf-8">
    <base href="http://localhost:5173/">
    <style>
      html, body {{ margin: 0; min-height: 100%; }}
      body {{ background: #0f141a; padding: 32px; }}
      .fixture-shell {{ max-width: 980px; margin: 0 auto; border: 1px solid #384554; background: #121921; padding: 18px; }}
      .note-editorial-surface {{ max-height: none; overflow: visible; }}
      .mdx-preview {{ max-width: 820px; margin: 0 auto; padding: 48px; }}
      @media (max-width: 700px) {{
        body {{ padding: 0; }}
        .fixture-shell {{ padding: 0; border: 0; }}
        .mdx-preview {{ padding: 28px 20px 48px; }}
      }}
    </style>
  </head>
  <body>
    <div class="fixture-shell">
      <div class="note-editorial-surface">
        <article class="mdx-preview theme-editorial-note">
          <p class="note-kicker">System note · design contract</p>
          <h1>Editorial systems for software engineers</h1>
          <p class="note-deck">A local-first note should read like a printed technical essay, while interactive evidence remains precise.</p>
          <p><mark>One red ink</mark> carries emphasis. Inline <code>const result = measure()</code> stays machine-like.</p>
          <h2>Paper, ink, and rules</h2>
          <blockquote>Depth comes from hard offset shadows, never blur or glow.</blockquote>
          <div class="note-panel note-panel-accent">Public primitives carry the same visual DNA as trusted components.</div>
          <div class="mdx-callout" data-callout="tip">
            <div class="mdx-callout-title">Implementation note</div>
            <p>App chrome stays dark here; the note remains literal ivory paper.</p>
          </div>
          <pre><code><span class="hljs-keyword">function</span> proof(value) {{
  return value * 2
}}</code></pre>
          <div class="in-widget">
            <div class="in-widget-head"><span>Latency explorer</span><span class="in-widget-status">Ready</span></div>
            <div class="in-widget-body">
              <label for="latency">Threshold</label>
              <input id="latency" type="range" min="0" max="100" value="60">
              <output class="note-result">Computed result · 42.8 ms</output>
              <button id="paper-button" type="button">Run model</button>
            </div>
          </div>
          <table>
            <thead><tr><th>Mode</th><th>Invariant</th></tr></thead>
            <tbody><tr><td>Reading</td><td>Lora on paper</td></tr><tr><td>Source</td><td>Maple Mono stays IDE-like</td></tr></tbody>
          </table>
          <details><summary>Why no rounded cards?</summary><p>The page is governed by ink rules, not soft app elevation.</p></details>
          <footer class="note-folio">Editorial note · renderer/export parity</footer>
        </article>
      </div>
    </div>
  </body>
</html>
"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1200}, device_scale_factor=1)
    module_errors: list[str] = []
    page.on("console", lambda message: module_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: module_errors.append(str(error)))
    page.route(
        "http://localhost:5173/editorial-fixture",
        lambda route: route.fulfill(body=fixture, content_type="text/html"),
    )
    page.goto("http://localhost:5173/editorial-fixture", wait_until="networkidle")
    try:
        page.evaluate(
            "async (modules) => { await Promise.all(modules.map((module) => import(module))) }",
            style_modules,
        )
    except Exception as error:
        raise RuntimeError({"url": page.url, "errors": module_errors}) from error
    page.evaluate("document.fonts.ready")

    computed = page.evaluate(
        """
        () => {
          const style = (selector) => getComputedStyle(document.querySelector(selector))
          const note = style('.theme-editorial-note')
          const heading = style('h1')
          const paragraph = style('.note-deck')
          const kicker = style('.note-kicker')
          const panel = style('.note-panel')
          const result = style('.note-result')
          const code = style('code')
          const button = style('#paper-button')
          const shell = style('body')
          return {
            shellBackground: shell.backgroundColor,
            noteBackground: note.backgroundColor,
            noteColor: note.color,
            headingFont: heading.fontFamily,
            headingRail: heading.borderLeftWidth,
            paragraphFont: paragraph.fontFamily,
            kickerFont: kicker.fontFamily,
            panelBorder: panel.borderLeftWidth,
            resultBackground: result.backgroundColor,
            codeFont: code.fontFamily,
            buttonFont: button.fontFamily,
            buttonBorder: button.borderTopWidth,
            buttonRadius: button.borderTopLeftRadius,
            buttonShadow: button.boxShadow,
          }
        }
        """
    )

    assert computed["shellBackground"] == "rgb(15, 20, 26)", computed
    assert computed["noteBackground"] == "rgb(249, 249, 247)", computed
    assert computed["noteColor"] == "rgb(17, 17, 17)", computed
    assert "Playfair Display" in computed["headingFont"], computed
    assert computed["headingRail"] == "6px", computed
    assert "Lora" in computed["paragraphFont"], computed
    assert "Courier Prime" in computed["kickerFont"], computed
    assert computed["panelBorder"] == "5px", computed
    assert computed["resultBackground"] == "rgb(43, 87, 151)", computed
    assert "Courier Prime" in computed["codeFont"], computed
    assert "Courier Prime" in computed["buttonFont"], computed
    assert computed["buttonBorder"] == "2px", computed
    assert computed["buttonRadius"] == "0px", computed
    assert computed["buttonShadow"] == "rgb(17, 17, 17) 2px 2px 0px 0px", computed

    page.locator("#paper-button").focus()
    focus_outline = page.locator("#paper-button").evaluate(
        "element => ({ style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth })"
    )
    assert focus_outline == {"style": "solid", "width": "3px"}, focus_outline

    button_box = page.locator("#paper-button").bounding_box()
    assert button_box is not None
    page.mouse.move(button_box["x"] + button_box["width"] / 2, button_box["y"] + button_box["height"] / 2)
    page.mouse.down()
    pressed = page.locator("#paper-button").evaluate(
        "element => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow })"
    )
    assert pressed == {"transform": "matrix(1, 0, 0, 1, 2, 2)", "shadow": "none"}, pressed
    page.mouse.up()

    page.screenshot(path=str(DESKTOP_SCREENSHOT), full_page=True)
    page.set_viewport_size({"width": 620, "height": 1100})
    narrow = page.evaluate(
        "() => ({ titleRail: getComputedStyle(document.querySelector('h1')).borderLeftWidth, tableDisplay: getComputedStyle(document.querySelector('table')).display })"
    )
    assert narrow == {"titleRail": "5px", "tableDisplay": "block"}, narrow
    page.screenshot(path=str(NARROW_SCREENSHOT), full_page=True)

    page.emulate_media(media="print")
    print_contract = page.locator(".note-panel").evaluate(
        "element => getComputedStyle(element).breakInside"
    )
    assert print_contract == "avoid-page", print_contract
    print({"computed": computed, "narrow": narrow, "print": print_contract, "desktop": str(DESKTOP_SCREENSHOT), "narrowScreenshot": str(NARROW_SCREENSHOT)})
    browser.close()
