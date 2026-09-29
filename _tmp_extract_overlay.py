import json
import re

path = r"C:\Users\NCHIMUNA\.cursor\projects\d-Y4S1-projects-Construction-Company-Management-System-CCMS\agent-transcripts\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc\c2dbaf21-64a0-4ce6-a05a-ed3a056f7dbc.jsonl"
out = r"d:\Y4S1\projects\Construction Company Management System (CCMS)\_tmp_overlay_extract.txt"

# Extract user messages near the end and assistant text about dark/white/sidebar/topbar
keywords = re.compile(
    r"white|overlay|sidebar|topbar|nav bar|dark mode|::before|::after|backdrop|rgba\(255|compact|pending|not visible|washed",
    re.I,
)

with open(path, encoding="utf-8") as f:
    lines = f.readlines()

chunks = []
# Scan last ~80 assistant/user messages for relevance
for i, line in enumerate(lines):
    if i < 580:
        continue
    obj = json.loads(line)
    role = obj.get("role")
    content = obj.get("message", {}).get("content", [])
    texts = []
    tool_notes = []
    if isinstance(content, list):
        for c in content:
            if not isinstance(c, dict):
                continue
            if c.get("type") == "text":
                texts.append(c.get("text", ""))
            elif c.get("type") == "tool_use":
                name = c.get("name")
                inp = c.get("input", {})
                if name == "StrReplace" and "main.css" in str(inp.get("path", "")):
                    old = inp.get("old_string", "")
                    new = inp.get("new_string", "")
                    if keywords.search(old + new):
                        tool_notes.append(
                            f"StrReplace main.css\nOLD:\n{old[:1500]}\nNEW:\n{new[:1500]}\n"
                        )
                elif name in ("Grep", "Read") and keywords.search(str(inp)):
                    tool_notes.append(f"{name}: {json.dumps(inp)[:400]}")
    joined = "\n".join(texts)
    if texts and (keywords.search(joined) or i >= 640 or role == "user"):
        chunks.append(f"\n{'='*60}\nLINE {i+1} {role}\n")
        if texts:
            chunks.append(joined[:3500] + ("\n...(trunc)\n" if len(joined) > 3500 else "\n"))
        for t in tool_notes[:5]:
            chunks.append(t + "\n")

with open(out, "w", encoding="utf-8") as f:
    f.write(f"total_lines={len(lines)}\n")
    f.write("".join(chunks))
print("done", len(chunks))
