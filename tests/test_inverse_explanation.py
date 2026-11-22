"""Check the compact, accurate inverse explanation derived from fixed verified data."""
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
    page.locator('#capacitySlider').fill('155')
    page.locator('#inverseTab').click();page.wait_for_timeout(120)
    assert '質量分析を想定した架空' in page.locator('.inv-observed-title').inner_text()
    assert page.locator('.inv-target-bar').get_attribute('aria-label')=='架空の観測分布：糖鎖A25%、B20%、C55%'
    assert page.locator('#inverseCapLive').inner_text()=='58'
    assert page.locator('#capacityChange').is_hidden()
    page.locator('#autoCorrect').click();page.wait_for_timeout(170)
    assert page.locator('#inverseCapLive').inner_text()=='66'
    assert page.locator('#inverseCapDelta').inner_text()=='+8'
    assert page.locator('#capacityChange').is_visible()
    assert page.locator('#inverseResultTotalFlow').inner_text()=='120'
    assert page.locator('#gapHeadline').inner_text()=='0.0'
    assert 'Forwardを再計算した結果ではなく' in page.locator('#gapDescription').inner_text()
    page.locator('.inverse-why summary').click()
    assert '事前計算済み' in page.locator('.inverse-why').inner_text()
    page.locator('#backBefore').click();page.wait_for_timeout(100)
    assert page.locator('#inverseCapLive').inner_text()=='58'
    page.locator('#toForward').click()
    assert page.locator('#capacityPercentage').inner_text()=='155%'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    page.close()
  browser.close()
print('PASS: v9 compact inverse, target, capacity before/after, math caveat, responsive')
