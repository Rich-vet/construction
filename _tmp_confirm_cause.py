import json
import re

path = r"C:\Users\NCHIMUNA\.cursor\projects\d-Y4S1-projects-Construction-Company-Management-System-CCMS\agent-transcripts\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc.jsonl"

# Confirm: after line 635 token remap, was sidebar still using --ccms-charcoal and topbar still rgba(255)?
# Search all of main.css content as of last Write/final state in transcript by reconstructing from last full read... 
# Simpler: search assistant texts and StrReplace for whether topbar background was ever updated in 631-651

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

hits = []
for i in range(631, 652):
    obj = json.loads(lines[i])
    content = obj.get("message", {}).get("content", [])
    raw = json.dumps(content)
    for pat in [
        r"rgba\(255,\s*255,\s*255,\s*0\.92\)",
        r"rgba\(11,\s*18,\s*32",
        r"--ccms-ink",
        r"\.topbar\s*\{[^}]{0,300}",
        r"\.sidebar\s*\{[^}]{0,300}",
        r"::before",
        r"::after",
    ]:
        for m in re.finditer(pat, raw):
            hits.append(f"L{i+1} {pat}: ...{m.group(0)[:180]}...")

print("\n".join(hits) if hits else "NO HITS for topbar dark fix / ink / ::before overlays in dark-pass lines")

# Also check if sidebar background string appears with charcoal in line 635 new_string tokens only
obj = json.loads(lines[634])  # line 635
for c in obj["message"]["content"]:
    if c.get("type")=="tool_use" and c.get("name")=="StrReplace":
        ns = c["input"].get("new_string","")
        if "--ccms-charcoal: #e2e8f0" in ns:
            print("CONFIRMED: charcoal remapped to #e2e8f0 in line 635")
            print("text:", re.search(r"--ccms-text:[^;]+", ns).group(0))
            print("text-inverse:", re.search(r"--ccms-text-inverse:[^;]+", ns).group(0))
