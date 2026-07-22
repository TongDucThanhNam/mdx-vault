import argparse
import json
import shutil
import subprocess
import tempfile
import traceback
from pathlib import Path

from playwright.sync_api import ConsoleMessage, Error, Page, Route, sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate and verify GOAL-19 static/interactive file-URL exports."
    )
    parser.add_argument("--evidence-dir", type=Path)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    generated = subprocess.run(
        ["bun", "scripts/goal19-live-fixture.ts"],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    fixture = json.loads(generated.stdout.strip().splitlines()[-1])
    root = Path(fixture["root"]).resolve()
    vault_root = Path(fixture["vaultRoot"]).resolve()
    static_path = Path(fixture["staticPath"]).resolve()
    interactive_path = Path(fixture["interactivePath"]).resolve()
    evidence_dir = (args.evidence_dir or root / "evidence").resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {
        "staticSize": fixture["staticResult"]["size"],
        "interactiveSize": fixture["interactiveResult"]["size"],
        "evidenceDir": str(evidence_dir),
    }

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                report["static"] = verify_static(browser, static_path, evidence_dir)

                unavailable = root / "vault-unavailable"
                vault_root.rename(unavailable)
                if vault_root.exists():
                    raise AssertionError("Source vault remained available after rename")

                report["interactive"] = verify_interactive(
                    browser, interactive_path, vault_root, evidence_dir
                )
            finally:
                browser.close()

        artifact = interactive_path.read_text(encoding="utf-8")
        assert str(vault_root) not in artifact
        assert str(vault_root).replace("\\", "/") not in artifact
        assert "UNRELATED_NOTE_SENTINEL_MUST_NOT_EXPORT" not in artifact
        assert "allow-same-origin" not in artifact
        report["artifactLeakScan"] = "passed"
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        temp_root = Path(tempfile.gettempdir()).resolve()
        if root.parent == temp_root and root.name.startswith("mdx-vault-goal19-live-"):
            shutil.rmtree(root, ignore_errors=True)
        else:
            raise RuntimeError(f"Refusing to clean unexpected fixture directory: {root}")


def block_external(page: Page, requests: list[str]) -> None:
    def route_request(route: Route) -> None:
        url = route.request.url
        if url.startswith(("http://", "https://")):
            requests.append(url)
            route.abort()
        else:
            route.continue_()

    page.route("**/*", route_request)


def verify_static(browser, path: Path, evidence_dir: Path) -> dict[str, object]:
    requests: list[str] = []
    context = browser.new_context(java_script_enabled=False, viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    block_external(page, requests)
    try:
        page.goto(path.as_uri(), wait_until="load")
        content = page.locator("article.mdx-vault-export").text_content() or ""
        for sentinel in [
            "Offline fidelity sentinel",
            "Which answer unlocks this frame?",
            "Exact self-test answer.",
            "Authored seven",
            "Source",
            "Artifact",
            "HTML identity fixture",
            "React dataset fixture",
        ]:
            assert sentinel in content, f"Static export lost {sentinel!r}"
        assert page.locator("details").count() >= 3
        assert page.locator(".mdx-vault-sandbox-fallback img").count() == 2
        assert page.locator("button.in-button").count() == 0
        assert page.locator("text=Unknown component").count() == 0
        assert requests == []
        page.screenshot(path=evidence_dir / "goal19-static-desktop.png", full_page=True)

        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        page.screenshot(path=evidence_dir / "goal19-static-narrow.png", full_page=True)
        return {
            "javascriptDisabled": True,
            "details": page.locator("details").count(),
            "externalRequests": requests,
            "narrowOverflow": False,
        }
    finally:
        context.close()


def verify_interactive(
    browser, path: Path, original_vault_root: Path, evidence_dir: Path
) -> dict[str, object]:
    requests: list[str] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    block_external(page, requests)

    def on_console(message: ConsoleMessage) -> None:
        if message.type == "error":
            console_errors.append(message.text)

    page.on("console", on_console)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    try:
        page.goto(path.as_uri(), wait_until="load")
        html_frame = page.frame_locator('iframe[title="HTML identity fixture"]')
        react_frame = page.frame_locator('iframe[title="React dataset fixture"]')
        html_frame.get_by_text("Exact HTML island identity").wait_for()
        react_frame.get_by_text("Exact React island identity").wait_for()
        react_frame.get_by_text("embedded-approved-dataset", exact=False).wait_for()

        widget = page.locator(".in-widget").first
        status = widget.locator(".in-widget-status")
        assert status.inner_text() == "LOCKED"
        gates = page.locator("section.in-gate")
        assert gates.count() == 2
        independent_yes = gates.nth(1).get_by_role("radio", name="yes")
        assert independent_yes.get_attribute("aria-checked") == "false"
        widget.get_by_role("radio", name="beta").click()
        assert status.inner_text() == "READY"
        assert widget.get_by_role("radio", name="alpha").is_disabled()
        assert widget.get_by_role("radio", name="gamma").is_disabled()
        assert independent_yes.get_attribute("aria-checked") == "false"

        reveal = page.get_by_role("button", name="Hiện đáp án")
        reveal.click()
        assert page.get_by_text("Exact self-test answer.").is_visible()

        html_frame_element = page.locator('iframe[title="HTML identity fixture"]')
        react_frame_element = page.locator('iframe[title="React dataset fixture"]')
        assert html_frame_element.get_attribute("sandbox") == "allow-scripts"
        assert react_frame_element.get_attribute("sandbox") == "allow-scripts"
        assert html_frame_element.evaluate("element => element.getBoundingClientRect().height") > 260
        assert react_frame_element.evaluate("element => element.getBoundingClientRect().height") >= 280

        assert html_frame.get_by_text("parent access blocked").is_visible()
        assert html_frame.get_by_text("cross-frame dataset denied").is_visible()
        assert react_frame.get_by_text("Exact React island prop").is_visible()
        assert react_frame.get_by_text("undeclared dataset denied").is_visible()
        assert react_frame.get_by_text("embedded-approved-dataset", exact=False).is_visible()
        assert page.locator("body").get_attribute("data-compromised") is None

        artifact_text = path.read_text(encoding="utf-8")
        assert str(original_vault_root) not in artifact_text
        assert requests == []
        assert page_errors == []
        assert console_errors == []
        page.screenshot(path=evidence_dir / "goal19-interactive-desktop.png", full_page=True)

        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        page.screenshot(path=evidence_dir / "goal19-interactive-narrow.png", full_page=True)
        return {
            "sourceVaultUnavailable": True,
            "predictionStatus": status.inner_text(),
            "selfTestRevealed": True,
            "htmlIslandResized": True,
            "reactIslandResized": True,
            "approvedDataset": True,
            "undeclaredDatasetDenied": True,
            "crossFrameDatasetDenied": True,
            "parentAccessDenied": True,
            "externalRequests": requests,
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "narrowOverflow": False,
        }
    finally:
        context.close()


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, Error) as error:
        traceback.print_exc()
        raise SystemExit(f"GOAL-19 browser verification failed: {error}") from error
