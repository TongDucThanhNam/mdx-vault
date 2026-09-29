"""Built Electron + file:// Chromium parity evidence for GOAL-36."""

import json
import os
import re
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.tmp' / 'goal36'
SCREENS = ROOT / '.tmp' / 'screens' / 'goal36'
VAULT = BASE / 'vault'
NOTE = 'notes/GOAL-36 Registry.mdx'
KIT_NOTE = 'notes/GOAL-36 Note Kit.mdx'
KIT_CLASSES = {
    'NotePrimer': 'in-primer', 'PrimerTerm': 'in-primer-term',
    'HighlightBox': 'in-highlight-box', 'FormulaLine': 'in-formula-line',
    'MentalModel': 'in-mm-grid', 'MentalModelRow': 'in-mm-key',
    'TraceBlock': 'in-trace', 'WidgetFrame': 'in-widget',
    'PredictionGate': 'in-gate', 'Recap': 'in-recap',
    'SelfTest': 'in-self-test', 'SelfTestItem': 'in-question',
    'EvidenceLog': 'in-evidence-log', 'EvidenceItem': 'in-evidence-item',
    'ComparisonBars': 'in-comparison', 'CellGrid': 'in-cell-figure',
    'FlowSequence': 'in-flow-figure'
}
FIXTURE = '''---
title: GOAL-36 Registry
theme: interactive-note
---
# GOAL-36 Registry

<QuizBlock question="Which invariant makes binary search valid?" options={["The input is sorted", "The input is random"]} answerIndex={0} explanation="Ordering permits discarding half." />

## DataChart
<DataChart title="Sample CSV dataset" type="line" src="../assets/datasets/sample.csv" x="x" y="y" />

## EquationSlider
<EquationSlider formula="y = m * x + b" compute="m * x + b" variables={{ x: { min: -10, max: 10, default: 2, step: 0.5 }, m: { min: -5, max: 5, default: 1.5, step: 0.1 }, b: { min: -10, max: 10, default: 1, step: 0.5 } }} />

## AlgorithmVisualizer
<AlgorithmVisualizer algorithm="binary-search" data={[1, 3, 5, 7, 9]} target={7} />

## Counter
<Counter initial={3} />

## Sandboxed Counter
<Interactive src="../interactives/react-counter" initial={3} />
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def read_export(page, target, mode, note=NOTE):
    return page.evaluate('''async ([path, mode, target]) => window.exportApi.run({
      noteRelativePath:path, mode, target:{absolutePath:target}, confirmedOversized:true
    })''', [note, mode, str(target)])


def capture_kit(page, root, prefix):
    for name, class_name in KIT_CLASSES.items():
        item = page.locator(f'{root} .{class_name}').first
        item.wait_for(timeout=20000)
        item.evaluate('e => e.scrollIntoView({block:"center"})')
        page.screenshot(path=str(SCREENS / f'{prefix}-{name}.png'))


def capture_sections(page, selector, prefix):
    sections = page.locator(selector)
    assert sections.count() >= 4, (prefix, sections.count())
    for index, name in enumerate(('quiz', 'chart', 'equation', 'algorithm')):
        sections.nth(index).evaluate('e => e.scrollIntoView({block:"center"})')
        page.screenshot(path=str(SCREENS / f'{prefix}-{name}.png'))


def check_export(browser, path, prefix, interactive):
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    messages = []
    page.on('console', lambda message: messages.append([message.type, message.text]))
    page.on('pageerror', lambda error: messages.append(['pageerror', str(error)]))
    page.goto(path.as_uri())
    page.wait_for_load_state('networkidle')
    if interactive:
        page.locator('.recharts-surface').first.wait_for(timeout=20000)
        page.wait_for_function('''() => {
          const frame = document.querySelector('iframe[sandbox="allow-scripts"]');
          return frame && frame.getBoundingClientRect().height > 40 &&
            frame.getBoundingClientRect().height < 260;
        }''', timeout=20000)
        sandbox = page.locator('iframe[sandbox="allow-scripts"]').first
        sandbox.scroll_into_view_if_needed()
        page.frame_locator('iframe[sandbox="allow-scripts"]').get_by_role('button').first.wait_for()
    page.screenshot(path=str(SCREENS / f'{prefix}-full.png'), full_page=True)
    if prefix == 'static-export':
        page.emulate_media(media='print')
        page.pdf(path=str(SCREENS / 'export-print.pdf'), print_background=True)
        page.emulate_media(media='screen')
    if interactive:
        capture_sections(page, '.mdx-vault-export section.my-5', prefix)
        assert page.locator('iframe[sandbox="allow-scripts"]').count() == 1
        counter = page.locator('.mdx-vault-export div.my-4').first
        counter.evaluate('e => e.scrollIntoView({block:"center"})')
        page.screenshot(path=str(SCREENS / f'{prefix}-counter.png'))
        frame = page.locator('iframe[sandbox="allow-scripts"]').first
        frame.evaluate('e => e.scrollIntoView({block:"center"})')
        page.screenshot(path=str(SCREENS / f'{prefix}-sandbox.png'))
        frame_height = frame.evaluate('e => e.getBoundingClientRect().height')
        reservation_height = page.locator('.mdx-vault-sandbox-content').first.evaluate(
            'e => e.getBoundingClientRect().height')
        frame_style = page.locator('.mdx-vault-sandbox').first.evaluate(
            'e => ({border:getComputedStyle(e).borderTopWidth,shadow:getComputedStyle(e).boxShadow})')
        assert frame_height == reservation_height and 40 < frame_height < 260, (
            frame_height, reservation_height)
        assert frame_style['border'] == '2px' and frame_style['shadow'] != 'none', frame_style
        chart = page.locator('.recharts-responsive-container').first
        chart.scroll_into_view_if_needed()
        box = chart.bounding_box()
        quiz = page.locator('.mdx-vault-export section.my-5').first
        quiz_style = quiz.evaluate('e => ({border:getComputedStyle(e).borderTopWidth,padding:getComputedStyle(e).paddingTop})')
        slider = page.locator('.mdx-vault-export input[type="range"]').first
        slider.scroll_into_view_if_needed()
        slider_box = slider.bounding_box()
        legend = page.locator('.recharts-legend-wrapper').first
        assert box and box['height'] > 100, box
        assert page.locator('.recharts-surface').count() >= 2
        assert quiz_style['border'] == '2px' and float(quiz_style['padding'][:-2]) >= 16, quiz_style
        assert slider_box and slider_box['width'] > 100 and 0 <= slider_box['y'] <= 1080, slider_box
        assert legend.count() and legend.is_visible()
        assert page.locator('.recharts-cartesian-axis').count() >= 2
        page.locator('.recharts-line-dot').first.hover()
        assert page.locator('.recharts-tooltip-wrapper').first.is_visible()
        radio = page.get_by_role('radio').first
        radio.click()
        assert radio.get_attribute('aria-checked') == 'true'
        evidence = {'chart_box': box, 'quiz': quiz_style, 'slider_box': slider_box,
                    'sandbox_height': frame_height, 'sandbox_card': frame_style,
                    'legend': legend.count(), 'axes': page.locator('.recharts-cartesian-axis').count()}
    else:
        cards = page.locator('.mdx-vault-static-island')
        assert cards.count() >= 5, cards.count()
        notice = page.locator('.mdx-export-static-notice')
        assert notice.count() == 1 and 'Static snapshots' in notice.inner_text()
        assert page.locator('.mdx-vault-static-island .mdx-vault-static-notice').count() == 0
        assert page.locator('.mdx-vault-static-data-summary table').count() >= 2
        evidence = {'static_cards': cards.count(), 'notice_count': notice.count()}
        for index, name in enumerate(('quiz', 'chart', 'equation', 'algorithm', 'counter')):
            cards.nth(index).evaluate('e => e.scrollIntoView({block:"center"})')
            page.screenshot(path=str(SCREENS / f'{prefix}-{name}.png'))
    prose_height = page.locator('.mdx-vault-export h1').evaluate('e => getComputedStyle(e).height')
    outer = page.evaluate('''() => {const e=document.createElement('div');e.className='h-72';document.body.append(e);const h=e.getBoundingClientRect().height;e.remove();return h}''')
    assert outer == 0, outer
    assert not messages, messages
    evidence.update({'messages': messages, 'outside_scope_h72': outer, 'heading_height': prose_height,
                     'body_background': page.locator('body').evaluate('e => getComputedStyle(e).backgroundColor')})
    page.close()
    return evidence


def check_other_browser(browser, path, name):
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    messages = []
    page.on('console', lambda message: messages.append([message.type, message.text]))
    page.on('pageerror', lambda error: messages.append(['pageerror', str(error)]))
    page.goto(path.as_uri())
    page.locator('.recharts-surface').first.wait_for(timeout=30000)
    quiz = page.locator('.mdx-vault-export section.my-5').first
    chart = page.locator('.recharts-responsive-container').first
    slider = page.locator('.mdx-vault-export input[type="range"]').first
    card_style = quiz.evaluate('e => ({border:getComputedStyle(e).borderTopWidth,padding:getComputedStyle(e).paddingTop})')
    chart_box = chart.bounding_box()
    slider_box = slider.bounding_box()
    assert card_style['border'] == '2px' and float(card_style['padding'][:-2]) >= 16, card_style
    assert chart_box and chart_box['height'] > 100, chart_box
    assert slider_box and slider_box['width'] > 100, slider_box
    for label, target in [('quiz', quiz), ('chart', chart), ('slider', slider)]:
        target.evaluate('e => e.scrollIntoView({block:"center"})')
        page.screenshot(path=str(SCREENS / f'{name}-{label}.png'))
    assert not messages, messages
    page.close()
    return {'quiz': card_style, 'chart_box': chart_box, 'slider_box': slider_box,
            'messages': messages}


def check_kit_export(browser, path, prefix):
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    messages = []
    page.on('console', lambda message: messages.append([message.type, message.text]))
    page.on('pageerror', lambda error: messages.append(['pageerror', str(error)]))
    page.goto(path.as_uri())
    page.wait_for_load_state('networkidle')
    capture_kit(page, '.mdx-vault-export', prefix)
    page.screenshot(path=str(SCREENS / f'{prefix}-full.png'), full_page=True)
    assert not messages, messages
    evidence = {'components': list(KIT_CLASSES), 'messages': messages,
                'body_background': page.locator('body').evaluate('e => getComputedStyle(e).backgroundColor')}
    page.close()
    return evidence


def run_app(playwright, theme, port, profile):
    profile.mkdir(parents=True, exist_ok=True)
    (profile / 'app-settings.json').write_text(json.dumps({
        'version': 6, 'lastVaultPath': str(VAULT), 'theme': theme
    }), encoding='utf8')
    env = os.environ.copy()
    env['MDX_VAULT_TEST_USER_DATA'] = str(profile)
    log = (BASE / f'electron-{theme}.log').open('w', encoding='utf8')
    proc = subprocess.Popen([
        str(ROOT / 'node_modules/electron/dist/electron.exe'),
        f'--remote-debugging-port={port}', str(ROOT)
    ], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
       creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(400):
            if proc.poll() is not None:
                raise RuntimeError(f'Electron exited: {theme}')
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version', timeout=.2):
                    break
            except Exception:
                time.sleep(.05)
        else:
            raise RuntimeError('CDP timeout')
        app = playwright.chromium.connect_over_cdp(f'http://127.0.0.1:{port}')
        page = app.contexts[0].pages[0]
        page.set_viewport_size({'width': 1920, 'height': 1080})
        page.locator('[data-testid="reading-preview-scroll"][data-preview-layout-ready="true"]').wait_for(timeout=30000)
        page.keyboard.press('Control+P')
        page.locator('input[role="combobox"]').fill('GOAL-36 Registry')
        page.locator('[role="dialog"] [role="option"]').filter(has_text='GOAL-36 Registry').first.click()
        page.locator('.recharts-surface').first.wait_for(timeout=30000)
        approval = page.get_by_role('button', name='Allow', exact=True)
        try:
            approval.wait_for(timeout=5000)
            approval.click()
            page.locator('.mdx-preview iframe[sandbox="allow-scripts"]').first.wait_for(timeout=20000)
        except PlaywrightTimeoutError:
            pass
        if theme == 'light':
            page.screenshot(path=str(SCREENS / 'reading-full.png'), full_page=True)
            capture_sections(page, '.mdx-preview section.my-5', 'reading')
            counter = page.locator('.mdx-preview div.my-4').first
            counter.evaluate('e => e.scrollIntoView({block:"center"})')
            page.screenshot(path=str(SCREENS / 'reading-counter.png'))
            frame = page.locator('.mdx-preview iframe[sandbox="allow-scripts"]').first
            frame.evaluate('e => e.scrollIntoView({block:"center"})')
            page.screenshot(path=str(SCREENS / 'reading-sandbox.png'))
            results = {}
            for mode in ('static', 'interactive'):
                target = BASE / f'{mode}.html'
                results[mode] = read_export(page, target, mode)
            page.keyboard.press('Control+P')
            page.locator('input[role="combobox"]').fill('GOAL-36 Note Kit')
            page.locator('[role="dialog"] [role="option"]').filter(has_text='GOAL-36 Note Kit').first.click()
            page.locator('.mdx-preview .in-primer').first.wait_for(timeout=30000)
            capture_kit(page, '.mdx-preview', 'reading-kit')
            results['kit'] = {}
            for mode in ('static', 'interactive'):
                target = BASE / f'kit-{mode}.html'
                results['kit'][mode] = read_export(page, target, mode, KIT_NOTE)
            return results
        screen_paper = page.locator('.mdx-preview').evaluate('e => getComputedStyle(e).backgroundColor')
        assert screen_paper == 'rgb(23, 33, 42)', screen_paper
        page.emulate_media(media='print')
        print_paper = page.locator('.mdx-preview').evaluate('e => getComputedStyle(e).backgroundColor')
        page.screenshot(path=str(SCREENS / 'app-print.png'), full_page=True)
        sandbox = page.locator('.mdx-preview iframe[sandbox="allow-scripts"]')
        sandbox_count = sandbox.count()
        assert sandbox_count == 1, sandbox_count
        if sandbox_count:
            sandbox.first.scroll_into_view_if_needed()
            page.screenshot(path=str(SCREENS / 'app-print-sandbox.png'))
        page.emulate_media(media='screen')
        dark_target = BASE / 'dark-paper-interactive.html'
        result = read_export(page, dark_target, 'interactive')
        return {'screen_paper': screen_paper, 'print_paper': print_paper,
                'print_sandbox_frames': sandbox_count,
                'dark_export': result}
    finally:
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(proc.pid)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        log.close()


def main():
    BASE.mkdir(parents=True, exist_ok=True)
    SCREENS.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / 'example-vault', VAULT, dirs_exist_ok=True)
    (VAULT / NOTE).write_text(FIXTURE, encoding='utf8')
    kit = (ROOT / 'example-vault' / 'notes' / 'Cache Hierarchy & Locality.mdx').read_text(encoding='utf8')
    kit = kit.replace('title: Cache Hierarchy & Locality', 'title: GOAL-36 Note Kit', 1)
    kit = kit.replace('id: concept-cpu-cache-hierarchy', 'id: goal36-note-kit', 1)
    kit = re.sub(r'<SandboxedHTML\b[^>]+/>', 'Sandboxed example omitted from this registry fixture.', kit)
    kit += '''\n\n## FlowSequence\n<FlowSequence nodes={[{ label: "Start" }, { label: "Observe", accent: true }, { label: "Finish" }]} edgeLabels={["step", "result"]} caption="Registry sequence" />\n'''
    (VAULT / KIT_NOTE).write_text(kit, encoding='utf8')
    with tempfile.TemporaryDirectory(prefix='mdx-goal36-') as temp, sync_playwright() as playwright:
        light = run_app(playwright, 'light', free_port(), Path(temp) / 'light')
        dark = run_app(playwright, 'dark', free_port(), Path(temp) / 'dark')
        browser = playwright.chromium.launch(headless=True)
        static = check_export(browser, BASE / 'static.html', 'static-export', False)
        interactive = check_export(browser, BASE / 'interactive.html', 'interactive-export', True)
        dark_export = check_export(browser, BASE / 'dark-paper-interactive.html', 'dark-paper-export', True)
        kit_static = check_kit_export(browser, BASE / 'kit-static.html', 'static-kit')
        kit_interactive = check_kit_export(browser, BASE / 'kit-interactive.html', 'interactive-kit')
        browser.close()
        other_browsers = {}
        for name in ('firefox', 'webkit'):
            try:
                other = getattr(playwright, name).launch(headless=True)
            except Exception as error:
                other_browsers[name] = {'status': 'NOT CHECKED', 'reason': str(error).splitlines()[0]}
                continue
            try:
                other_browsers[name] = check_other_browser(
                    other, BASE / 'interactive.html', name)
            finally:
                other.close()
    assert dark['print_paper'] == 'rgb(249, 249, 247)', dark['print_paper']
    assert dark_export['body_background'] == 'rgb(249, 249, 247)'
    evidence = {'light_export': light, 'dark': dark, 'static': static,
                'interactive': interactive, 'dark_export': dark_export,
                'kit_static': kit_static, 'kit_interactive': kit_interactive,
                'other_browsers': other_browsers}
    (BASE / 'browser-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf8')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    main()
