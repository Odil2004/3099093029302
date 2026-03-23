from pathlib import Path
import re
p=Path('admin-main.js')
text=p.read_text(encoding='utf-8', errors='replace')
# 1) Remove accidental deleteReviewAdmin wiring from user block button
text=text.replace(' data-id="'+"'+(r.id||'')+'"+'" onclick="deleteReviewAdmin(this.dataset.id)"','')

# 2) Fix delete button in renderReviews block
start=text.find('function renderReviews')
end=text.find('function renderAiLog', start)
if start!=-1 and end!=-1:
    block=text[start:end]
    # ensure label in that block is proper
    block=block.replace('РЈРґР°Р»РёС‚СЊ','Удалить')
    # add onclick + data-id to delete button in reviews table
    # match the delete btn div without onclick in reviews block
    block=re.sub(r'<div class="btn" style="color:var\(--red\);border-color:var\(--rb\)">Удалить</div>',
                 '<div class="btn" style="color:var(--red);border-color:var(--rb)" data-id="'+"'+(r.id||'')+'"+'" onclick="deleteReviewAdmin(this.dataset.id)">Удалить</div>',
                 block)
    text=text[:start]+block+text[end:]

p.write_text(text, encoding='utf-8')
print('patched')
