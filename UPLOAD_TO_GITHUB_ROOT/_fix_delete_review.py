from pathlib import Path
p=Path('admin-main.js')
text=p.read_text(encoding='utf-8', errors='replace')
text=text.replace('РЈРґР°Р»РёС‚СЊ','Удалить')
needle='<div class="btn" style="color:var(--red);border-color:var(--rb)">' 
if needle in text:
    text=text.replace(needle, '<div class="btn" style="color:var(--red);border-color:var(--rb)" data-id="'+"'+(r.id||'')+'"+'" onclick="deleteReviewAdmin(this.dataset.id)">', 1)
else:
    # fallback: insert onclick into any red delete button without data-id
    import re
    def _repl(m):
        return m.group(1)+' data-id="'+"'+(r.id||'')+'"+'" onclick="deleteReviewAdmin(this.dataset.id)">'
    text=re.sub(r'(<div class="btn" style="color:var\(--red\);border-color:var\(--rb\)")>', _repl, text, count=1)

p.write_text(text, encoding='utf-8')
print('patched')
