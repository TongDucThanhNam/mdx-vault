"""Round-2 probe fixes, part A:
- pre-mutation ownership check (CDP SystemInfo + OS process table linked to the
  declared profile); refuse without killing anything on mismatch;
- autosave-aware dirty-buffer tests with on-disk verification;
- explorer Escape focus restoration recorded;
- Settings and Reading focus rows added to the matrix."""
from pathlib import Path

p = Path("scripts/verify-dev-dx-audit.py")
src = p.read_text(encoding="utf-8")

# --- imports for the ownership check ------------------------------------------
old = "import argparse\nimport importlib.util\nimport json\nimport re\nimport tempfile\nfrom pathlib import Path"
new = "import argparse\nimport importlib.util\nimport json\nimport re\nimport subprocess\nimport tempfile\nfrom pathlib import Path"
assert old in src, "imports anchor"
src = src.replace(old, new, 1)

# --- ownership check inserted right after app_page resolution -----------------
old = """    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(args.cdp)
        page = app_page(browser.contexts[0].pages)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.wait_for_load_state("networkidle")

        # --- Profile identity, verified BEFORE any settings or vault mutation ---
        settings_file = profile / "app-settings.json"
        results["launchReceipt"]["profileFreshBeforeMutation"] = not settings_file.exists()
        if settings_file.exists():
            raise SystemExit(
                "refusing to mutate: app-settings.json already exists in the profile; "
                "this is not a freshly isolated profile")
        print(f"Profile verified fresh before mutation: {settings_file}", flush=True)"""
new = """    with sync_playwright() as p:
        # --- Ownership check, BEFORE any connection use or mutation ------------
        # An occupied endpoint that cannot be proven to be the declared isolated
        # instance is refused outright; nothing is killed by this probe.
        if not args.allow_occupied_endpoint:
            import socket
            probe_socket = socket.create_connection(("127.0.0.1", port), timeout=1.5)
            probe_socket.close()
        browser = p.chromium.connect_over_cdp(args.cdp)
        page = app_page(browser.contexts[0].pages)

        ownership = await_none = None
        system = browser.new_browser_cdp_session().send("SystemInfo.getInfo")
        main_cmdline = system.get("commandLine", "")
        ownership_main = ("electron.exe" in main_cmdline
                          and f"--remote-debugging-port={port}" in main_cmdline)
        ownership_profile = False
        main_pid = None
        profile_norm = str(profile).replace("\\\\", "/").rstrip("/").lower()
        ps = ("Get-CimInstance Win32_Process -Filter \\"Name='electron.exe'\\" | "
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
            cmdline = candidate.get("CommandLine") or ""
            if f"--remote-debugging-port={port}" in cmdline:
                main_pid = candidate.get("ProcessId")
                break
        if main_pid is not None:
            for candidate in processes:
                cmdline = (candidate.get("CommandLine") or "").replace("\\\\", "/").lower()
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
        print(f"Profile verified fresh before mutation: {settings_file}", flush=True)"""
assert old in src, "ownership anchor missing"
src = src.replace(old, new, 1)

# --- port argument -------------------------------------------------------------
old = '''    parser.add_argument("--cdp", default="http://127.0.0.1:9333")'''
new = '''    parser.add_argument("--cdp", default="http://127.0.0.1:9333")
    parser.add_argument("--port", type=int, default=9333,
                        help="TCP port of the CDP endpoint (used for the ownership check)")
    parser.add_argument("--allow-occupied-endpoint", action="store_true",
                        help="skip the pre-connect free-port assertion (test recovery only)")'''
assert old in src, "parser anchor missing"
src = src.replace(old, new, 1)

# --- free-port assertion before connecting -------------------------------------
old = """    with sync_playwright() as p:
        # --- Ownership check, BEFORE any connection use or mutation ------------"""
new = """    if not args.allow_occupied_endpoint:
        import socket
        try:
            probe_socket = socket.create_connection(("127.0.0.1", port), timeout=1.5)
            probe_socket.close()
            raise SystemExit(
                "refusing to run: the CDP port is already occupied by an unknown "
                "process; this probe never terminates processes it did not launch")
        except OSError:
            pass  # port free — the endpoint can only be the instance launched for us

    with sync_playwright() as p:
        # --- Ownership check, BEFORE any connection use or mutation ------------"""
assert old in src, "free-port anchor missing"
src = src.replace(old, new, 1)

# remove the duplicate in-function socket import block created above
old = """        if not args.allow_occupied_endpoint:
            import socket
            probe_socket = socket.create_connection(("127.0.0.1", port), timeout=1.5)
            probe_socket.close()
        browser = p.chromium.connect_over_cdp(args.cdp)"""
new = """        browser = p.chromium.connect_over_cdp(args.cdp)"""
assert old in src, "dup socket anchor missing"
src = src.replace(old, new, 1)

# record main PID in the receipt
old = '''    results: dict = {
        "launchReceipt": {
            "launchCommand": args.launch_command,
            "cdpEndpoint": args.cdp,
            "profileDir": str(profile),
        },
        "checks": {},
        "navigationMatrix": [],
    }'''
new = '''    results: dict = {
        "launchReceipt": {
            "launchCommand": args.launch_command,
            "cdpEndpoint": args.cdp,
            "port": args.port,
            "profileDir": str(profile),
        },
        "checks": {},
        "navigationMatrix": [],
    }'''
assert old in src, "receipt anchor missing"
src = src.replace(old, new, 1)

p.write_text(src, encoding="utf-8", newline="\n")
import ast
import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    ast.parse(src)
print("fixer A part 1 applied, syntax ok")
