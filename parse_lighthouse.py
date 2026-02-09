import json
import sys

try:
    with open('lighthouse-report.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    categories = data.get('categories', {})
    print("--- LIGHTHOUSE SCORES ---")
    for cat_id, cat_data in categories.items():
        score = cat_data.get('score', 0) * 100
        print(f"{cat_data.get('title')}: {score:.1f}")

    print("\n--- PWA CHECKS ---")
    audits = data.get('audits', {})
    installable = audits.get('installable-manifest', {}).get('score') == 1
    service_worker = audits.get('service-worker', {}).get('score') == 1
    print(f"Installable Manifest: {'PASS' if installable else 'FAIL'}")
    print(f"Service Worker: {'PASS' if service_worker else 'FAIL'}")

    print("\n--- PERFORMANCE METRICS ---")
    metrics = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift']
    for m in metrics:
        audit = audits.get(m, {})
        print(f"{audit.get('title')}: {audit.get('displayValue')} (Score: {audit.get('score')})")

    print("\n--- OPPORTUNITIES ---")
    layout_shift = audits.get('layout-shift-elements', {})
    if layout_shift.get('details', {}).get('items'):
        print(f"CLS Contributors: {len(layout_shift.get('details', {}).get('items'))} elements")

    images = audits.get('modern-image-formats', {})
    if images.get('score') != 1:
         savings = images.get('details', {}).get('overallSavingsBytes', 0) / 1024
         print(f"Use WebP/AVIF: Save {savings:.2f} KB")

except Exception as e:
    print(f"Error: {e}")
