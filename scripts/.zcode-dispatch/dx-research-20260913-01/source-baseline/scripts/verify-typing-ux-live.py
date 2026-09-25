"""Measure and exercise the actual Electron editor in a disposable vault/profile.

Start dev with MDX_VAULT_TEST_USER_DATA pointing to a disposable temp directory
and --remoteDebuggingPort 9333. Never run this against a personal profile.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

helper_spec = importlib.util.spec_from_file_location(
    "source_editor_live", Path(__file__).with_name("verify-source-editor-live.py")
)
assert helper_spec and helper_spec.loader
helper = importlib.util.module_from_spec(helper_spec)
helper_spec.loader.exec_module(helper)
app_page, open_file, set_window_size = helper.app_page, helper.open_file, helper.set_window_size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cdp", default="http://127.0.0.1:9333")
    parser.add_argument("--output", required=True)
    parser.add_argument("--phase", choices=["before", "after"], default="before")
    parser.add_argument("--checks-only", action="store_true", help="Keep the recorded performance run unchanged")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    vault = Path(tempfile.mkdtemp(prefix="mdx-vault-typing-fixture-"))
    (vault / "notes").mkdir()
    (vault / "notes" / "Editor.mdx").write_text(
        "# Editor workshop\n\nPrecise editing, at the speed of thought.\n\n"
        "## Working notes\n\n- Research the interaction\n- Test the behavior\n\n"
        '<Callout type="info" title="Writing with intent">\n'
        "  Keep Markdown readable and components deliberate.\n</Callout>\n",
        encoding="utf-8",
    )
    (vault / "notes" / "Large.mdx").write_text(
        "# Large document\n\n"
        + "".join(
            f"## Section {i}\n\nA paragraph about editing and evidence.\n\n"
            "```ts\nconst example = { count: 1 }\n```\n\n"
            for i in range(700)
        ),
        encoding="utf-8",
    )
    (vault / "sample.ts").write_text("function greet() {\n    return 'hello'\n}\n", encoding="utf-8")
    results: dict = {"phase": args.phase, "vault": str(vault), "checks": {}}
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(args.cdp)
        page = app_page(browser.contexts[0].pages)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.wait_for_load_state("networkidle")
        print(f"Running {args.phase} verification in a disposable vault", flush=True)
        set_window_size(page, 1440, 960)
        page.evaluate(
            """async vault => {
              await window.appApi.updateSettings({locale:'en', theme:'light',
                editorTabSize:'4', defaultNoteView:'source'});
              await window.vaultApi.openVaultPath(vault);
            }""",
            str(vault),
        )
        page.reload()
        page.get_by_label("Vault files").wait_for(timeout=30_000)
        open_file(page, "notes/Editor.mdx")
        page.get_by_role("button", name="Source view").click()
        page.locator(".cm-content").wait_for()
        # Inspect the rendered editor before selecting it; the internal view is
        # used only by this dev harness to take precise state/timing snapshots.
        page.evaluate("""() => {
          window.typingView = () => document.querySelector('.cm-content').cmTile?.root?.view;
          if (!window.typingView()) throw Error('Editor view unavailable');
          window.typingReset = (doc, anchor = doc.length) => {
            const view = window.typingView();
            view.dispatch({changes:{from:0,to:view.state.doc.length,insert:doc},
              selection:{anchor}});
            view.focus();
          };
          window.typingSnapshot = () => {
            const v = window.typingView();
            return {text:v.state.sliceDoc(), ranges:v.state.selection.ranges.map(r=>({
              anchor:r.anchor, head:r.head})), scrollTop:v.scrollDOM.scrollTop};
          };
        }""")
        if args.phase == "after":
            page.evaluate("window.originalTypingView = typingView()")
            original = page.evaluate("typingSnapshot()")
            page.get_by_role("button", name="Editor appearance", exact=True).click()
            appearance = page.get_by_role("dialog", name="Editor appearance")
            appearance.get_by_role("button", name="Comfortable", exact=True).click()
            page.wait_for_function("document.documentElement.dataset.editorFont === 'jetbrains-mono'")
            page.wait_for_function("document.querySelector('fieldset')?.getAttribute('aria-busy') !== 'true'")
            spacing = appearance.get_by_role("slider", name="Line spacing")
            spacing.focus()
            for _ in range(2):
                page.keyboard.press("ArrowRight")
                page.wait_for_function("document.querySelector('fieldset')?.getAttribute('aria-busy') !== 'true'")
                assert spacing.evaluate("element => element === document.activeElement")
            assert page.evaluate("async () => (await window.appApi.getSettings()).editorLineHeight") == 1.7
            appearance.get_by_role("button", name="Comfortable", exact=True).click()
            page.wait_for_function("document.querySelector('fieldset')?.getAttribute('aria-busy') !== 'true'")
            page.evaluate("document.fonts.ready")
            page.screenshot(path=str(output / "after-appearance.png"))
            page.keyboard.press("Escape")
            assert page.evaluate("typingView() === window.originalTypingView")
            assert page.evaluate("typingSnapshot().text") == original["text"]
            assert page.evaluate("typingSnapshot().ranges") == original["ranges"]
            page.wait_for_timeout(300)
            results["geometry"] = page.evaluate("""() => {
              const v = typingView(); const style = getComputedStyle(v.scrollDOM);
              const line = v.contentDOM.querySelector('.cm-line');
              const gutter = v.dom.querySelector('.cm-lineNumbers .cm-gutterElement');
              return {font:style.fontFamily, size:style.fontSize, lineHeight:style.lineHeight,
                horizontalOverflow:v.scrollDOM.scrollWidth-v.scrollDOM.clientWidth,
                gutterSize:getComputedStyle(gutter).fontSize,
                linePadding:getComputedStyle(line).paddingLeft};
            }""")
            assert results["geometry"]["horizontalOverflow"] <= 1, results["geometry"]
            assert results["geometry"]["size"] == "15px"
            assert results["geometry"]["lineHeight"] == "24px"
            assert results["geometry"]["gutterSize"] == "15px"
            page.get_by_role("button", name="Live view").click()
            page.wait_for_timeout(300)
            results["liveGeometry"] = page.evaluate("""() => {
              const v=typingView(), style=getComputedStyle(v.scrollDOM);
              return {font:style.fontFamily,size:style.fontSize,lineHeight:style.lineHeight,
                horizontalOverflow:v.scrollDOM.scrollWidth-v.scrollDOM.clientWidth};
            }""")
            page.screenshot(path=str(output / "after-live.png"))
            assert results["liveGeometry"]["size"] == "15px"
            assert results["liveGeometry"]["lineHeight"] == "24px"
            page.get_by_role("button", name="Source view").click()
            page.evaluate("document.documentElement.classList.add('dark')")
            page.wait_for_timeout(400)
            page.screenshot(path=str(output / "after-dark.png"))
            page.evaluate("document.documentElement.classList.remove('dark')")
            page.wait_for_timeout(400)
            set_window_size(page, 800, 800)
            page.get_by_role("button", name="Editor appearance", exact=True).click()
            page.screenshot(path=str(output / "after-narrow.png"))
            page.keyboard.press("Escape")
            set_window_size(page, 1440, 960)
        page.screenshot(path=str(output / f"{args.phase}-source.png"))
        page.wait_for_timeout(250)
        page.evaluate("typingReset('alpha beta', 5)")
        page.wait_for_timeout(150)
        page.evaluate("typingView().dispatch({selection:{anchor:5}}); typingView().focus()")
        page.keyboard.press("Tab")
        results["checks"]["tabAtCaret"] = page.evaluate("typingSnapshot()")
        open_file(page, "sample.ts")
        page.locator(".cm-content").wait_for()
        page.wait_for_timeout(250)
        page.evaluate("typingReset('function greet() {}', 18)")
        page.wait_for_timeout(150)
        page.evaluate("typingView().dispatch({selection:{anchor:18}}); typingView().focus()")
        page.keyboard.press("Enter")
        results["checks"]["enterIndent"] = page.evaluate("typingSnapshot()")
        open_file(page, "notes/Editor.mdx")
        page.wait_for_timeout(300)
        page.evaluate("typingReset('<Qui')")
        page.wait_for_timeout(100)
        page.keyboard.press("Control+Space")
        page.locator(".cm-tooltip-autocomplete").wait_for()
        page.wait_for_timeout(150)
        page.screenshot(path=str(output / f"{args.phase}-completion.png"))
        page.keyboard.press("Tab")
        results["checks"]["tabCompletion"] = page.evaluate("typingSnapshot()")
        page.keyboard.press("Escape")
        if args.phase == "after":
            assert results["checks"]["tabAtCaret"]["text"] == "alpha    beta", results["checks"]
            assert results["checks"]["enterIndent"]["text"].replace("\r\n", "\n") == "function greet() {\n    \n}"
            assert results["checks"]["tabCompletion"]["text"].startswith("<QuizBlock ")
            page.keyboard.press("Control+z")
            assert page.evaluate("typingSnapshot().text") == "<Qui"
            page.evaluate("text => typingReset(text)", "Tiếng Việt: gõ chữ có dấu, giữ đúng vị trí.\n")
            page.wait_for_timeout(150)
            page.evaluate("typingView().dispatch({selection:{anchor:typingView().state.doc.length}}); typingView().focus()")
            page.keyboard.insert_text("Ý tưởng rõ ràng — kiểm thử thành công.")
            page.keyboard.press("Control+s")
            page.wait_for_timeout(1200)
            results["checks"]["vietnameseSave"] = page.evaluate("typingSnapshot()")
            assert "Ý tưởng rõ ràng" in (vault / "notes" / "Editor.mdx").read_text(encoding="utf-8"), results["checks"]["vietnameseSave"]
            page.screenshot(path=str(output / "after-vietnamese.png"))

            open_file(page, "sample.ts")
            page.wait_for_function("typingSnapshot().text.startsWith('function greet')")
            page.keyboard.press("Control+End")
            page.keyboard.type(" // caret stays here", delay=5)
            position = page.evaluate("typingSnapshot().ranges")
            page.wait_for_timeout(250)
            assert page.evaluate("typingSnapshot().ranges") == position
            results["checks"]["tabSwitchCaret"] = position
            open_file(page, "notes/Editor.mdx")
            page.wait_for_timeout(250)
            page.evaluate("doc => typingReset(doc, 4)", "$$\nx + y\n$$\n\nordinary prose\n")
            assert page.locator(".cm-mdx-math-block").count() > 0
            page.keyboard.type("a")
            assert page.locator(".cm-mdx-math-block").count() > 0
            page.evaluate("typingView().dispatch({changes:{from:0,to:2,insert:'plain'}})")
            assert page.locator(".cm-mdx-math-block").count() == 0
            results["checks"]["blockHighlightMappingAndDelimiterEdit"] = True

        if args.checks_only:
            results["errors"] = errors
            assert not errors, errors
            (output / f"{args.phase}-interactions.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(json.dumps(results, indent=2), flush=True)
            return

        open_file(page, "notes/Large.mdx")
        page.locator(".cm-content").wait_for()
        page.wait_for_timeout(1800)
        page.locator(".cm-content").click()
        page.keyboard.press("Control+Home")
        page.keyboard.press("End")
        page.evaluate("""() => {
          window.typingEvents = []; window.typingLongTasks = [];
          window.typingObserver?.disconnect();
          window.typingObserver = new PerformanceObserver(list => {
            for (const e of list.getEntries()) window.typingLongTasks.push(e.duration);
          });
          window.typingObserver.observe({type:'longtask'});
          document.addEventListener('keydown', event => {
            if (event.key.length !== 1 || !event.target.closest('.cm-content')) return;
            const start = performance.now();
            requestAnimationFrame(() => window.typingEvents.push(performance.now()-start));
          });
        }""")
        page.keyboard.type(" measured typing latency across a large document" * 2, delay=35)
        page.wait_for_timeout(1500)
        results["performance"] = page.evaluate("""() => {
          window.typingObserver.disconnect();
          const samples = window.typingEvents.sort((a,b)=>a-b);
          return {metric:'keydown to next requestAnimationFrame; not hardware input latency',
            chars:typingView().state.doc.length, lines:typingView().state.doc.lines,
            count:samples.length, p50:samples[Math.floor(samples.length*.5)],
            p95:samples[Math.floor(samples.length*.95)], max:Math.max(...samples),
            longTasks:window.typingLongTasks};
        }""")
        results["errors"] = errors
        print(json.dumps(results, indent=2), flush=True)
        (output / f"{args.phase}-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
