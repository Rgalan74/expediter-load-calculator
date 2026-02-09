import json

try:
    with open('lighthouse-report.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    audits = data.get('audits', {})

    print("--- ACCESSIBILITY FAILURES ---")
    contrast = audits.get('color-contrast', {})
    if contrast.get('score') != 1:
        print(f"Color Contrast Score: {contrast.get('score')}")
        for item in contrast.get('details', {}).get('items', []):
            print(f"- Node: {item.get('node', {}).get('snippet')}")

    print("\n--- LCP ANALYSIS ---")
    lcp = audits.get('largest-contentful-paint-element', {})
    print(f"LCP Element: {lcp.get('details', {}).get('items', [{}])[0].get('node', {}).get('snippet')}")
    
    preload = audits.get('uses-rel-preload', {})
    if preload.get('score') != 1:
        print("Suggestion: Preload key requests")

except Exception as e:
    print(f"Error: {e}")
