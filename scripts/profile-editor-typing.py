"""Sample the renderer CPU while typing in the disposable verification app."""
import json
from collections import Counter

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://127.0.0.1:9333")
    page = browser.contexts[0].pages[0]
    page.locator(".cm-content").focus()
    page.keyboard.press("Control+Home")
    page.keyboard.press("End")
    session = page.context.new_cdp_session(page)
    session.send("Profiler.enable")
    session.send("Profiler.setSamplingInterval", {"interval": 500})
    session.send("Profiler.start")
    page.keyboard.type(" profile the real typing bottleneck", delay=35)
    profile = session.send("Profiler.stop")["profile"]
    nodes = {node["id"]: node for node in profile["nodes"]}
    counts = Counter()
    for sample, delta in zip(profile["samples"], profile["timeDeltas"]):
        frame = nodes[sample]["callFrame"]
        counts[(frame["functionName"], frame["url"], frame["lineNumber"] + 1)] += delta / 1000
    print(json.dumps([{"ms": round(ms, 1), "function": key[0], "url": key[1], "line": key[2]}
                      for key, ms in counts.most_common(35)], indent=2))
