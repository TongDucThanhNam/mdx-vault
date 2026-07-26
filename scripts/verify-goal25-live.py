"""Live Electron verification for GOAL-25 via Playwright over Electron CDP.

The caller owns the disposable vault/user-data lifecycle and starts Electron
with REMOTE_DEBUGGING_PORT. This script interacts only through the renderer's
visible UI and its narrow preload APIs.
"""

from __future__ import annotations

import argparse
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp", default="http://127.0.0.1:9222")
    parser.add_argument("--vault", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--mock-ai", action="store_true")
    return parser.parse_args()


class MockOpenAiHandler(BaseHTTPRequestHandler):
    server: "MockOpenAiServer"

    def do_POST(self) -> None:
        content_length = int(self.headers.get("content-length", "0"))
        self.server.request_bodies.append(self.rfile.read(content_length).decode("utf-8"))
        response = {
            "id": "resp_goal25_live",
            "object": "response",
            "created_at": int(time.time()),
            "status": "completed",
            "error": None,
            "incomplete_details": None,
            "instructions": None,
            "max_output_tokens": None,
            "model": "gpt-4o-mini",
            "output": [],
            "parallel_tool_calls": True,
            "previous_response_id": None,
            "reasoning": None,
            "store": False,
            "temperature": 0,
            "text": {"format": {"type": "text"}},
            "tool_choice": "auto",
            "tools": [],
            "top_p": 1,
            "truncation": "disabled",
            "usage": None,
            "metadata": {},
        }
        events = [
            {
                "type": "response.created",
                "sequence_number": 0,
                "response": response,
            },
            {
                "type": "response.output_text.delta",
                "sequence_number": 1,
                "item_id": "msg_goal25_live",
                "output_index": 0,
                "content_index": 0,
                "delta": self.server.assistant_text,
                "logprobs": [],
            },
            {
                "type": "response.completed",
                "sequence_number": 2,
                "response": response,
            },
        ]
        body = "".join(f"data: {json.dumps(event)}\n\n" for event in events)
        body += "data: [DONE]\n\n"
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class MockOpenAiServer(ThreadingHTTPServer):
    assistant_text: str
    request_bodies: list[str]


def start_mock_ai_server(assistant_text: str) -> tuple[MockOpenAiServer, threading.Thread]:
    server = MockOpenAiServer(("127.0.0.1", 0), MockOpenAiHandler)
    server.assistant_text = assistant_text
    server.request_bodies = []
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


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
        # Electron's reduced Browser CDP domain omits the window-bounds methods
        # on some releases. Viewport emulation still exercises the responsive UI.
        page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(250)


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
            page.wait_for_timeout(1_000)
    query = page.get_by_role(
        "combobox", name="Search files by title, alias, path, or extension"
    )
    query.fill(relative_path)
    option = dialog.get_by_role("option").filter(has_text=relative_path).first
    option.wait_for(state="visible", timeout=10_000)
    option.click()
    dialog.wait_for(state="hidden", timeout=15_000)


def dismiss_permission_review(page: Page, timeout: int = 5_000) -> None:
    deny = page.get_by_role("button", name=re.compile(r"^deny$", re.IGNORECASE)).last
    try:
        deny.wait_for(state="visible", timeout=timeout)
        deny.click()
    except PlaywrightTimeoutError:
        return


def wait_for_proof_state(page: Page, state: str, timeout: int = 30_000) -> None:
    page.get_by_text(re.compile(rf"^{re.escape(state)} · \d+ problems?$")).wait_for(
        state="visible", timeout=timeout
    )


def replace_codemirror(page: Page, source: str) -> None:
    editor = page.locator(".cm-content").first
    editor.click()
    page.keyboard.press("Control+A")
    page.keyboard.insert_text(source)


def editor_text_coordinates(page: Page, text: str) -> dict[str, float]:
    coordinates = page.evaluate(
        """(needle) => {
          const lines = [...document.querySelectorAll('.cm-line')]
          const line = lines.find((candidate) => candidate.textContent?.includes(needle))
          if (!line) return null
          const lineText = line.textContent ?? ''
          const start = lineText.indexOf(needle)
          const end = start + needle.length
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
          let consumed = 0
          let startNode = null
          let startOffset = 0
          let endNode = null
          let endOffset = 0
          while (walker.nextNode()) {
            const node = walker.currentNode
            const length = node.textContent?.length ?? 0
            if (!startNode && start <= consumed + length) {
              startNode = node
              startOffset = Math.max(0, start - consumed)
            }
            if (end <= consumed + length) {
              endNode = node
              endOffset = Math.max(0, end - consumed)
              break
            }
            consumed += length
          }
          if (!startNode || !endNode) return null
          const range = document.createRange()
          range.setStart(startNode, startOffset)
          range.setEnd(endNode, endOffset)
          const rect = range.getBoundingClientRect()
          return {
            startX: rect.left + 1,
            endX: rect.right - 1,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2
          }
        }""",
        text,
    )
    if coordinates is None:
        raise RuntimeError(f"Could not locate editor text: {text}")
    return coordinates


def metric(page: Page, name: str, timeout: int = 30_000) -> float:
    surface = page.get_by_role("region", name=re.compile("^Interactive Proof for ")).first
    attribute = f"data-language-{name}-ms"
    page.wait_for_function(
        """([element, attribute]) => {
          const value = element?.getAttribute(attribute)
          return value !== null && value !== '' && Number.isFinite(Number(value))
        }""",
        arg=[surface.element_handle(), attribute],
        timeout=timeout,
    )
    value = surface.get_attribute(attribute)
    if value is None:
        raise RuntimeError(f"Metric never appeared: {attribute}")
    return float(value)


def main() -> None:
    args = parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    events: list[str] = []
    console_errors: list[str] = []
    page_errors: list[str] = []
    external_requests: list[str] = []
    measurements: dict[str, float] = {}
    mock_ai_server: MockOpenAiServer | None = None
    mock_ai_thread: threading.Thread | None = None

    if args.mock_ai:
        ai_proposal = {
            "rationale": "Create a deterministic isolated proof fixture.",
            "patches": [
                {
                    "kind": "componentDraft",
                    "rationale": "A zero-capability AI-authored proof component.",
                    "folderRelativePath": "interactives/ai-live-proof",
                    "componentSource": (
                        "import { useState } from 'react'\n\n"
                        "export default function AiLiveProof(): React.JSX.Element {\n"
                        "  const [count, setCount] = useState(0)\n"
                        "  return <button type=\"button\" onClick={() => setCount(count + 1)}>"
                        "AI count: {count}</button>\n"
                        "}\n"
                    ),
                    "manifestJson": json.dumps(
                        {
                            "name": "AI live proof",
                            "version": "1.0.0",
                            "runtime": "react",
                            "permissions": {
                                "network": False,
                                "filesystem": False,
                                "dataPaths": [],
                            },
                            "propsSchema": {},
                            "dependencies": {
                                "react": "^19.0.0",
                                "react-dom": "^19.0.0",
                            },
                        },
                        indent=2,
                    ),
                    "readmeMarkdown": (
                        "# AI live proof\n\n"
                        "Deterministic GOAL-25 AI approval and handoff fixture.\n"
                    ),
                    "provenance": {
                        "prompt": "Create a small React counter interactive.",
                        "noteRelativePath": "notes/Welcome.mdx",
                        "modelName": "gpt-4o-mini",
                        "generatedAt": "2026-07-26T00:00:00.000Z",
                    },
                }
            ],
        }
        mock_ai_server, mock_ai_thread = start_mock_ai_server(json.dumps(ai_proposal))

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

        def record_request(request) -> None:
            parsed = urlparse(request.url)
            if parsed.scheme in {"http", "https", "ws", "wss"} and parsed.hostname not in {
                "localhost",
                "127.0.0.1",
            }:
                external_requests.append(request.url)

        page.on("request", record_request)
        page.wait_for_load_state("domcontentloaded")
        if args.offline:
            network_session = page.context.new_cdp_session(page)
            network_session.send("Network.enable")
            network_session.send(
                "Network.emulateNetworkConditions",
                {
                    "offline": True,
                    "latency": 0,
                    "downloadThroughput": 0,
                    "uploadThroughput": 0,
                },
            )
        set_window_size(page, 1440, 900)

        try:
            page.evaluate(
                """async (vaultPath) => {
                  await window.vaultApi.openVaultPath(vaultPath)
                  window.location.reload()
                }""",
                str(Path(args.vault).resolve()),
            )
        except PlaywrightTimeoutError:
            pass

        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        create_dialog = page.get_by_role("dialog", name="New interactive")
        if create_dialog.count() and create_dialog.is_visible():
            page.keyboard.press("Escape")
            create_dialog.wait_for(state="hidden")
        events.append("disposable vault reopened through the normal startup path")

        # Existing code must remain inert when normal permission is denied.
        permission_status = page.evaluate(
            """async () => {
              const src = '../interactives/react-counter'
              const note = 'notes/React Interactive Demo.mdx'
              const descriptor = await window.sandboxApi.describeInteractive(src, note)
              const denied = await window.sandboxApi.setPermission(
                'interactive', src, note, descriptor.contentHash, 'deny'
              )
              return denied.permissionStatus
            }"""
        )
        assert permission_status == "denied"
        open_file(page, "notes/Welcome.mdx")
        open_file(page, "interactives/react-counter/component.tsx")
        page.get_by_role("region", name="Interactive Proof for react-counter").wait_for()
        wait_for_proof_state(page, "Not run")
        page.screenshot(path=str(output / "goal-25-existing-not-run.png"))
        events.append("existing denied component opened as Not run")

        page.get_by_label("Preview props · session only").fill('{"initial":3}')
        page.get_by_role("button", name="Run isolated proof").click()
        wait_for_proof_state(page, "Ready")
        status_after_authoring_run = page.evaluate(
            """async () => (
              await window.sandboxApi.describeInteractive(
                '../interactives/react-counter',
                'notes/React Interactive Demo.mdx'
              )
            ).permissionStatus"""
        )
        assert status_after_authoring_run == "denied"
        page.get_by_role("button", name="Stop proof").click()
        wait_for_proof_state(page, "Stopped")
        events.append("authoring Run stayed memory-only and did not alter the denied decision")

        # One-command scaffold from the note caret.
        open_file(page, "notes/Welcome.mdx")
        source_view = page.get_by_role("button", name="Source view")
        if source_view.get_attribute("aria-pressed") != "true":
            source_view.click()
        note_editor = page.locator(".cm-content").first
        note_editor.click()
        page.keyboard.press("Control+End")
        page.get_by_role("button", name="New interactive").click()
        page.get_by_label("Display name").fill("Live proof counter")
        page.get_by_text("Stateful control", exact=True).click()
        started = time.perf_counter()
        page.get_by_role("button", name="Create interactive").click()
        page.get_by_role(
            "region", name="Interactive Proof for live-proof-counter"
        ).wait_for(timeout=30_000)
        measurements["create_to_surface_ms"] = (time.perf_counter() - started) * 1000
        wait_for_proof_state(page, "Ready", timeout=30_000)
        measurements["create_to_ready_ms"] = (time.perf_counter() - started) * 1000
        measurements["cold_ready_ms"] = metric(page, "cold-ready")
        measurements["first_diagnostics_ms"] = metric(page, "first-diagnostics")
        page.screenshot(path=str(output / "goal-25-wide-ready.png"))
        events.append("header action created and auto-ran an app-owned zero-capability starter")

        # Warm semantic completion and its allowed React auto-import run in the lazy worker.
        auto_import_source = """export default function LiveProofCounter(): React.JSX.Element {
  const [count, setCount] = useSt
  return <button type="button">{count}</button>
}
"""
        replace_codemirror(page, auto_import_source)
        page.get_by_text(re.compile(r"^TS2552 · component\.tsx:")).wait_for(
            state="visible", timeout=15_000
        )
        component_editor = page.locator(".cm-content").first
        completion_coordinates = editor_text_coordinates(page, "useSt")
        page.mouse.click(
            completion_coordinates["endX"], completion_coordinates["centerY"]
        )
        page.keyboard.press("Control+Space")
        page.locator(".cm-tooltip-autocomplete").wait_for(state="visible", timeout=10_000)
        measurements["warm_completion_ms"] = metric(page, "warm-completion", timeout=10_000)
        page.locator(".cm-tooltip-autocomplete .cm-completionLabel").filter(
            has_text="useState"
        ).first.click()
        page.wait_for_function(
            """() => {
              const text = document.querySelector('.cm-content')?.textContent ?? ''
              return text.includes('import { useState } from "react"')
                && text.includes('const [count, setCount] = useState')
            }""",
            timeout=10_000,
        )
        assert "const [count, setCount] = useState" in component_editor.text_content()
        page.keyboard.press("Control+Z")
        page.wait_for_function(
            """() => {
              const text = document.querySelector('.cm-content')?.textContent ?? ''
              return !text.includes('import { useState } from "react"')
                && text.includes('const [count, setCount] = useSt')
            }""",
            timeout=10_000,
        )
        events.append(
            "warm project-aware completion applied a safe React auto-import as one undoable edit without a network lookup"
        )

        invalid_source = """import { useState } from 'react'

export default function LiveProofCounter(): React.JSX.Element {
  const [count, setCount] = useState(0)
  setCount('wrong type')
  return <button type="button">{count}</button>
}
"""
        replace_codemirror(page, invalid_source)
        page.get_by_text(re.compile(r"^TS2345 · component\.tsx:")).wait_for(
            state="visible", timeout=15_000
        )
        wait_for_proof_state(page, "Compile issue", timeout=20_000)
        page.get_by_text("Source has newer issues. Showing the last known good proof.").wait_for()
        page.screenshot(path=str(output / "goal-25-wide-compile-issue.png"))
        events.append("unsaved diagnostics appeared and saved compile failure retained last good proof")

        # Narrow + keyboard-only Problems navigation.
        set_window_size(page, 980, 760)
        problems_tab = page.get_by_role("tab", name=re.compile("^Problems"))
        problems_tab.focus()
        page.keyboard.press("Enter")
        assert problems_tab.get_attribute("aria-selected") == "true"
        problem = page.get_by_role("button", name=re.compile("TS2345"))
        problem.focus()
        page.keyboard.press("Enter")
        source_tab = page.get_by_role("tab", name="source", exact=True)
        assert source_tab.get_attribute("aria-selected") == "true"
        problems_tab.focus()
        page.keyboard.press("Enter")
        page.screenshot(path=str(output / "goal-25-narrow-problems.png"))
        events.append("narrow Problems tab and exact-range navigation worked from the keyboard")

        valid_source = """import { useState } from 'react'

export default function LiveProofCounter(): React.JSX.Element {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}
"""
        source_tab.focus()
        page.keyboard.press("Enter")
        replace_codemirror(page, valid_source)
        page.get_by_text(re.compile(r"^Ready · 0 problems$")).wait_for(
            state="visible", timeout=25_000
        )
        problems_tab.focus()
        page.keyboard.press("Enter")
        page.get_by_text("No project problems").wait_for(state="visible", timeout=15_000)

        # Add a local helper through the disposable vault, then prove local
        # hover/signature/definition and dependency-policy behavior in the UI.
        helper_path = (
            Path(args.vault).resolve()
            / "interactives"
            / "live-proof-counter"
            / "helper.ts"
        )
        helper_path.write_text(
            "export function add(left: number, right: number): number {\n"
            "  return left + right\n"
            "}\n",
            encoding="utf-8",
        )
        page.reload()
        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        normal_preview_deny = page.get_by_role("button", name="DENY")
        normal_preview_deny.wait_for(state="visible", timeout=15_000)
        normal_preview_deny.click()
        set_window_size(page, 1440, 900)
        open_file(page, "interactives/live-proof-counter/component.tsx")
        wait_for_proof_state(page, "Not run", timeout=20_000)
        page.get_by_role("button", name="Run isolated proof").click()
        wait_for_proof_state(page, "Ready", timeout=25_000)
        local_source = """import { useState } from 'react'
import { add } from './helper'

export default function LiveProofCounter(): React.JSX.Element {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(add(count, 1))}>
      Count: {count}
    </button>
  )
}
"""
        replace_codemirror(page, local_source)
        wait_for_proof_state(page, "Ready", timeout=25_000)
        add_coordinates = editor_text_coordinates(page, "add(")
        add_symbol_x = add_coordinates["startX"] + (
            add_coordinates["endX"] - add_coordinates["startX"]
        ) * 0.35
        page.mouse.move(add_symbol_x, add_coordinates["centerY"])
        page.locator(".cm-tooltip").filter(has_text=re.compile(r"add\(left: number")).wait_for(
            state="visible", timeout=10_000
        )
        page.mouse.click(
            add_coordinates["endX"], add_coordinates["centerY"]
        )
        page.locator(".cm-tooltip").filter(has_text=re.compile(r"add\(left: number")).wait_for(
            state="visible", timeout=10_000
        )
        page.keyboard.press("Escape")
        add_coordinates = editor_text_coordinates(page, "add(")
        add_symbol_x = add_coordinates["startX"] + (
            add_coordinates["endX"] - add_coordinates["startX"]
        ) * 0.35
        page.mouse.click(add_symbol_x, add_coordinates["centerY"])
        page.keyboard.press("F12")
        page.get_by_role("tab", name=re.compile(r"^helper\.ts")).wait_for(
            state="visible", timeout=15_000
        )
        assert page.get_by_role("tab", name=re.compile(r"^helper\.ts")).get_attribute(
            "aria-selected"
        ) == "true"
        open_file(page, "interactives/live-proof-counter/component.tsx")

        forbidden_source = """import blocked from 'left-pad'
export default function Blocked(): React.JSX.Element {
  return <div>{String(blocked)}</div>
}
"""
        replace_codemirror(page, forbidden_source)
        page.get_by_text(re.compile(r"^DEPENDENCY_NOT_ALLOWED ·")).wait_for(
            state="visible", timeout=15_000
        )
        escape_source = """import escaped from '../../outside'
export default function Escaped(): React.JSX.Element {
  return <div>{String(escaped)}</div>
}
"""
        replace_codemirror(page, escape_source)
        page.get_by_text(re.compile(r"^IMPORT_OUTSIDE_PROJECT ·")).wait_for(
            state="visible", timeout=15_000
        )
        replace_codemirror(page, local_source)
        wait_for_proof_state(page, "Ready", timeout=25_000)
        events.append(
            "local helper hover, signature help, F12 definition, and blocked package/root-escape imports were observed"
        )

        runtime_source = """export default function RuntimeFailure(): React.JSX.Element {
  throw new Error('goal25 runtime proof')
}
"""
        replace_codemirror(page, runtime_source)
        wait_for_proof_state(page, "Runtime issue", timeout=25_000)
        page.get_by_text(re.compile(r"^RUNTIME_ERROR ·")).wait_for(
            state="visible", timeout=10_000
        )
        replace_codemirror(page, local_source)
        wait_for_proof_state(page, "Ready", timeout=25_000)
        events.append("runtime error reached Problems and recovered to the last-good proof")

        page.get_by_role("button", name="Open manifest.json").click()
        replace_codemirror(page, "{")
        page.get_by_text(re.compile(r"^MANIFEST_INVALID ·")).wait_for(
            state="visible", timeout=15_000
        )
        wait_for_proof_state(page, "Compile issue", timeout=20_000)
        capability_manifest = json.dumps(
            {
                "name": "Live proof counter",
                "version": "1.0.0",
                "runtime": "react",
                "permissions": {
                    "network": True,
                    "filesystem": True,
                    "dataPaths": ["assets/secret.csv"],
                },
                "propsSchema": {},
                "dependencies": {
                    "react": "^19.0.0",
                    "react-dom": "^19.0.0",
                },
            },
            indent=2,
        )
        replace_codemirror(page, capability_manifest)
        wait_for_proof_state(page, "Ready", timeout=25_000)
        permission_path = Path(args.vault).resolve() / ".app" / "sandbox-permissions.json"
        permission_before = permission_path.read_bytes() if permission_path.exists() else b""
        frame_handle = page.locator('iframe[title*="isolated authoring proof"]').element_handle()
        if frame_handle is None:
            raise RuntimeError("Authoring proof iframe was not mounted")
        proof_frame = frame_handle.content_frame()
        if proof_frame is None:
            raise RuntimeError("Authoring proof iframe had no content frame")
        proof_html = proof_frame.content()
        assert "connect-src 'none'" in proof_html or "connect-src &#39;none&#39;" in proof_html
        data_denial = proof_frame.evaluate(
            """async () => {
              try {
                await window.mdxVault.requestData('assets/secret.csv')
                return 'unexpected success'
              } catch (error) {
                return error instanceof Error ? error.message : String(error)
              }
            }"""
        )
        assert data_denial == "Authoring proof cannot access vault data."
        permission_after = permission_path.read_bytes() if permission_path.exists() else b""
        assert permission_after == permission_before
        events.append(
            "invalid manifest recovered; requested network/filesystem/data remained denied and permission bytes were unchanged"
        )

        set_window_size(page, 980, 760)
        proof_tab = page.get_by_role("tab", name="proof", exact=True)
        proof_tab.focus()
        page.keyboard.press("Enter")
        props = page.get_by_label("Preview props · session only")
        props.fill("{")
        page.get_by_text(re.compile("^PROPS_JSON_INVALID ·")).wait_for(
            state="attached", timeout=10_000
        )
        wait_for_proof_state(page, "Compile issue")
        props.fill("{}")
        wait_for_proof_state(page, "Ready", timeout=20_000)
        events.append("TypeScript and props errors both recovered to Ready")

        # Normal note preview still owns the persistent content-hash decision.
        set_window_size(page, 1440, 900)
        open_file(page, "notes/React Interactive Demo.mdx")
        page.get_by_role("button", name="Reading view").click()
        page.get_by_role("button", name="Review").wait_for(state="visible", timeout=20_000)
        page.get_by_role("button", name="Review").click()
        page.get_by_role("button", name="Allow").click()
        page.locator('iframe[title*="React counter"]').wait_for(state="visible", timeout=25_000)
        events.append("normal Reading preview required and stored explicit Allow")

        open_file(page, "interactives/react-counter/component.tsx")
        wait_for_proof_state(page, "Compile issue", timeout=25_000)
        page.get_by_label("Preview props · session only").fill('{"initial":3}')
        wait_for_proof_state(page, "Ready", timeout=25_000)
        events.append(
            "exact normally allowed hash auto-consented and refreshed after valid session props"
        )
        react_counter_editor = page.locator(".cm-content").first
        react_counter_editor.click()
        page.keyboard.press("Control+End")
        page.keyboard.insert_text("\n// changed after normal approval")
        wait_for_proof_state(page, "Ready", timeout=25_000)
        page.wait_for_timeout(1_500)
        open_file(page, "notes/React Interactive Demo.mdx")
        page.get_by_role("button", name="Reading view").click()
        page.get_by_text("Run sandbox content?", exact=True).wait_for(
            state="visible", timeout=20_000
        )
        changed_status = page.evaluate(
            """async () => (
              await window.sandboxApi.describeInteractive(
                '../interactives/react-counter',
                'notes/React Interactive Demo.mdx'
              )
            ).permissionStatus"""
        )
        assert changed_status == "prompt"
        events.append("changed source hash returned normal note preview to Review")

        if mock_ai_server is not None:
            base_url = f"http://127.0.0.1:{mock_ai_server.server_port}/v1"
            saved_settings = page.evaluate(
                """async (baseUrl) => window.aiApi.saveSettings({
                  provider: 'openai',
                  model: 'gpt-4o-mini',
                  apiKey: 'sk-goal25-live-fixture',
                  baseUrl
                })""",
                base_url,
            )
            assert saved_settings["provider"] == "openai"
            assert saved_settings["hasApiKey"] is True
            page.reload()
            page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
            dismiss_permission_review(page)
            open_file(page, "notes/Welcome.mdx")
            page.get_by_role("button", name="Toggle AI assistant").click()
            composer = page.get_by_placeholder(
                "Ask the assistant. Enter sends, Shift+Enter inserts a newline."
            )
            composer.fill("Create a small React counter interactive.")
            composer.press("Enter")
            page.get_by_text(re.compile(r"^New interactive component \(3 files\)$")).wait_for(
                state="visible", timeout=30_000
            )
            page.get_by_role("button", name="Approve & write").click()
            page.get_by_role("region", name="Interactive Proof for ai-live-proof").wait_for(
                state="visible", timeout=30_000
            )
            wait_for_proof_state(page, "Not run", timeout=20_000)
            assert len(mock_ai_server.request_bodies) >= 1
            events.append(
                "existing AI action generated an approved component, opened the same Proof surface, and did not auto-run"
            )

        # Reload clears authoring session consent; the changed hash is no longer allowed.
        page.reload()
        page.get_by_label("Vault files").wait_for(state="visible", timeout=30_000)
        dismiss_permission_review(page)
        open_file(page, "interactives/react-counter/component.tsx")
        wait_for_proof_state(page, "Not run", timeout=20_000)
        events.append("renderer restart cleared authoring consent")

        result = {
            "offline": args.offline,
            "events": events,
            "measurements": {key: round(value, 2) for key, value in measurements.items()},
            "externalRequests": sorted(set(external_requests)),
            "consoleErrors": console_errors,
            "pageErrors": page_errors,
            "mockAiRequests": len(mock_ai_server.request_bodies) if mock_ai_server else 0,
            "screenshots": [
                "goal-25-existing-not-run.png",
                "goal-25-wide-ready.png",
                "goal-25-wide-compile-issue.png",
                "goal-25-narrow-problems.png",
            ],
        }
        (output / "goal-25-live-results.json").write_text(
            json.dumps(result, indent=2), encoding="utf-8"
        )
        print(json.dumps(result, indent=2))
        browser.close()

    if mock_ai_server is not None:
        mock_ai_server.shutdown()
        mock_ai_server.server_close()
    if mock_ai_thread is not None:
        mock_ai_thread.join(timeout=5)


if __name__ == "__main__":
    main()
