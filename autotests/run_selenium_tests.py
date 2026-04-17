#!/usr/bin/env python3
"""
UI autotests for Three.js editor using Selenium + Google Chrome.

What this script does:
1) Starts a local static server for the project root.
2) Opens Chrome window with the app.
3) Runs a sequence of UI tests.
4) Prints results and exits with non-zero code on failure.
"""

from __future__ import annotations

import http.server
import os
import socketserver
import sys
import threading
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


PROJECT_ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 8765
BASE_URL = f"http://{HOST}:{PORT}"
WAIT_SECONDS = 15


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args) -> None:
        return


@dataclass
class TestCase:
    name: str
    fn: Callable[[webdriver.Chrome], None]


def start_static_server(root: Path, host: str, port: int) -> Tuple[socketserver.TCPServer, threading.Thread]:
    os.chdir(root)
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer((host, port), QuietHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def wait_for(driver: webdriver.Chrome, condition) -> None:
    WebDriverWait(driver, WAIT_SECONDS).until(condition)


def text_of(driver: webdriver.Chrome, by: By, selector: str) -> str:
    return driver.find_element(by, selector).text.strip()


def value_of(driver: webdriver.Chrome, by: By, selector: str) -> str:
    return driver.find_element(by, selector).get_attribute("value")


def open_app(driver: webdriver.Chrome) -> None:
    driver.get(BASE_URL)
    wait_for(driver, EC.presence_of_element_located((By.ID, "viewport")))
    wait_for(driver, EC.presence_of_element_located((By.ID, "preview3d")))


def test_page_loads(driver: webdriver.Chrome) -> None:
    open_app(driver)
    title = driver.title
    if "Three.js Mini Editor" not in title:
        raise AssertionError(f"Unexpected page title: {title}")


def test_main_ui_sections_visible(driver: webdriver.Chrome) -> None:
    open_app(driver)
    for selector in ["#topProjection", "#frontProjection", "#preview3d", "#previewTiltAngle", "#saveBtn", "#exportGlbBtn"]:
        if not driver.find_element(By.CSS_SELECTOR, selector).is_displayed():
            raise AssertionError(f"Element is not visible: {selector}")


def test_add_object_updates_selection(driver: webdriver.Chrome) -> None:
    open_app(driver)
    add_button = driver.find_element(By.CSS_SELECTOR, "button[data-add='box']")
    add_button.click()
    time.sleep(0.2)
    selection_text = text_of(driver, By.ID, "selectionInfo")
    if not selection_text.startswith("Выбран:"):
        raise AssertionError(f"Selection text not updated: {selection_text}")


def test_properties_populate_for_selected(driver: webdriver.Chrome) -> None:
    open_app(driver)
    driver.find_element(By.CSS_SELECTOR, "button[data-add='sphere']").click()
    time.sleep(0.2)
    pos_x = value_of(driver, By.ID, "posX")
    size_x = value_of(driver, By.ID, "sizeX")
    if pos_x == "" or size_x == "":
        raise AssertionError("Position/size fields are empty after selecting object.")


def test_duplicate_changes_selected_object(driver: webdriver.Chrome) -> None:
    open_app(driver)
    driver.find_element(By.CSS_SELECTOR, "button[data-add='cylinder']").click()
    time.sleep(0.2)
    before = text_of(driver, By.ID, "selectionInfo")
    driver.find_element(By.ID, "duplicateBtn").click()
    time.sleep(0.2)
    after = text_of(driver, By.ID, "selectionInfo")
    if not after.startswith("Выбран:"):
        raise AssertionError(f"Unexpected selection text after duplicate: {after}")
    if before == after:
        raise AssertionError("Selection did not change after duplication.")


def test_backspace_deletes_selected(driver: webdriver.Chrome) -> None:
    open_app(driver)
    driver.find_element(By.CSS_SELECTOR, "button[data-add='torus']").click()
    time.sleep(0.2)
    body = driver.find_element(By.TAG_NAME, "body")
    body.send_keys(Keys.BACKSPACE)
    time.sleep(0.2)
    selection_text = text_of(driver, By.ID, "selectionInfo")
    if selection_text != "Выберите объект":
        raise AssertionError(f"Object was not deleted via Backspace. Current: {selection_text}")


def test_preview_tilt_control_works(driver: webdriver.Chrome) -> None:
    open_app(driver)
    slider = driver.find_element(By.ID, "previewTiltAngle")
    driver.execute_script("arguments[0].value = '30'; arguments[0].dispatchEvent(new Event('input'));", slider)
    time.sleep(0.1)
    value_text = text_of(driver, By.ID, "previewTiltValue")
    if "30deg" not in value_text:
        raise AssertionError(f"Preview tilt value did not update: {value_text}")


def test_catalog_item_is_draggable(driver: webdriver.Chrome) -> None:
    open_app(driver)
    row = driver.find_element(By.CSS_SELECTOR, ".catalog-item")
    draggable = row.get_attribute("draggable")
    if str(draggable).lower() != "true":
        raise AssertionError("Catalog item is not draggable.")


def test_export_glb_button_exists(driver: webdriver.Chrome) -> None:
    open_app(driver)
    button = driver.find_element(By.ID, "exportGlbBtn")
    if button.text.strip() == "":
        raise AssertionError("Export GLB button text is empty.")


def canvas_signature(driver: webdriver.Chrome, canvas_selector: str) -> int:
    script = """
    const canvas = document.querySelector(arguments[0]);
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -2;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 16) {
      sum = (sum + data[i] + data[i + 1] * 3 + data[i + 2] * 7 + data[i + 3]) % 2147483647;
    }
    return sum;
    """
    return int(driver.execute_script(script, canvas_selector))


def canvas_non_background_pixels(
    driver: webdriver.Chrome, canvas_selector: str, bg_rgb: Tuple[int, int, int] = (11, 16, 32)
) -> int:
    script = """
    const canvas = document.querySelector(arguments[0]);
    if (!canvas) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -2;
    const bg = arguments[1];
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.abs(r - bg[0]) > 2 || Math.abs(g - bg[1]) > 2 || Math.abs(b - bg[2]) > 2) {
        count += 1;
      }
    }
    return count;
    """
    return int(driver.execute_script(script, canvas_selector, list(bg_rgb)))


def test_projection_canvases_render_content(driver: webdriver.Chrome) -> None:
    open_app(driver)
    time.sleep(0.4)
    top_non_bg = canvas_non_background_pixels(driver, "#topProjection")
    front_non_bg = canvas_non_background_pixels(driver, "#frontProjection")
    if top_non_bg <= 50:
        raise AssertionError(f"Top projection seems empty. Non-bg pixels: {top_non_bg}")
    if front_non_bg <= 50:
        raise AssertionError(f"Front projection seems empty. Non-bg pixels: {front_non_bg}")


def test_projection_canvas_updates_after_scene_change(driver: webdriver.Chrome) -> None:
    open_app(driver)
    time.sleep(0.3)
    sig_before = canvas_signature(driver, "#topProjection")
    driver.find_element(By.CSS_SELECTOR, "button[data-add='box']").click()
    time.sleep(0.5)
    sig_after = canvas_signature(driver, "#topProjection")
    if sig_before == sig_after:
        raise AssertionError("Top projection canvas signature did not change after scene update.")


def test_preview_webgl_canvas_present_and_sized(driver: webdriver.Chrome) -> None:
    open_app(driver)
    script = """
    const root = document.querySelector('#preview3d');
    if (!root) return { ok: false, reason: 'root missing' };
    const canvas = root.querySelector('canvas');
    if (!canvas) return { ok: false, reason: 'canvas missing' };
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    return {
      ok: !!gl,
      reason: gl ? '' : 'webgl context missing',
      width: canvas.width,
      height: canvas.height
    };
    """
    result = driver.execute_script(script)
    if not result.get("ok"):
        raise AssertionError(f"Preview WebGL canvas invalid: {result.get('reason')}")
    if result.get("width", 0) <= 0 or result.get("height", 0) <= 0:
        raise AssertionError(f"Preview canvas has invalid size: {result}")


def dispatch_product_drop(driver: webdriver.Chrome, canvas_selector: str, x: float, y: float) -> bool:
    script = """
    const canvas = document.querySelector(arguments[0]);
    const row = document.querySelector('.catalog-item[data-product-id="product1"]');
    const x = arguments[1];
    const y = arguments[2];
    if (!canvas || !row) return false;

    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + x;
    const clientY = rect.top + y;
    const dt = new DataTransfer();
    dt.setData('text/product-id', 'product1');

    const dragStart = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt });
    row.dispatchEvent(dragStart);

    const dragOver = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
      clientX,
      clientY
    });
    canvas.dispatchEvent(dragOver);

    const drop = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
      clientX,
      clientY
    });
    canvas.dispatchEvent(drop);

    const dragEnd = new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt });
    row.dispatchEvent(dragEnd);
    return true;
    """
    return bool(driver.execute_script(script, canvas_selector, x, y))


def test_drag_product_from_table_to_projection_canvas(driver: webdriver.Chrome) -> None:
    open_app(driver)
    # Make one deterministic target near center.
    driver.find_element(By.CSS_SELECTOR, "button[data-add='box']").click()
    time.sleep(0.2)
    driver.execute_script(
        """
        const setInput = (id, value) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.value = value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setInput('posX', '0');
        setInput('posY', '1');
        setInput('posZ', '0');
        """
    )
    time.sleep(0.4)

    before = canvas_signature(driver, "#topProjection")
    width = int(driver.execute_script("return document.querySelector('#topProjection').width;"))
    height = int(driver.execute_script("return document.querySelector('#topProjection').height;"))

    # Try a grid of points to hit any object silhouette.
    hit = False
    for fx in [0.25, 0.35, 0.5, 0.65, 0.75]:
        for fy in [0.25, 0.35, 0.5, 0.65, 0.75]:
            x = width * fx
            y = height * fy
            dispatch_product_drop(driver, "#topProjection", x, y)
            time.sleep(0.15)
            after = canvas_signature(driver, "#topProjection")
            if after != before:
                hit = True
                break
        if hit:
            break

    if not hit:
        raise AssertionError("Could not place product on projection canvas via drag&drop.")

    # Scroll sidebar to projection area and keep it visible for manual observation.
    driver.execute_script(
        """
        const topView = document.querySelector('#topProjection');
        if (topView) {
          topView.scrollIntoView({ behavior: 'instant', block: 'center' });
        } else {
          const sidebar = document.querySelector('.sidebar');
          if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
        }
        """
    )
    time.sleep(3.0)


def build_test_plan() -> List[TestCase]:
    return [
        TestCase("Page loads", test_page_loads),
        TestCase("Main UI sections visible", test_main_ui_sections_visible),
        TestCase("Projection canvases render content", test_projection_canvases_render_content),
        TestCase("Projection canvas updates on scene changes", test_projection_canvas_updates_after_scene_change),
        TestCase("Preview WebGL canvas present and sized", test_preview_webgl_canvas_present_and_sized),
        TestCase("Drag product from table to projection canvas", test_drag_product_from_table_to_projection_canvas),
        TestCase("Add object updates selection", test_add_object_updates_selection),
        TestCase("Properties populate for selected object", test_properties_populate_for_selected),
        TestCase("Duplicate changes selected object", test_duplicate_changes_selected_object),
        TestCase("Backspace deletes selected object", test_backspace_deletes_selected),
        TestCase("Preview tilt control works", test_preview_tilt_control_works),
        TestCase("Catalog item is draggable", test_catalog_item_is_draggable),
        TestCase("Export GLB button exists", test_export_glb_button_exists),
    ]


def create_driver() -> webdriver.Chrome:
    options = webdriver.ChromeOptions()
    options.add_argument("--window-size=1600,1000")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    # Use webdriver-manager to avoid stale chromedriver from PATH.
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def run_tests() -> int:
    server, _thread = start_static_server(PROJECT_ROOT, HOST, PORT)
    driver: Optional[webdriver.Chrome] = None
    results: List[Tuple[str, bool, str]] = []

    try:
        driver = create_driver()
        driver.set_page_load_timeout(WAIT_SECONDS)
        for case in build_test_plan():
            try:
                case.fn(driver)
                results.append((case.name, True, ""))
            except (AssertionError, TimeoutException, Exception) as exc:
                detail = f"{exc}\n{traceback.format_exc(limit=1)}"
                results.append((case.name, False, detail))
    finally:
        if driver is not None:
            driver.quit()
        server.shutdown()
        server.server_close()

    print("\n=== Selenium Autotest Report ===")
    passed = 0
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}")
        if not ok and detail:
            print(f"  -> {detail.strip()}")
        if ok:
            passed += 1

    total = len(results)
    print(f"\nResult: {passed}/{total} tests passed.")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run_tests())
