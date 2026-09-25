"""Developer editing DX audit probe for 2026-09-13, round 1 (research-only evidence).

Reproduces the Ctrl+P / Ctrl+F / Ctrl+Shift+F matrix across surfaces and focus
states (including dirty buffers and non-editor focus), the React interactive
authoring loop (create -> completion -> diagnostics -> isolated proof), note
and TSX input latency, and the Chromium composition (IME) pipeline via CDP.

Isolation contract for the caller:
  1. Create an empty directory under the OS temp folder.
  2. Launch the dev app with MDX_VAULT_TEST_USER_DATA pointing at that
     directory and --remoteDebuggingPort 9333, nothing else attached.
  3. Run this probe with --profile-dir <that directory> and
     --launch-command "<the exact command>". The probe refuses to mutate
     settings if the profile already contains app-settings.json, and after the
     run it verifies the settings landed inside that isolated profile.

The probe is read-only against the app; the only writes are the generated
fixture vault, the output directory, and the isolated profile's own
app-settings file produced by the app under test.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
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

VIEW_HELPERS = """() => {
  window.dxView = () => {
    const active = document.activeElement?.closest?.('.cm-editor') ?? null;
    const root = active ?? [...document.querySelectorAll('.cm-editor')]
      .find(element => element.offsetParent !== null) ?? null;
    return root?.querySelector('.cm-content')?.cmTile?.root?.view ?? null;
  };
  if (!window.dxView()) throw Error('Editor view unavailable');
  window.dxSnapshot = () => {
    const view = window.dxView();
    return {text: view.state.sliceDoc(),
      lines: view.state.doc.lines,
      ranges: view.state.selection.ranges.map(r => ({anchor: r.anchor, head: r.head})),
      caretLine: view.state.doc.lineAt(view.state.selection.main.head).number,
      scrollTop: view.scrollDOM.scrollTop,
      focused: view.hasFocus};
  };
  window.dxSetDoc = (doc, anchor) => {
    const view = window.dxView();
    view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: doc},
      selection: {anchor: anchor ?? doc.length}, scrollIntoView: false});
    view.focus();
  };
}"""

LATENCY_INSTRUMENT = """() => {
  window.dxEvents = []; window.dxLongTasks = [];
  window.dxObserver?.disconnect();
  window.dxObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) window.dxLongTasks.push(entry.duration);
  });
  window.dxObserver.observe({type: 'longtask'});
  if (window.dxKeyHandler) document.removeEventListener('keydown', window.dxKeyHandler);
  window.dxKeyHandler = event => {
    if (event.key.length !== 1 || !event.target.closest('.cm-content')) return;
    const start = performance.now();
    requestAnimationFrame(() => window.dxEvents.push(performance.now() - start));
  };
  document.addEventListener('keydown', window.dxKeyHandler);
}"""

LATENCY_COLLECT = """() => {
  window.dxObserver.disconnect();
  const view = window.dxView();
  const samples = window.dxEvents.sort((a, b) => a - b);
  return {metric: 'document-level keydown listener to next requestAnimationFrame. The listener runs after CodeMirror content-level key dispatch, so CM shortcut-command work preceding the event reaching document is excluded; character-insertion work after keydown is included. Not presentation, not hardware latency.',
    chars: view.state.doc.length, lines: view.state.doc.lines, count: samples.length,
    p50: samples[Math.floor(samples.length * 0.5)],
    p95: samples[Math.floor(samples.length * 0.95)],
    max: Math.max(...samples),
    longTasks: window.dxLongTasks};
}"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cdp", default="http://127.0.0.1:9333")
    parser.add_argument("--port", type=int, default=9333,
                        help="TCP port of the CDP endpoint (used for the ownership check)")
    parser.add_argument("--allow-occupied-endpoint", action="store_true",
                        help="skip the pre-connect free-port assertion (test recovery only)")
    parser.add_argument("--output", required=True)
    parser.add_argument("--profile-dir", required=True,
                        help="The MDX_VAULT_TEST_USER_DATA directory the app was launched with")
    parser.add_argument("--launch-command", required=True,
                        help="The exact command used to launch the isolated app instance")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    profile = Path(args.profile_dir).resolve()
    if not profile.is_dir():
        raise SystemExit(f"profile dir does not exist: {profile}")

    results: dict = {
        "launchReceipt": {
            "launchCommand": args.launch_command,
            "cdpEndpoint": args.cdp,
            "port": args.port,
            "profileDir": str(profile),
        },
        "checks": {},
        "navigationMatrix": [],
    }
    errors: list[str] = []

    def matrix(shortcut: str, surface: str, focus: str, outcome: bool, note: str = "") -> None:
        results["navigationMatrix"].append({
            "shortcut": shortcut, "surface": surface, "focus": focus,
            "outcome": "pass" if outcome else "fail", "note": note})

    vault = Path(tempfile.mkdtemp(prefix="mdx-vault-dx-audit-"))
    (vault / "notes").mkdir()

    large_sections = 400
    needle_line = None
    large_lines = ["# Large document", ""]
    for i in range(1, large_sections + 1):
        large_lines.append(f"## Section {i}")
        large_lines.append("")
        if i == 200:
            needle_line = len(large_lines) + 1
            large_lines.append("The omega needle OMEGA-NEEDLE-200 hides deep in section 200.")
        else:
            large_lines.append(f"A paragraph about editing and evidence {i}.")
        large_lines.append("")
    large_text = "\n".join(large_lines) + "\n"
    (vault / "notes" / "Large.mdx").write_text(large_text, encoding="utf-8")
    (vault / "notes" / "Alpha.mdx").write_text(
        "# Alpha workshop\n\n"
        "Intro prose with ZULU-INTRO-TOKEN before any heading. Tiếng Việt: dấu môi trường.\n\n"
        "## Gamma section\n\n"
        "Body text about precise editing.\n\n"
        "## Delta section\n\n"
        "Repeated word probe: sharp sharp.\n",
        encoding="utf-8",
    )
    (vault / "notes" / "Second.mdx").write_text(
        "# Second note\n\nA bravo needle in the second note.\n",
        encoding="utf-8",
    )
    (vault / "sample.tsx").write_text(
        "export function Probe() {\n"
        "  const label = 'QTX-COMPONENT-TOKEN'\n"
        "  return <button aria-label={label}>probe</button>\n"
        "}\n",
        encoding="utf-8",
    )
    results["fixture"] = {"vault": str(vault),
                          "largeFileLines": len(large_text.splitlines()),
                          "needleLine": needle_line}

    def save() -> None:
        with open(output / "dx-audit-results.json", "w", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(results, indent=2))

    # The launcher must assert the CDP port was free before starting the app
    # (an occupied endpoint is refused, never killed). By probe time the app
    # under test legitimately holds the port, so ownership is verified against
    # the process table instead.
    port = args.port

    with sync_playwright() as p:
        # --- Ownership check, BEFORE any connection use or mutation ------------
        # An occupied endpoint that cannot be proven to be the declared isolated
        # instance is refused outright; nothing is killed by this probe.
        browser = p.chromium.connect_over_cdp(args.cdp)
        page = app_page(browser.contexts[0].pages)

        ownership = await_none = None
        system = browser.new_browser_cdp_session().send("SystemInfo.getInfo")
        main_cmdline = system.get("commandLine", "")
        ownership_main = ("electron.exe" in main_cmdline
                          and f"--remote-debugging-port={port}" in main_cmdline)
        ownership_profile = False
        main_pid = None
        profile_norm = str(profile).replace("\\", "/").rstrip("/").lower()
        # Resolve the PID that actually LISTENS on the CDP port (netstat) —
        # command-line flags alone are ambiguous when a stale instance with the
        # same flag is alive.
        net = subprocess.run(["netstat", "-ano", "-p", "TCP"],
                             capture_output=True, text=True).stdout
        listeners = {line.split()[-1] for line in net.splitlines()
                     if f":{port} " in line and "LISTENING" in line}
        if len(listeners) == 1:
            main_pid = int(next(iter(listeners)))
        if main_pid is not None:
            ps = ("Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | "
                  "Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress")
            raw = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                                 capture_output=True, text=True).stdout
            try:
                processes = json.loads(raw) if raw.strip() else []
            except json.JSONDecodeError:
                processes = []
            if isinstance(processes, dict):
                processes = [processes]
            for candidate in processes:
                cmdline = (candidate.get("CommandLine") or "").replace("\\", "/").lower()
                if (candidate.get("ParentProcessId") == main_pid
                        and profile_norm in cmdline):
                    ownership_profile = True
                    break
        ownership = {"connectedMainIsOurApp": ownership_main,
                     "connectedMainPid": main_pid,
                     "childProcessUsesDeclaredProfile": ownership_profile,
                     "decision": "accepted" if (ownership_main and ownership_profile)
                                 else "refused"}
        results["launchReceipt"]["ownershipBeforeMutation"] = ownership
        print(json.dumps(ownership), flush=True)
        if ownership["decision"] != "accepted":
            raise SystemExit(
                "refusing to mutate: the connected CDP process could not be proven "
                "to use the declared isolated profile; no process was terminated")

        page.on("pageerror", lambda error: errors.append(str(error)))
        page.wait_for_load_state("networkidle")

        # --- Profile freshness, still BEFORE any settings or vault mutation ----
        settings_file = profile / "app-settings.json"
        results["launchReceipt"]["profileFreshBeforeMutation"] = not settings_file.exists()
        if settings_file.exists():
            raise SystemExit(
                "refusing to mutate: app-settings.json already exists in the profile; "
                "this is not a freshly isolated profile")
        print(f"Profile verified fresh before mutation: {settings_file}", flush=True)

        set_window_size(page, 1440, 960)
        # editorLineHeight 1.7 is a non-default marker: if it lands in the
        # declared profile's app-settings.json, the connected app is provably
        # the isolated instance (and not a stray process on the same CDP port).
        MARKER_LINE_HEIGHT = 1.7
        page.evaluate(
            """async vault => {
              await window.appApi.updateSettings({locale:'en', theme:'light',
                editorTabSize:'4', defaultNoteView:'source',
                editorLineHeight: 1.7});
              await window.vaultApi.openVaultPath(vault);
            }""",
            str(vault),
        )
        marker_text = '"editorLineHeight": 1.7'
        settings_file = profile / "app-settings.json"
        marker_found = False
        for _ in range(20):
            if settings_file.exists() and marker_text in settings_file.read_text(
                encoding="utf-8"
            ):
                marker_found = True
                break
            page.wait_for_timeout(500)
        results["launchReceipt"]["settingsMarkerFoundInDeclaredProfile"] = marker_found
        if not marker_found:
            raise SystemExit(
                "the connected app did not persist the settings marker into the "
                "declared profile; it is not the isolated instance")
        print("Profile identity verified via settings marker.", flush=True)
        page.reload()
        page.get_by_label("Vault files").wait_for(timeout=30_000)
        page.evaluate(VIEW_HELPERS)
        save()

        def focus_editor() -> None:
            page.locator(".cm-content").click()
            page.wait_for_function("document.activeElement?.closest('.cm-editor') !== null")

        def in_editor_focus() -> bool:
            return page.evaluate("document.activeElement?.closest('.cm-editor') !== null")

        def search_dialog():
            return page.get_by_role("dialog", name="Search notes")

        def search_input():
            return page.get_by_role("textbox", name="Search notes")

        def quickopen_dialog():
            return page.get_by_role("dialog", name="Open file")

        def wait_dialog_input(label: str) -> None:
            # Both pickers move focus to their input in a setTimeout(0); keys
            # sent before that land on the element underneath the dialog.
            page.wait_for_function(
                "label => document.activeElement?.getAttribute('aria-label') === label",
                arg=label, timeout=8_000)

        def focus_explorer_tree() -> bool:
            # The Pierre file tree renders rows inside an open shadow root with
            # per-character spans; text locators cannot match them. Focus a
            # folder row directly; document.activeElement becomes the shadow
            # host, which lives inside the explorer region.
            return page.evaluate(
                """() => {
                  const host = document.querySelector('[aria-label="Vault files"]');
                  if (!host?.shadowRoot) return false;
                  const rows = [...host.shadowRoot.querySelectorAll(
                    '[role=treeitem], [role=treeitemrow], button')]
                    .filter(el => el.getClientRects().length > 0);
                  const row = rows.find(el =>
                    el.textContent.trim().toLowerCase().replace(/\s+/g, '').endsWith('notes'))
                    ?? rows[0];
                  if (!row) return false;
                  row.focus();
                  return document.activeElement
                    ?.closest?.('[aria-label="Vault explorer"]') !== null;
                }""")

        def panel_inventory() -> dict:
            return page.evaluate("""() => {
              const panel = document.querySelector('.cm-panel.cm-search');
              if (!panel) return null;
              return {buttons: [...panel.querySelectorAll('button')].map(b => b.textContent.trim()),
                checkboxes: [...panel.querySelectorAll('input[type=checkbox]')].map(b => b.name),
                findField: !!panel.querySelector('input[name=search]'),
                replaceField: !!panel.querySelector('input[name=replace]')};
            }""")

        def find_via_panel(token: str) -> str:
            find_field = page.locator('.cm-panel.cm-search input[name="search"]')
            find_field.click()
            page.keyboard.press("Control+A")
            page.keyboard.type(token)  # panel commits on keyup; fill() would not commit
            page.keyboard.press("F3")
            page.wait_for_timeout(200)
            return page.evaluate(
                """() => { const s = dxSnapshot();
                  return s.text.slice(Math.min(s.ranges[0].anchor, s.ranges[0].head),
                    Math.max(s.ranges[0].anchor, s.ranges[0].head)); }""")

        def open_note(path: str, mode: str | None = None) -> None:
            open_file(page, path)
            page.locator(".cm-content").wait_for()
            if mode == "source":
                page.get_by_role("button", name="Source view").click()
            elif mode == "live":
                page.get_by_role("button", name="Live view").click()
            page.wait_for_timeout(250)
            focus_editor()
            page.evaluate(VIEW_HELPERS)

        # === Ctrl+P across surfaces and focus states ============================
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+P")
        wait_dialog_input("Search files by title, alias, path, or extension")
        ok = quickopen_dialog().is_visible()
        matrix("Ctrl+P", "note Source", "editor focus", ok)
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(150)
        matrix("Ctrl+P Escape", "note Source", "editor focus", in_editor_focus(),
               "focus returns to editor")

        page.get_by_role("button", name="Live view").click()
        page.locator(".cm-content").wait_for()
        focus_editor()
        page.keyboard.press("Control+P")
        wait_dialog_input("Search files by title, alias, path, or extension")
        ok = quickopen_dialog().is_visible()
        matrix("Ctrl+P", "note Live", "editor focus", ok)
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)
        page.get_by_role("button", name="Source view").click()

        open_note("sample.tsx")
        page.keyboard.press("Control+P")
        wait_dialog_input("Search files by title, alias, path, or extension")
        ok = quickopen_dialog().is_visible()
        matrix("Ctrl+P", "plain .tsx text editor", "editor focus", ok)
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)

        # Explorer focus state (non-editor): focus a tree row without
        # activating a file.
        explorer_focused = focus_explorer_tree()
        focus_label = "tree focus" if explorer_focused else "workspace (explorer focus not achieved)"
        page.keyboard.press("Control+P")
        wait_dialog_input("Search files by title, alias, path, or extension")
        ok = quickopen_dialog().is_visible()
        matrix("Ctrl+P", "explorer", focus_label, ok,
               "focused by clicking the notes tree row" if explorer_focused else
               "tree row click did not move focus into [aria-label=Vault explorer]")
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(150)
        results["checks"]["explorer_escape_focus_restored"] = page.evaluate(
            """() => ({
              restored: document.activeElement?.closest?.('[aria-label="Vault explorer"]') !== null
                || document.activeElement?.getAttribute?.('aria-label') === 'Vault files',
              activeTag: document.activeElement?.tagName ?? null,
              activeAria: document.activeElement?.getAttribute?.('aria-label') ?? null})""")

        # Ctrl+P pressed again inside the open picker (modal guard).
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+P")
        quickopen_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search files by title, alias, path, or extension")
        page.keyboard.press("Control+P")
        page.wait_for_timeout(250)
        ok = quickopen_dialog().is_visible()
        matrix("Ctrl+P repeat", "picker open", "picker input", ok,
               "modal guard keeps the picker; no second action")
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)

        # Arrow navigation + Enter opening, focus lands in the document.
        focus_editor()
        page.keyboard.press("Control+P")
        quickopen_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search files by title, alias, path, or extension")
        query = page.get_by_role(
            "combobox", name="Search files by title, alias, path, or extension")
        query.fill("notes")
        quickopen_dialog().get_by_role("option").first.wait_for(timeout=5_000)
        page.keyboard.press("ArrowDown")
        second_selected = page.evaluate(
            """() => [...document.querySelectorAll('[role=option]')]
              .findIndex(option => option.getAttribute('aria-selected') === 'true') === 1""")
        page.keyboard.press("Enter")
        quickopen_dialog().wait_for(state="hidden", timeout=10_000)
        page.wait_for_timeout(400)
        results["checks"]["quickopen_arrow_enter_open"] = {
            "arrowSelectedSecondOption": second_selected,
            "openedNotAlpha": "Alpha workshop" not in page.evaluate("dxSnapshot().text"),
            "focusInDocument": in_editor_focus()}
        matrix("Ctrl+P Enter", "second ranked option", "picker input", second_selected)
        save()

        # === Ctrl+F across surfaces =============================================
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+F")
        page.wait_for_selector(".cm-panel.cm-search", timeout=5_000)
        found = find_via_panel("sharp")
        matrix("Ctrl+F find", "note Source", "editor focus", found == "sharp",
               f"selection={found!r}")
        results["checks"]["find_panel_source"] = panel_inventory()
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)
        matrix("Ctrl+F Escape", "note Source", "editor focus",
               not page.evaluate("!!document.querySelector('.cm-panel.cm-search')")
               and in_editor_focus())

        page.get_by_role("button", name="Live view").click()
        page.locator(".cm-content").wait_for()
        focus_editor()
        page.keyboard.press("Control+F")
        live_panel = page.evaluate("!!document.querySelector('.cm-panel.cm-search')")
        found_live = find_via_panel("sharp") if live_panel else ""
        matrix("Ctrl+F find", "note Live", "editor focus", found_live == "sharp",
               f"selection={found_live!r}")
        page.keyboard.press("Escape")
        page.get_by_role("button", name="Source view").click()

        open_note("sample.tsx")
        page.keyboard.press("Control+F")
        page.wait_for_selector(".cm-panel.cm-search", timeout=5_000)
        found = find_via_panel("probe")
        matrix("Ctrl+F find", "plain .tsx text editor", "editor focus", found == "Probe",
               f"selection={found!r} (case-insensitive default)")
        page.keyboard.press("Escape")
        page.wait_for_timeout(150)

        # Ctrl+F from explorer focus: no editor, no action claims Mod+F.
        explorer_focused_find = focus_explorer_tree()
        page.keyboard.press("Control+F")
        page.wait_for_timeout(300)
        matrix("Ctrl+F", "explorer",
               "tree focus" if explorer_focused_find else "workspace (explorer focus not achieved)",
               not page.evaluate("!!document.querySelector('.cm-panel.cm-search')"),
               "no panel opens; unbound outside editors" if explorer_focused_find
               else "focus never left the editor, so the editor panel opened")
        page.keyboard.press("Escape")
        save()

        # === Ctrl+Shift+F across focus states ===================================
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+Shift+F")
        search_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search notes")
        matrix("Ctrl+Shift+F", "project search", "note Source editor focus", True)
        page.keyboard.press("Escape")
        search_dialog().wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(150)

        page.get_by_role("button", name="Live view").click()
        page.locator(".cm-content").wait_for()
        focus_editor()
        page.keyboard.press("Control+Shift+F")
        wait_dialog_input("Search notes")
        ok = search_dialog().is_visible()
        matrix("Ctrl+Shift+F", "project search", "note Live editor focus", ok)
        page.keyboard.press("Escape")
        search_dialog().wait_for(state="hidden", timeout=5_000)
        page.get_by_role("button", name="Source view").click()

        open_note("sample.tsx")
        page.keyboard.press("Control+Shift+F")
        wait_dialog_input("Search notes")
        ok = search_dialog().is_visible()
        matrix("Ctrl+Shift+F", "project search", "plain .tsx editor focus", ok)
        page.keyboard.press("Escape")
        search_dialog().wait_for(state="hidden", timeout=5_000)

        explorer_focused_search = focus_explorer_tree()
        page.keyboard.press("Control+Shift+F")
        wait_dialog_input("Search notes")
        ok = search_dialog().is_visible()
        matrix("Ctrl+Shift+F", "project search",
               "tree focus" if explorer_focused_search else "workspace (explorer focus not achieved)",
               ok)
        page.keyboard.press("Escape")
        search_dialog().wait_for(state="hidden", timeout=5_000)

        # Ctrl+Shift+F while the quick-open picker is open: modal guard.
        focus_editor()
        page.keyboard.press("Control+P")
        quickopen_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search files by title, alias, path, or extension")
        page.keyboard.press("Control+Shift+F")
        page.wait_for_timeout(300)
        matrix("Ctrl+Shift+F", "quick-open picker open", "picker input",
               quickopen_dialog().is_visible() and not search_dialog().is_visible(),
               "modal guard keeps the picker open")
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)

        # Settings and Reading rows: Reading mode needs a note as the active item.
        open_note("notes/Alpha.mdx", mode="source")
        # Settings surface (modal): Ctrl+P must not open the picker above it.
        page.keyboard.press("Control+,")
        settings_dialog = page.get_by_role("dialog", name="Settings")
        settings_dialog.wait_for(timeout=6_000)
        page.wait_for_timeout(300)
        page.keyboard.press("Control+P")
        page.wait_for_timeout(400)
        settings_blocked = not quickopen_dialog().is_visible()
        matrix("Ctrl+P", "settings surface", "settings dialog", settings_blocked,
               "modal guard: picker does not open above Settings")
        results["checks"]["settings_ctrlp_blocked"] = settings_blocked
        page.keyboard.press("Escape")
        settings_dialog.wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(200)

        # Reading surface: no editor; the Workspace context should dispatch.
        page.get_by_role("button", name=re.compile("Reading")).click()
        page.wait_for_timeout(400)
        reading_surface = page.locator('[data-reading-surface="active"]')
        reading_ok = reading_surface.count() > 0
        if reading_ok:
            reading_surface.click()
            page.wait_for_timeout(200)
        page.keyboard.press("Control+P")
        picker_open = quickopen_dialog().is_visible()
        matrix("Ctrl+P", "reading surface", "reading content" if reading_ok else "unknown",
               picker_open,
               "Reading has no editor; Workspace context dispatches" if picker_open
               else "picker did not open from Reading")
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(150)
        results["checks"]["reading_escape_focus_restored"] = page.evaluate(
            "() => document.activeElement?.getAttribute?.('data-reading-surface') === 'active'"
            " || document.activeElement?.closest?.('[data-reading-surface]') !== null")
        page.get_by_role("button", name=re.compile("Source view|Source")).first.click()
        page.wait_for_timeout(250)
        save()

        # === Dirty buffers and autosave =========================================
        # The note editor autosaves ~1s after the last change
        # (src/renderer/src/hooks/useNoteEditor.ts:160-170), so "unsaved state"
        # is short-lived by design. These tests separate text preservation,
        # on-disk persistence, and the explicit-save path.
        alpha_path = vault / "notes" / "Alpha.mdx"
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+End")
        page.keyboard.type(" dirty-probe-token")
        page.wait_for_timeout(200)
        results["checks"]["dirty_indicator_shown_while_typing"] = (
            page.get_by_title("Unsaved changes").count() > 0)

        page.keyboard.press("Control+P")
        quickopen_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search files by title, alias, path, or extension")
        page.keyboard.press("Escape")
        quickopen_dialog().wait_for(state="hidden", timeout=5_000)
        page.wait_for_timeout(150)
        results["checks"]["dirty_buffer_quickopen_escape"] = {
            "tokenIntact": "dirty-probe-token" in page.evaluate("dxSnapshot().text"),
            "focusInEditor": in_editor_focus(),
            "stillDirty": page.get_by_title("Unsaved changes").count() > 0}

        # Autosave commits the buffer ~1s after typing; verify on disk.
        page.wait_for_timeout(1800)
        results["checks"]["autosave_persists_to_disk"] = (
            "dirty-probe-token" in alpha_path.read_text(encoding="utf-8"))

        # Explicit save from a freshly dirty buffer.
        page.keyboard.press("Control+End")
        page.keyboard.type(" explicit-save-token")
        page.wait_for_timeout(150)
        results["checks"]["dirty_again_before_explicit_save"] = (
            page.get_by_title("Unsaved changes").count() > 0)
        page.keyboard.press("Control+S")
        page.wait_for_timeout(600)
        results["checks"]["explicit_save"] = {
            "indicatorCleared": page.get_by_title("Unsaved changes").count() == 0,
            "tokenOnDisk": "explicit-save-token" in alpha_path.read_text(encoding="utf-8")}

        # Tab switch: text preservation (autosave already committed state).
        open_file(page, "notes/Second.mdx")
        page.locator(".cm-content").wait_for()
        page.wait_for_timeout(300)
        open_file(page, "notes/Alpha.mdx")
        page.wait_for_timeout(400)
        results["checks"]["tab_switch_preserves_text"] = (
            "dirty-probe-token" in page.evaluate("dxSnapshot().text")
            and "explicit-save-token" in page.evaluate("dxSnapshot().text"))
        save()

        # === Search filter behaviors ============================================
        focus_editor()

        def run_search(query_text: str, wait_token: str | None = None) -> dict:
            page.keyboard.press("Control+Shift+F")
            search_dialog().wait_for(timeout=5_000)
            wait_dialog_input("Search notes")
            box = search_input()
            box.click()
            box.fill(query_text)  # React onChange fires on fill's input event
            if wait_token:
                try:
                    search_dialog().get_by_text(wait_token).first.wait_for(timeout=8_000)
                except Exception:
                    pass
            page.wait_for_timeout(400)
            outcome = page.evaluate("""() => {
              const dialog = document.querySelector('[aria-label="Search notes"]');
              const results = [...dialog.querySelectorAll('[data-page-preview-path]')]
                .map(element => element.getAttribute('data-page-preview-path'));
              const alert = dialog.querySelector('[role=alert]');
              return {resultPaths: results, count: results.length,
                alert: alert ? alert.textContent : null,
                empty: dialog.textContent.includes('No matches.')};
            }""")
            page.keyboard.press("Escape")
            search_dialog().wait_for(state="hidden", timeout=5_000)
            page.wait_for_timeout(150)
            return outcome

        results["checks"]["search_case_insensitive_default"] = run_search("SHARP", "Alpha")
        results["checks"]["search_regex"] = run_search("/Sh(r|a)rp/", "Alpha")
        results["checks"]["search_path_filter"] = run_search("sharp path:notes", "Alpha")
        results["checks"]["search_file_filter"] = run_search("bravo file:second", "Second")
        results["checks"]["search_tsx_coverage_miss"] = run_search(
            "QTX-COMPONENT-TOKEN")["empty"]
        results["checks"]["search_invalid_regex"] = run_search("/(unclosed")
        save()

        # Deep match reveal granularity.
        page.keyboard.press("Control+Shift+F")
        search_dialog().wait_for(timeout=5_000)
        wait_dialog_input("Search notes")
        box = search_input()
        box.click()
        box.fill("OMEGA-NEEDLE-200")
        search_dialog().get_by_text("Large document").first.wait_for(timeout=8_000)
        page.keyboard.press("Enter")
        search_dialog().wait_for(state="hidden", timeout=10_000)
        page.wait_for_timeout(600)
        deep = page.evaluate("dxSnapshot()")
        results["checks"]["search_deep_match_reveal"] = {
            "fixtureNeedleLine": needle_line,
            "fixtureTotalLines": len(large_text.splitlines()),
            "caretLineAfterOpen": deep["caretLine"],
            "revealedToSectionHeading": abs(deep["caretLine"] - needle_line) <= 4,
            "matchItselfSelected": False}
        page.screenshot(path=str(output / "project-search-deep-reveal.png"))
        save()

        # === Interactive project authoring loop =================================
        open_note("notes/Alpha.mdx", mode="source")
        page.keyboard.press("Control+End")
        page.keyboard.press("Control+Shift+P")
        palette = page.get_by_role("dialog", name="Command palette")
        palette.wait_for(timeout=5_000)
        palette_input = page.get_by_role("combobox", name="Run command")
        palette_input.click()
        palette_input.fill("New interactive")
        option = page.get_by_role("option").filter(has_text="New interactive").first
        option.wait_for(timeout=5_000)
        page.keyboard.press("Enter")
        create_dialog = page.get_by_role("dialog", name="New interactive")
        try:
            create_dialog.wait_for(timeout=4_000)
        except Exception:
            option.click()  # fallback if the palette did not run on Enter
            create_dialog.wait_for(timeout=8_000)
        name_box = page.locator("#interactive-display-name")
        name_box.click()
        name_box.press("End")
        name_box.type("Counter Probe")
        # The starter card is a label around a screen-only radio; clicking the
        # visible card is what reaches React's onChange (a forced input.check()
        # does not).
        create_dialog.get_by_text("Stateful control", exact=True).click()
        selected_starter = page.evaluate(
            """() => document.querySelector('input[name="interactive-starter"]:checked')?.value""")
        results["checks"]["interactive_starter_selected"] = selected_starter
        page.screenshot(path=str(output / "interactive-create-dialog.png"))
        page.get_by_role("button", name="Create interactive").click()
        page.get_by_role("region", name="Interactive Proof for counter-probe").wait_for(
            timeout=20_000)
        page.get_by_text(re.compile(r"^(Not run|Ready) · \d+ problems?$")).wait_for(
            timeout=30_000)
        results["checks"]["interactive_create_transactional"] = True
        page.screenshot(path=str(output / "interactive-workbench.png"))

        def workbench_ready() -> None:
            page.wait_for_function(
                """() => {
                  const region = [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                    .find(element => element.offsetParent !== null);
                  return !!region?.querySelector('.cm-content');
                }""", timeout=15_000)

        workbench_ready()
        # Type intelligence readiness: a cold project may show a
        # "Type intelligence unavailable" banner with a Retry button. Give the
        # worker a fair chance and measure the wait.
        intelligence_wait = {"bannerSeen": False, "retried": False, "availableAfterMs": None}
        waited = 0
        while waited < 90_000:
            state = page.evaluate(
                """() => {
                  const region = [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                    .find(element => element.offsetParent !== null);
                  if (!region) return 'no-region';
                  const banner = [...region.querySelectorAll('p')]
                    .find(element => element.textContent.includes('Type intelligence unavailable'));
                  if (banner) return 'unavailable';
                  return 'available';
                }""")
            if state == 'available':
                break
            if state == 'unavailable':
                intelligence_wait["bannerSeen"] = True
                retry_button = page.get_by_role("button", name="Retry")
                if retry_button.count() > 0 and not intelligence_wait["retried"]:
                    retry_button.click()
                    intelligence_wait["retried"] = True
            page.wait_for_timeout(1_000)
            waited += 1_000
        intelligence_wait["availableAfterMs"] = waited
        results["checks"]["interactive_intelligence_readiness"] = intelligence_wait

        page.evaluate(
            """() => { window.wbView = () => {
                 const region = [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                   .find(element => element.offsetParent !== null);
                 return region?.querySelector('.cm-content')?.cmTile?.root?.view ?? null; };
              const view = window.wbView();
              if (!view) throw Error('workbench editor not mounted');
              view.focus();
              const end = view.state.doc.length;
              view.dispatch({changes: {from: end, to: end, insert: '\\n'},
                selection: {anchor: end + 1}}); view.focus(); }""")
        completion = {"popupAppeared": False}
        try:
            page.locator('[aria-label^="Interactive Proof"] .cm-content').first.click()
            page.wait_for_timeout(200)
            page.keyboard.press("Control+End")
            page.keyboard.type("const probe: num", delay=30)
            try:
                page.locator(".cm-tooltip-autocomplete").wait_for(timeout=6_000)
                completion["popupAppeared"] = True
                completion["via"] = "typing (activateOnTyping)"
            except Exception:
                page.keyboard.press("Control+Space")
                try:
                    page.locator(".cm-tooltip-autocomplete").wait_for(timeout=10_000)
                    completion["popupAppeared"] = True
                    completion["via"] = "Ctrl+Space"
                except Exception:
                    pass
            if completion["popupAppeared"]:
                page.keyboard.type("ber")
                page.wait_for_timeout(350)
                # Capture the SETTLED list and the highlighted item immediately
                # before acceptance; earlier lists are filtered as you type.
                completion["settledOptions"] = page.evaluate(
                    """() => [...document.querySelectorAll('.cm-tooltip-autocomplete .cm-completionLabel')]
                      .map(element => element.textContent.trim()).slice(0, 14)""")
                completion["highlightedBeforeAccept"] = page.evaluate(
                    """() => {
                      const active = document.querySelector('.cm-tooltip-autocomplete li[aria-selected="true"] .cm-completionLabel')
                        ?? document.querySelector('.cm-tooltip-autocomplete li[aria-selected="true"]');
                      return active ? active.textContent.trim() : null; }""")
                completion["primitiveInSettledList"] = completion["settledOptions"].count(
                    "number") > 0
                page.keyboard.press("Enter")
                page.wait_for_timeout(250)
                completion["lineAfterAccept"] = page.evaluate(
                    """() => { const view = window.wbView();
                      return view.state.sliceDoc(view.state.doc.line(view.state.doc.lines).from,
                        view.state.doc.length); }""")
        except Exception as completion_error:
            completion["error"] = repr(completion_error)
        results["checks"]["interactive_tsx_completion"] = completion
        page.screenshot(path=str(output / "interactive-completion.png"))

        # --- Authoring essentials, each observed on the workbench editor -------
        authoring = {}
        # Bracket auto-close (closeBrackets is installed).
        page.evaluate(
            """() => { const v = window.wbView(); const end = v.state.doc.length;
              v.dispatch({changes:{from:end,to:end,insert:'\\n'}, selection:{anchor:end+1}});
              v.focus(); }""")
        page.keyboard.type("{")
        authoring["bracketAutoClose"] = page.evaluate(
            """() => { const v = window.wbView(); const last = v.state.doc.line(v.state.doc.lines);
              return last.text.endsWith('{}'); }""")
        page.keyboard.press("Backspace")
        # JSX tag auto-close (record actual behavior; closeBrackets does not
        # cover tags, so absence is expected unless another extension adds it).
        page.keyboard.type("<div>")
        authoring["jsxTagAutoClose"] = page.evaluate(
            """() => { const v = window.wbView(); const last = v.state.doc.line(v.state.doc.lines);
              return last.text.includes('</div>'); }""")
        page.evaluate(
            """() => { const v = window.wbView(); const last = v.state.doc.line(v.state.doc.lines);
              v.dispatch({changes:{from:last.from,to:v.state.doc.length,insert:''},
                selection:{anchor:last.from}}); v.focus(); }""")
        # Multi-cursor on a repeated word.
        page.evaluate(
            """() => { const v = window.wbView();
              const line = v.state.doc.line(6);
              const idx = line.text.indexOf('value');
              if (idx >= 0) v.dispatch({selection:{anchor:line.from+idx,head:line.from+idx+5}});
              v.focus(); }""")
        page.keyboard.press("Control+d")
        page.keyboard.press("Control+d")
        authoring["multiCursorRanges"] = page.evaluate(
            "() => window.wbView().state.selection.ranges.length")
        page.keyboard.press("Escape")
        # Signature help: typing '(' after a known function requests signatures.
        page.evaluate(
            """() => { const v = window.wbView(); const end = v.state.doc.length;
              v.dispatch({changes:{from:end,to:end,insert:'\\nconst total = '}, selection:{anchor:end+15}});
              v.focus(); }""")
        page.keyboard.type("useState(1", delay=40)
        signature = {"tooltipAppeared": False, "text": None}
        for _ in range(16):
            page.wait_for_timeout(500)
            got = page.evaluate(
                """() => { const tip = [...document.querySelectorAll('.cm-tooltip')]
                    .find(el => el.offsetParent !== null
                      && !el.querySelector('.cm-tooltip-autocomplete'));
                  return tip ? tip.textContent.slice(0, 80) : null; }""")
            if got:
                signature = {"tooltipAppeared": True, "text": got}
                break
        authoring["signatureHelp"] = signature
        page.evaluate(
            """() => { const v = window.wbView(); const last = v.state.doc.line(v.state.doc.lines);
              v.dispatch({changes:{from:last.from,to:v.state.doc.length,insert:''},
                selection:{anchor:last.from}}); v.focus(); }""")
        # Auto-import: useRef is not imported in the stateful starter.
        page.keyboard.type("const ref = useRe", delay=30)
        autoimport = {"popupAppeared": False, "useRefOffered": False,
                      "importAdded": False}
        try:
            page.locator(".cm-tooltip-autocomplete").wait_for(timeout=8_000)
            autoimport["popupAppeared"] = True
            page.keyboard.type("f", delay=30)
            page.wait_for_timeout(250)
            autoimport["useRefOffered"] = page.evaluate(
                """() => {
                  const labels = [...document.querySelectorAll('.cm-tooltip-autocomplete .cm-completionLabel')]
                    .map(el => el.textContent.trim());
                  return labels.includes('useRef'); }""")
            page.keyboard.press("Enter")
            page.wait_for_timeout(600)
            autoimport["importAdded"] = page.evaluate(
                """() => { const v = window.wbView();
                  const head = v.state.sliceDoc(0, 400);
                  return head.includes('useRef') && /import\s*{[^}]*useRef/.test(head); }""")
        except Exception as import_error:
            autoimport["error"] = repr(import_error)
        authoring["autoImportUseRef"] = autoimport
        page.evaluate(
            """() => { const v = window.wbView(); const last = v.state.doc.line(v.state.doc.lines);
              v.dispatch({changes:{from:last.from,to:v.state.doc.length,insert:''},
                selection:{anchor:last.from}}); v.focus(); }""")
        # Definition navigation: local helper + F12 at the call site.
        page.evaluate(
            """() => { const v = window.wbView(); const end = v.state.doc.length;
              const add = '\\nfunction dxHelper(a: number) { return a + 1 }\\nconst dxUsed = dxHelper(1)';
              v.dispatch({changes:{from:end,to:end,insert:add},
                selection:{anchor:end + add.length - 2}}); v.focus(); }""")
        before = page.evaluate("() => window.wbView().state.selection.main.head")
        page.keyboard.press("F12")
        page.wait_for_timeout(1200)
        after = page.evaluate(
            "() => ({head: window.wbView().state.selection.main.head,"
            " line: window.wbView().state.doc.lineAt(window.wbView().state.selection.main.head).number})")
        authoring["f12Definition"] = {"moved": after["head"] != before,
                                      "caretLine": after["line"]}
        # restore pristine starter
        page.evaluate(
            """() => { const v = window.wbView();
              const cut = v.state.sliceDoc().search(/\\nfunction dxHelper/);
              if (cut >= 0) v.dispatch({changes:{from:cut,to:v.state.doc.length,insert:''}});
              v.focus(); }""")
        results["checks"]["interactive_authoring_essentials"] = authoring
        page.screenshot(path=str(output / "interactive-authoring.png"))

        diagnostics = {"found": False, "markers": [], "problemsCount": None}
        try:
            page.locator('[aria-label^="Interactive Proof"] .cm-content').first.click()
            page.keyboard.press("Control+End")
            page.keyboard.type(" = 'mismatch'", delay=25)
            for _ in range(60):
                page.wait_for_timeout(500)
                found = page.evaluate(
                    """() => { const root = [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                        .find(element => element.offsetParent !== null);
                      const markers = root ? [...root.querySelectorAll('.cm-lint-marker, .cm-lintRange, .cm-diagnostic')]
                        .map(element => element.className) : [];
                      return markers.length > 0 ? markers : false; }""")
                if found:
                    problems = page.evaluate(
                        """() => [...document.querySelectorAll('[aria-label="Problems"]')]
                          .map(el => (el.textContent.match(/Problems · (.\d+)/) || [])[1])
                          .find(Boolean) ?? null""")
                    diagnostics = {"found": True, "markers": found[:6],
                                   "problemsCount": problems}
                    break
        except Exception as diagnostics_error:
            diagnostics["error"] = repr(diagnostics_error)
        results["checks"]["interactive_tsx_diagnostics"] = diagnostics
        page.screenshot(path=str(output / "interactive-diagnostics.png"))
        page.keyboard.press("Control+Z")
        page.wait_for_timeout(150)
        results["checks"]["interactive_undo_step"] = page.evaluate(
            """() => { const view = window.wbView();
              return view.state.sliceDoc(view.state.doc.line(view.state.doc.lines).from,
                view.state.doc.length); }""")
        # Restore the pristine starter so the proof compiles regardless of what
        # the single undo removed; the experiment line is probe-owned, not app
        # state worth keeping.
        page.evaluate(
            """() => { const view = window.wbView();
              const last = view.state.doc.line(view.state.doc.lines);
              let from = last.from;
              const previous = view.state.doc.line(Math.max(1, view.state.doc.lines - 1));
              if (previous.text.trim() === '') from = previous.from;
              view.dispatch({changes: {from, to: view.state.doc.length, insert: ''}});
              view.focus(); }""")
        save()

        # Safe preview: authoring consent, then isolated proof frame. A fresh
        # starter auto-runs its zero-capability proof, and the header shows
        # "Refresh proof" once proof.document exists, so drive the state machine
        # instead of assuming the Run button is present.
        proof_path = "never-clicked"
        for _ in range(30):
            state_text = page.evaluate(
                """() => [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                  .map(element => element.textContent.match(/(Not run|Ready|Checking|Compile issue) · \d+ problems?/)?.[0])
                  .find(Boolean) ?? null""")
            if state_text and state_text.startswith("Ready"):
                proof_path = "auto-run"
                break
            run_button = page.get_by_role("button", name="Run isolated proof")
            if run_button.count() > 0:
                try:
                    run_button.click(timeout=3_000)
                    proof_path = "clicked"
                    break
                except Exception:
                    pass
            page.wait_for_timeout(1_000)
        results["checks"]["interactive_proof_state_before_consent"] = state_text
        results["checks"]["interactive_proof_consent_path"] = proof_path
        page.get_by_text(re.compile(r"^Ready · \d+ problems?$")).wait_for(timeout=60_000)
        frame_facts = page.evaluate(
            """() => { const frame = [...document.querySelectorAll('iframe')]
                .find(element => element.offsetParent !== null);
              return frame ? {sandbox: frame.getAttribute('sandbox'),
                srcProtocol: (frame.src || '').slice(0, 24)} : null; }""")
        results["checks"]["interactive_safe_proof_frame"] = frame_facts
        page.screenshot(path=str(output / "interactive-proof-ready.png"))
        save()

        # Latency inside the interactive workbench TSX editor (React authoring
        # surface). At wide viewport the workbench shows all panes at once and
        # the role=tab switcher is display:none (lg:hidden), so the source
        # editor stays mounted; in a narrow window, click the source tab first.
        # Re-arm the in-page helpers either way: the renderer may have
        # reloaded, which wipes window state.
        results["latency"] = {}
        try:
            try:
                page.get_by_role("tab", name="source", exact=True).click(timeout=2_000)
            except Exception:
                pass
            workbench_ready()
            page.evaluate(
                """() => { window.wbView = () => {
                     const region = [...document.querySelectorAll('[aria-label^="Interactive Proof"]')]
                       .find(element => element.offsetParent !== null);
                     return region?.querySelector('.cm-content')?.cmTile?.root?.view ?? null; };
                  const view = window.wbView();
                  if (!view) throw Error('workbench editor not mounted');
                  view.dispatch({selection: {anchor: view.state.doc.length}}); view.focus(); }""")
            page.evaluate(LATENCY_INSTRUMENT)
            page.keyboard.type(" const glide = 'authoring latency' ", delay=25)
            page.wait_for_timeout(1200)
            results["latency"]["interactive_tsx"] = page.evaluate(LATENCY_COLLECT)
        except Exception as latency_error:
            results["latency"]["interactive_tsx"] = {"error": repr(latency_error)}

        # === Composition (IME) on the note editor ================================
        try:
            open_note("notes/Alpha.mdx", mode="source")
            page.evaluate(VIEW_HELPERS)
            page.evaluate(
                """() => {
                  window.dxComposition = [];
                  const content = document.activeElement?.closest('.cm-editor')?.querySelector('.cm-content')
                    ?? document.querySelector('.cm-content');
                  ['compositionstart', 'compositionupdate', 'compositionend'].forEach(type =>
                    content.addEventListener(type, event =>
                      window.dxComposition.push({type, data: event.data})));
                  window.dxSetDoc('IME: ', 5);
                }""")
            cdp = page.context.new_cdp_session(page)
            cdp.send("Input.imeSetComposition",
                     {"selectionStart": 5, "selectionEnd": 5, "text": "Tiếng"})
            page.wait_for_timeout(150)
            cdp.send("Input.insertText", {"text": "Tiếng"})
            page.wait_for_timeout(300)
            results["checks"]["ime_composition"] = {
                "events": page.evaluate("window.dxComposition"),
                "text": page.evaluate("dxSnapshot().text"),
                "limitation": "CDP composition is not an OS IME session; see verification ledger"}
            page.screenshot(path=str(output / "ime-composition.png"))
        except Exception as ime_error:
            results["checks"]["ime_composition"] = {"error": repr(ime_error)}
        save()

        # === Input latency, measured separately, no concurrent heavy checks ======
        open_note("notes/Alpha.mdx", mode="source")
        page.evaluate(VIEW_HELPERS)
        page.evaluate("dxSetDoc('')")
        page.wait_for_timeout(200)
        page.evaluate(LATENCY_INSTRUMENT)
        page.keyboard.type("small note typing latency sample ", delay=25)
        page.wait_for_timeout(1200)
        results["latency"]["note_small"] = page.evaluate(LATENCY_COLLECT)

        open_file(page, "notes/Large.mdx")
        page.locator(".cm-content").wait_for()
        page.wait_for_timeout(1500)
        focus_editor()
        page.keyboard.press("Control+End")
        page.evaluate(LATENCY_INSTRUMENT)
        page.keyboard.type(" large note typing latency sample ", delay=25)
        page.wait_for_timeout(1500)
        results["latency"]["note_large"] = page.evaluate(LATENCY_COLLECT)

        open_note("sample.tsx")
        focus_editor()
        page.keyboard.press("Control+End")
        page.evaluate(LATENCY_INSTRUMENT)
        page.keyboard.type(" const probe = 'tsx typing latency' ", delay=25)
        page.wait_for_timeout(1200)
        results["latency"]["plain_tsx"] = page.evaluate(LATENCY_COLLECT)
        save()

        # === Motion facts, measured (corrects the round-0 architecture claim) ====
        focus_editor()
        results["motion_facts"] = page.evaluate("""() => {
          const root = document.activeElement?.closest('.cm-editor');
          const cursor = root?.querySelector('.cm-cursor-primary');
          const content = root?.querySelector('.cm-content');
          const scroller = root?.querySelector('.cm-scroller');
          return {drawnCursorPresent: !!cursor,
            drawnCursorClass: cursor?.className ?? null,
            cursorBlinkAnimationMs: cursor ? cursor.style.animationDuration : null,
            nativeCaretColor: content ? getComputedStyle(content).caretColor : null,
            editorScrollBehavior: scroller ? getComputedStyle(scroller).scrollBehavior : null,
            prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches};
        }""")
        page.screenshot(path=str(output / "motion-facts.png"))
        save()

        # === Profile receipt, verified after the run =============================
        results["launchReceipt"]["settingsPersistedInIsolatedProfile"] = (
            settings_file.exists()
            and marker_text in settings_file.read_text(encoding="utf-8"))

        results["errors"] = errors
        results["exit"] = "ok"
        save()
        print(json.dumps({"exit": "ok", "matrixRows": len(results["navigationMatrix"]),
                          "errors": errors}, indent=2), flush=True)


if __name__ == "__main__":
    main()
