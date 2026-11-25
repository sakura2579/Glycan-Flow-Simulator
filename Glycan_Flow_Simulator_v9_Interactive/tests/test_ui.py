"""Basic browser smoke tests for v9; optional: playwright+Chromium."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parents[1]
html=(p/'index.html').read_text(encoding='utf-8')
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1366,768),(390,844)]:
    page=browser.new_page(viewport={'width':w,'height':h})
    errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(html)
    original=float(page.locator('#gapHeadline').inner_text())
    assert 'E13' in page.locator('#firstTipTitle').inner_text()
    page.locator('#capacitySlider').fill('150');page.wait_for_timeout(200)
    assert float(page.locator('#gapHeadline').inner_text())<original
    assert '近づきました' in page.locator('#changeFeedback').inner_text()
    page.locator('#compareMethods').click()
    assert page.locator('#methodComparison').is_visible()
    assert page.locator('.compare-item').count()==4
    assert page.locator('#capacityPercentage').inner_text()=='150%'
    page.locator('#compareMethods').click()
    assert page.locator('#methodComparison').is_hidden()
    page.locator('button[data-method="SU"]').click();page.wait_for_timeout(150)
    assert page.locator('button[data-method="SU"]').get_attribute('aria-pressed')=='true'
    page.locator('#reset').click();page.wait_for_timeout(150)
    assert page.locator('#capacityPercentage').inner_text()=='100%'
    page.locator('[aria-label="反応 E1 を選択"]').click()
    page.locator('#capacitySlider').fill('0');page.wait_for_timeout(200)
    assert page.locator('#totalFlow').inner_text()=='0.0'
    assert page.locator('#gapNumber').inner_text()=='—'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    page.close()
  browser.close()
print('PASS: v9 first action, comparing, method switching, zero flow, mobile')
