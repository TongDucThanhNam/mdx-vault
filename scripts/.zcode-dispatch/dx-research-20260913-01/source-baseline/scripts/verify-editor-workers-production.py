"""Smoke-test built ES workers from Electron's actual file:// renderer (CDP 9334)."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--cdp", default="http://127.0.0.1:9334")
parser.add_argument("--output", required=True)
args = parser.parse_args()
assets = Path(__file__).resolve().parents[1] / "out" / "renderer" / "assets"

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp(args.cdp)
    page = browser.contexts[0].pages[0]
    page.wait_for_load_state("load")
    assert page.url.startswith("file:"), page.url
    request = """async ({file, messages}) => {
      const worker = new Worker(new URL('./assets/' + file, location.href), {type:'module'});
      const results = [];
      try {
        for (const message of messages) {
          results.push(await new Promise((resolve,reject) => {
            const timer = setTimeout(() => reject(Error('Worker timeout: ' + file)),15000);
            worker.onmessage = e => { clearTimeout(timer); resolve(e.data); };
            worker.onerror = e => { clearTimeout(timer); reject(Error(e.message)); };
            worker.postMessage(message);
          }));
        }
      } finally { worker.terminate(); }
      return results;
    }"""

    def run(pattern, messages):
        files = list(assets.glob(pattern))
        assert len(files) == 1, files
        return page.evaluate(request, {"file": files[0].name, "messages": messages})

    analysis = run("editor-analysis.worker-*.js", [
        {"id": 1, "kind": "outline", "source": "# Built worker heading\n\nText"},
        {"id": 2, "kind": "diagnostics", "source": "<Widget value={unclosed />"},
    ])
    assert analysis[0]["result"]["headings"][0]["text"] == "Built worker heading", analysis
    assert len(analysis[1]["result"]["issues"]) == 1, analysis
    preview = run("mdx-compile.worker-*.js", [{"requestId": "preview-smoke", "source": "# Preview worker\n\nPlain prose."}])
    assert preview[0]["type"] == "result", preview
    assert preview[0]["result"]["code"], preview
    snapshot = {
        "projectRoot": "interactives/smoke", "projectId": "interactives/smoke", "version": 1,
        "files": [
            {"relativePath": "component.tsx", "content": "const value: number = 'wrong'\nexport default value\n"},
            {"relativePath": "manifest.json", "content": json.dumps({
                "name": "Smoke", "version": "1.0.0", "runtime": "react",
                "permissions": {"network": False, "filesystem": False, "dataPaths": []},
                "propsSchema": {}, "dependencies": {"react": "^19.0.0", "react-dom": "^19.0.0"},
            })},
        ],
    }
    language = run("interactive-language.worker-*.js", [
        {"requestId": "init", "operation": "initialize", "projectId": "interactives/smoke", "version": 1, "snapshot": snapshot},
        {"requestId": "diagnose", "operation": "diagnostics", "projectId": "interactives/smoke", "version": 1},
    ])
    assert language[0]["type"] == "result", language
    assert language[1]["type"] == "result", language
    assert any(issue.get("code") == "TS2322" for issue in language[1]["result"]), language
    result = {
        "renderer": "file:// built Electron app", "analysis": analysis,
        "preview": {"type": preview[0]["type"], "codeLength": len(preview[0]["result"]["code"])},
        "language": language,
    }
    print(json.dumps(result, indent=2))
    Path(args.output).write_text(json.dumps(result, indent=2), encoding="utf-8")
