from pathlib import Path

tag_motion = "m" + "otion.div"
BAD_CLOSE = "</" + tag_motion + ">"
GOOD_CLOSE = "</" + "div" + ">"
BAD_SELF = "></" + tag_motion + ">"
GOOD_SELF = "></" + "div" + ">"

for name in ("index.html", "catalog.html"):
    p = Path(name)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    n1 = t.count(BAD_CLOSE)
    n2 = t.count(BAD_SELF)
    t = t.replace(BAD_CLOSE, GOOD_CLOSE).replace(BAD_SELF, GOOD_SELF)
    p.write_text(t, encoding="utf-8", newline="\n")
    print(name, "fixed", n1 + n2, "still_bad", BAD_CLOSE in t)
