import re
import sys

def check_html(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        print(f"Error: File {file_path} is not valid UTF-8.")
        return

    # Check for duplicate IDs
    ids = re.findall(r'id=["\']([^"\']+)["\']', content)
    id_counts = {}
    for i in ids:
        id_counts[i] = id_counts.get(i, 0) + 1
    
    duplicates = [i for i, count in id_counts.items() if count > 1]
    
    if duplicates:
        print("Duplicate IDs found:")
        for d in duplicates:
            print(f"  - {d}")
    else:
        print("No duplicate IDs found.")

    # Check for suspicious encoding artifacts
    suspicious = ["Ã“", "Ã", "Â", "â ³"]
    found_suspicious = []
    lines = content.split('\n')
    for line_num, line in enumerate(lines, 1):
        for s in suspicious:
            if s in line:
                found_suspicious.append((line_num, s, line.strip()))
    
    if found_suspicious:
        print("\nSuspicious encoding artifacts found:")
        for line_num, char, line in found_suspicious:
            print(f"  Line {line_num}: Contains '{char}' -> {line[:50]}...")
    else:
        print("\nNo suspicious encoding artifacts found.")

if __name__ == "__main__":
    check_html(sys.argv[1])
