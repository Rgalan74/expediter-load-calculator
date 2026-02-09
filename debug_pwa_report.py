import json

try:
    with open('lighthouse-report.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Available Categories:", list(data.get('categories', {}).keys()))
    
    pwa_cat = data.get('categories', {}).get('pwa', {})
    if pwa_cat:
        print("\nPWA Category Found!")
        print(json.dumps(pwa_cat, indent=2))
    else:
        print("\nPWA Category NOT found in 'categories' object.")

    # Check for PWA-specific audits to see failure reasons
    print("\n--- PWA Audit Details ---")
    audits = data.get('audits', {})
    
    # helper to print audit
    def print_audit(key):
        audit = audits.get(key, {})
        print(f"\n{key}: {audit.get('score')}")
        if audit.get('explanation'):
            print(f"Explanation: {audit.get('explanation')}")
        if audit.get('details'):
            print(f"Details: {str(audit.get('details'))[:200]}...") # Truncate for brevity

    print_audit('installable-manifest')
    print_audit('service-worker')
    print_audit('splash-screen')
    print_audit('themed-omnibox')
    print_audit('content-width')
    print_audit('viewport')
    
except Exception as e:
    print(f"Error: {e}")
