import json
import re

path = r"C:\Users\NCHIMUNA\.cursor\projects\d-Y4S1-projects-Construction-Company-Management-System-CCMS\agent-transcripts\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc.jsonl"
out = r"d:\Y4S1\projects\Construction Company Management System (CCMS)\_tmp_topbar_history.txt"

# Find all StrReplace/Write touching topbar or sidebar background in main.css
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

parts = []
for i, line in enumerate(lines):
    try:
        obj = json.loads(line)
    except Exception:
        continue
    content = obj.get("message", {}).get("content", [])
    if not isinstance(content, list):
        continue
    for c in content:
        if not isinstance(c, dict) or c.get("type") != "tool_use":
            continue
        name = c.get("name")
        inp = c.get("input", {})
        p = str(inp.get("path", ""))
        if "main.css" not in p:
            continue
        if name == "StrReplace":
            old = inp.get("old_string", "")
            new = inp.get("new_string", "")
            blob = old + new
            if re.search(r"\.topbar\b|\.sidebar\b|backdrop-filter|rgba\(255,\s*255,\s*255|::before|::after|overlay|bg-white|--ccms-ink", blob):
                parts.append(f"\n==== LINE {i+1} StrReplace ====\n")
                # extract just the topbar/sidebar related portions
                for label, text in (("OLD", old), ("NEW", new)):
                    parts.append(f"-- {label} --\n")
                    # print whole if short, else find relevant sections
                    if len(text) < 2500:
                        parts.append(text + "\n")
                    else:
                        for m in re.finditer(
                            r"(.{0,80}(?:\.topbar|\.sidebar|backdrop-filter|rgba\(255,\s*255,\s*255|::before|::after|bg-white|--ccms-ink).{0,400})",
                            text,
                            re.S | re.I,
                        ):
                            parts.append(m.group(1) + "\n---\n")
        elif name == "Write":
            contents = inp.get("contents", "")
            if re.search(r"\.topbar\s*\{", contents):
                m = re.search(r"\.topbar\s*\{[^}]+\}", contents)
                s = re.search(r"\.sidebar\s*\{[^}]+\}", contents)
                parts.append(f"\n==== LINE {i+1} Write main.css ====\n")
                if s:
                    parts.append("SIDEBAR: " + s.group(0) + "\n")
                if m:
                    parts.append("TOPBAR: " + m.group(0) + "\n")

# Also dump user queries near end
parts.append("\n\n==== USER QUERIES from line 600+ ====\n")
for i, line in enumerate(lines):
    if i < 600:
        continue
    obj = json.loads(line)
    if obj.get("role") != "user":
        continue
    content = obj.get("message", {}).get("content", [])
    for c in content:
        if isinstance(c, dict) and c.get("type") == "text":
            t = c.get("text", "")
            # strip system stuff, keep user_query
            m = re.search(r"<user_query>\s*(.*?)\s*</user_query>", t, re.S)
            parts.append(f"LINE {i+1}: {(m.group(1) if m else t)[:800]}\n")

with open(out, "w", encoding="utf-8") as f:
    f.write("".join(parts))
print("wrote", out, "parts", len(parts))
