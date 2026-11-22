"""v9 visual/interaction acceptance tests; run with python tests/test_v9_interaction.py."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parents[1]
html=(p/'index.html').read_text(encoding='utf-8')
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
  for w,h in [(1366,768),(1280,720),(390,844)]:
    page=browser.new_page(viewport={'width':w,'height':h})
    errors=[]
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    page.set_content(html)
    page.wait_for_timeout(300)
    assert page.locator('#gapHeadline').inner_text()!='—'
    orig=page.locator('#gapHeadline').inner_text()
    page.locator('#capacitySlider').fill('150');page.wait_for_timeout(200)
    assert float(page.locator('#gapHeadline').inner_text())<float(orig)
    assert page.locator('#capacityPercentage').inner_text()=='150%'
    page.locator('#playMethods').click()
    page.wait_for_timeout(300)
    assert page.locator('#capacityPercentage').inner_text()=='200%'
    assert page.locator('button[data-method="UQ"]').get_attribute('aria-pressed')=='true'
    assert page.locator('#restoreManualQuick').is_visible()
    page.wait_for_timeout(1600)
    assert page.locator('button[data-method="CWQ"]').get_attribute('aria-pressed')=='true'
    page.wait_for_timeout(1600)
    assert page.locator('button[data-method="SU"]').get_attribute('aria-pressed')=='true'
    assert '55.1%' in page.locator('.glycan').nth(2).inner_text(),page.locator('.glycan').nth(2).inner_text()
    if w==1366:
      page.screenshot(path=str(p/'previews'/'v9_forward_method_demo.png'))
    page.wait_for_timeout(1650)
    assert page.locator('button[data-method="LCRQ"]').get_attribute('aria-pressed')=='true'
    page.wait_for_timeout(1400)
    assert page.locator('#playMethods').get_attribute('aria-pressed')=='false'
    page.locator('#restoreManualQuick').click();page.wait_for_timeout(200)
    assert page.locator('#capacityPercentage').inner_text()=='150%'
    assert page.locator('#restoreManualQuick').is_hidden()
    page.locator('#toInverse').click()
    page.wait_for_timeout(400)
    assert page.locator('#inverseCapLive').inner_text()=='58'
    assert page.locator('.inv-target-bar').is_visible()
    assert '架空' in page.locator('.inv-observed-title').inner_text()
    if w==1366:
      page.screenshot(path=str(p/'previews'/'v9_inverse_before.png'),full_page=True)
    page.locator('#autoCorrect').click();page.wait_for_timeout(500)
    assert page.locator('#inverseCapLive').inner_text()=='66'
    assert page.locator('#capacityChange').is_visible()
    assert page.locator('#gapHeadline').inner_text()=='0.0'
    assert 'Forwardを再計算した結果ではなく' in page.locator('#gapDescription').inner_text()
    assert page.locator('#inverseResultNote').is_visible()
    if w==1366:
      page.screenshot(path=str(p/'previews'/'v9_inverse_after.png'),full_page=True)
    page.locator('#backBefore').click();page.wait_for_timeout(250)
    assert page.locator('#inverseCapLive').inner_text()=='58'
    page.locator('#toForward').click();page.wait_for_timeout(250)
    assert page.locator('#capacityPercentage').inner_text()=='150%'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(w,h)
    if h>=700 and w>=1100:
      dim=page.evaluate('({h:document.documentElement.scrollHeight,ih:innerHeight})')
      assert dim['h']<=dim['ih'],(w,h,dim)
    assert not errors,(w,h,errors)
    page.close()
  browser.close()
print('PASS: v9 playback, restore manual, inverse capacity animation, mobile, one-screen desktop')
