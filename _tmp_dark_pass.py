import json
import re

path = r"C:\Users\NCHIMUNA\.cursor\projects\d-Y4S1-projects-Construction-Company-Management-System-CCMS\agent-transcripts\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc.jsonl"

# Focus on lines 631-651: dark-mode StrReplace that touch topbar/sidebar or leave white backgrounds
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

out = []
for i in range(631, 652):
    obj = json.loads(lines[i])
    role = obj.get("role")
    content = obj.get("message", {}).get("content", [])
    out.append(f"\n######## LINE {i+1} {role} ########\n")
    if not isinstance(content, list):
        continue
    for c in content:
        if not isinstance(c, dict):
            continue
        if c.get("type") == "text":
            out.append("TEXT: " + c.get("text", "")[:2000] + "\n")
        elif c.get("type") == "tool_use":
            name = c.get("name")
            inp = c.get("input", {})
            if name == "StrReplace":
                p = inp.get("path", "")
                old = inp.get("old_string", "")
                new = inp.get("new_string", "")
                # check relevance
                keys = ["topbar", "sidebar", "rgba(255", "::before", "bg-white", "backdrop", "page-title", "nav-item", "color:", "background"]
                blob = (old + new).lower()
                relevant = any(k in blob for k in keys) or "main.css" in str(p)
                out.append(f"StrReplace -> {p}\n")
                if "main.css" in str(p) and (
                    ".topbar" in old + new
                    or ".sidebar" in old + new
                    or "bg-white" in old + new
                    or "rgba(255" in old + new
                    or "backdrop" in old + new
                ):
                    out.append("===RELEVANT OLD===\n" + old[:3000] + "\n")
                    out.append("===RELEVANT NEW===\n" + new[:3000] + "\n")
                elif "main.css" in str(p):
                    # summarize what changed - first 200 chars of old/new
                    out.append(f"  (other css) old_start={old[:120]!r} new_start={new[:120]!r}\n")
            elif name == "Grep":
                out.append(f"Grep {inp.get('pattern')}\n")
            elif name == "Read":
                out.append(f"Read {inp.get('path')}\n")
            elif name in ("Delete", "Write"):
                out.append(f"{name} {inp.get('path')}\n")
            else:
                out.append(f"{name}\n")

path_out = r"d:\Y4S1\projects\Construction Company Management System (CCMS)\_tmp_dark_pass.txt"
with open(path_out, "w", encoding="utf-8") as f:
    f.write("".join(out))
print("wrote", path_out)
