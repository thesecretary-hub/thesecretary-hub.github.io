from pathlib import Path
s=Path('work/check-content.cjs').read_text(encoding='utf-8')
s=s.replace("username:'mobiletester'", "id:'test',role:'admin',username:'mobiletester'")
s=s.replace("table==='posts'?[post]", "table==='profiles'?[person]:table==='posts'?[post]")
s=s.replace('user:null',"user:{id:'test'}").replace('session:null',"session:{access_token:'fixture'}")
s=s.replace("['/','/posts/','/forums/','/topic/?slug=test','/content/?type=post&slug=test']", "['/admin/','/admin/posts/','/admin/incidents/','/admin/maintenance/','/admin/servers/','/admin/webhooks/','/profile/']")
s=s.replace('8766','8767');Path('work/check-admin.cjs').write_text(s,encoding='utf-8')
