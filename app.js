const app = document.getElementById('app');
const sessionBox = document.getElementById('sessionBox');
const DB_KEY = 'smart-school-db-v1';
const SESSION_KEY = 'smart-school-session';

const subjects69 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','العلوم','الدراسات الاجتماعية','التربية البدنية'];
const subjects10 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','فيزياء','كيمياء','احياء','الدراسات الاجتماعية','التربية البدنية'];
const grades = ['السادس','السابع','الثامن','التاسع','العاشر'];

const secretDigests = { student: 'MzAyMDE=', teacher: 'OTUxOTUx', admin: 'MjUxMjAxMQ==' };
const db = JSON.parse(localStorage.getItem(DB_KEY) || '{"users":[],"posts":[],"chats":[],"notifications":[],"grades":[],"attendance":[]}');
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

const save = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
const saveSession = () => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
const genId = role => `${role.slice(0,1).toUpperCase()}${Math.floor(Math.random()*900000+100000)}`;
const pwValid = p => /^(?=(?:.*\d){7,})(?=(?:.*[A-Za-z]){2,}).{9,}$/.test(p);

function renderAuth() {
  app.innerHTML = document.getElementById('authTemplate').innerHTML;
  const registerForm = document.getElementById('registerForm');
  const tabs = [...document.querySelectorAll('.tabs button')];
  let role = 'student';

  const drawFields = () => {
    registerForm.className = 'stack';
    const adminNameLocked = role === 'admin' ? 'الإدارة المدرسية' : '';
    registerForm.innerHTML = `
      ${role!=='admin'?'<label>الاسم الرباعي<input name="name" required /></label>':'<label>اسم الحساب<input name="name" value="'+adminNameLocked+'" readonly /></label>'}
      <label>البريد الإلكتروني<input name="email" type="email" required /></label>
      <label>كلمة المرور<input name="password" type="password" required /></label>
      <label>الرقم السري<input name="secret" type="password" required /></label>
      ${role==='student'?'<label>الصف<select name="grade" required>'+grades.map(g=>`<option>${g}</option>`).join('')+'</select></label>':''}
      ${role==='teacher'?`
        <label>المواد (حد أقصى مادتين)
          <select name="subjects" multiple size="6">${[...new Set([...subjects69,...subjects10])].map(s=>`<option>${s}</option>`).join('')}</select>
        </label>
        <label>الصفوف التي تدرسها (غير محدود)
          <select name="gradeList" multiple size="5">${grades.map(g=>`<option>${g}</option>`).join('')}</select>
        </label>`:''}
      ${role==='admin'?`<label>الوظيفة<select name="job"><option>مدير</option><option>نائب مدير</option><option>سكرتير</option><option>مرشد تربوي</option></select></label>`:''}
      <button class="primary">إنشاء الحساب</button>
    `;
  };
  drawFields();

  tabs.forEach(btn => btn.onclick = () => {
    tabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); role = btn.dataset.tab; drawFields();
  });

  registerForm.onsubmit = e => {
    e.preventDefault();
    const form = new FormData(registerForm);
    const email = form.get('email').trim().toLowerCase();
    if (db.users.some(u => u.email === email)) return alert('الحساب موجود مسبقاً. استخدم تسجيل الدخول.');
    const password = form.get('password');
    if (!pwValid(password)) return alert('كلمة المرور يجب أن تحتوي 7 أرقام على الأقل وحرفين على الأقل.');
    if (btoa(form.get('secret')) !== secretDigests[role]) return alert('فشل التحقق الأمني.');

    const user = {
      id: genId(role), role, name: (form.get('name') || '').trim(), email, password,
      grade: form.get('grade') || null,
      subjects: form.getAll('subjects').slice(0,2),
      gradeList: form.getAll('gradeList'),
      job: form.get('job') || null,
      theme: '#157347', icon: '⚑', avatar: '', muted: false
    };
    if (role === 'teacher' && user.subjects.length === 0) return alert('اختر مادة واحدة على الأقل.');
    db.users.push(user); save(); alert(`تم إنشاء الحساب بنجاح. ID: ${user.id}`);
  };

  document.getElementById('loginForm').onsubmit = e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const iden = form.get('identifier').trim().toLowerCase();
    const user = db.users.find(u => u.email === iden || u.id.toLowerCase() === iden);
    if (!user || user.password !== form.get('password')) return alert('بيانات الدخول غير صحيحة.');
    session = { id: user.id }; saveSession(); render();
  };
}

function subjectsForGrade(g){return g==='العاشر'?subjects10:subjects69}

function card(title, body){return `<article class="card glass panel"><h3>${title}</h3>${body}</article>`}

function renderDashboard() {
  const me = db.users.find(u=>u.id===session.id);
  if (!me) { session = null; saveSession(); return renderAuth(); }
  app.innerHTML = document.getElementById('dashboardTemplate').innerHTML;
  sessionBox.innerHTML = `<span class="badge">${me.role} - ${me.name}${me.job?` (${me.job})`:''}</span> <button class="mini" id="logout">خروج</button>`;
  document.getElementById('logout').onclick = ()=>{session=null;saveSession();render()};

  const sideMenu = document.getElementById('sideMenu');
  const content = document.getElementById('content');
  const menu = ['الرئيسية','المنشورات','الدردشة','السجل','الإشعارات','الإعدادات'];
  sideMenu.innerHTML = menu.map((m,i)=>`<button class="menu-btn ${i===0?'active':''}" data-v="${m}">${m}</button>`).join('');

  const drawHome = ()=>{
    const common = card('البروفايل', `<p><b>الاسم:</b> ${me.name}</p><p><b>ID:</b> ${me.id}</p><p><b>البريد:</b> ${me.email}</p>`);
    const posts = db.posts.filter(p=>p.to==='all'||!p.to||p.to===me.grade||p.to===me.id).slice(-6).reverse();
    const postHtml = posts.map(p=>`<div class="notice"><b>${p.author}</b><div>${p.text}</div><div class="small">${p.target||'عام'}</div></div>`).join('') || '<p>لا توجد مناشير.</p>';
    const roleBlock = me.role==='student' ? card('بطاقات تفاعلية', '<div class="grid"><button class="mini">سؤال اليوم</button><button class="mini">اختبار سريع</button><button class="mini">مهارة رقمية</button></div>') :
      me.role==='teacher' ? card('معلومات التدريس', `<p>المواد: ${me.subjects.join('، ')}</p><p>الصفوف: ${me.gradeList.join('، ')||'—'}</p>`) :
      card('صلاحيات الإدارة', '<p>نشر تنبيهات/منشورات وإدارة الطلبة حسب الدور.</p>');
    content.innerHTML = `<section class="grid">${common}${roleBlock}${card('آخر المنشورات',postHtml)}</section>`;
  }

  const drawPosts = ()=>{
    const allowedTarget = me.role==='student' ? [] : me.role==='teacher' ? me.gradeList : ['all',...grades];
    const form = me.role==='student' ? '' : `<form id="postForm" class="stack">
      <textarea name="text" required placeholder="اكتب منشوراً..."></textarea>
      <label>الاستهداف<select name="to">${allowedTarget.map(t=>`<option value="${t}">${t==='all'?'جميع الصفوف':t}</option>`).join('')}</select></label>
      <button class="primary">نشر</button>
    </form>`;
    const posts = db.posts.filter(p=>p.to==='all'||!p.to||p.to===me.grade||p.to===me.id).map(p=>`<div class="notice"><b>${p.author}</b>: ${p.text}</div>`).join('') || '<p>لا يوجد.</p>';
    content.innerHTML = card('المنشورات', form + posts);
    document.getElementById('postForm')?.addEventListener('submit',e=>{
      e.preventDefault(); const f=new FormData(e.target);
      db.posts.push({author:me.name,text:f.get('text'),to:f.get('to'),target:f.get('to')}); save(); drawPosts();
    });
  };

  const drawChat = ()=>{
    const room = me.role==='teacher'||me.role==='admin' ? 'طاقم مدرسي' : `صف ${me.grade}`;
    const msgs = db.chats.filter(c=>c.room===room).map(m=>`<div class="msg"><b>${m.author}</b>: ${m.text}</div>`).join('');
    content.innerHTML = card(`الدردشة - ${room}`, `<div class="chat-box">${msgs||''}</div><form id="chatForm" class="stack"><input name="text" required placeholder="اكتب رسالة" /><button class="primary">إرسال</button></form>`);
    document.getElementById('chatForm').onsubmit = e=>{e.preventDefault(); const f=new FormData(e.target); db.chats.push({room,author:me.name,text:f.get('text')}); save(); drawChat();};
  }

  const drawGrades = ()=>{
    if (me.role==='student') {
      const rows = db.grades.filter(g=>g.studentId===me.id).map(g=>`<tr><td>${g.semester}</td><td>${g.subject}</td><td>${g.total}</td></tr>`).join('');
      content.innerHTML = card('سجل العلامات (فصل أول/ثاني)', `<table><tr><th>الفصل</th><th>المادة</th><th>النتيجة</th></tr>${rows||''}</table>`);
    } else if (me.role==='teacher') {
      const candidates = db.users.filter(u=>u.role==='student' && me.gradeList.includes(u.grade));
      content.innerHTML = card('إدخال العلامات', `<form id="gradeForm" class="grid">
        <label>الطالب<select name="studentId">${candidates.map(s=>`<option value="${s.id}">${s.name} (${s.grade})</option>`).join('')}</select></label>
        <label>الفصل<select name="semester"><option>الفصل الأول</option><option>الفصل الثاني</option></select></label>
        <label>المادة<select name="subject">${me.subjects.map(s=>`<option>${s}</option>`).join('')}</select></label>
        <label>يومي1/10<input type="number" name="d1" max="10" min="0" required/></label>
        <label>شهرين/20<input type="number" name="m" max="20" min="0" required/></label>
        <label>يومي2/10<input type="number" name="d2" max="10" min="0" required/></label>
        <label>نهائي/40<input type="number" name="f" max="40" min="0" required/></label>
        <label>تقويم نوعي/20<input type="number" name="q" max="20" min="0" required/></label>
        <button class="primary">حفظ</button>
      </form>`);
      document.getElementById('gradeForm').onsubmit = e=>{
        e.preventDefault(); const f=new FormData(e.target);
        let total = ['d1','m','d2','f','q'].reduce((a,k)=>a+Number(f.get(k)),0);
        if (f.get('subject')==='المواد الشرعية') total*=2;
        db.grades.push({teacherId:me.id,studentId:f.get('studentId'),semester:f.get('semester'),subject:f.get('subject'),total}); save(); alert('تم الحفظ');
      };
    } else {
      const rows = db.grades.slice(-20).map(g=>`<tr><td>${g.studentId}</td><td>${g.semester}</td><td>${g.subject}</td><td>${g.total}</td></tr>`).join('');
      content.innerHTML = card('متابعة العلامات للإدارة', `<table><tr><th>طالب</th><th>الفصل</th><th>مادة</th><th>نتيجة</th></tr>${rows}</table>`);
    }
  };

  const drawNotifications = ()=>{
    const list = db.notifications.filter(n=>n.to===me.id||n.to==='all').map(n=>`<div class="notice">${n.text}</div>`).join('') || '<p>لا إشعارات.</p>';
    const adminTools = me.role==='admin' ? `<form id="noteForm" class="stack"><label>إرسال إلى<select name="to"><option value="all">الجميع</option>${db.users.filter(u=>u.role==='student').map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></label><textarea name="text" required placeholder="تنبيه / غياب"></textarea><button class="primary">إرسال</button></form>` : '';
    content.innerHTML = card('الإشعارات', `<label><input type="checkbox" id="mute" ${me.muted?'checked':''}/> كتم الإشعارات</label>${adminTools}${list}`);
    document.getElementById('mute').onchange = e=>{me.muted=e.target.checked; save();};
    document.getElementById('noteForm')?.addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);db.notifications.push({to:f.get('to'),text:f.get('text')});save();drawNotifications();});
  };

  const drawSettings = ()=>{
    content.innerHTML = card('الإعدادات', `<form id="settingsForm" class="stack">
      <label>لون الواجهة<select name="theme"><option value="#157347">أخضر</option><option value="#0d6efd">أزرق</option><option value="#6f42c1">بنفسجي</option><option value="#b22222">أحمر</option></select></label>
      <label>الأيقونة<select name="icon"><option>⚑</option><option>🎓</option><option>📘</option></select></label>
      <label>كلمة مرور جديدة<input name="password" type="password" /></label>
      <button class="primary">حفظ</button>
    </form>
    <button class="mini" id="deleteAcc">حذف الحساب</button>`);
    document.getElementById('settingsForm').onsubmit = e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('password') && !pwValid(f.get('password'))) return alert('كلمة المرور غير مطابقة');me.theme=f.get('theme');me.icon=f.get('icon');if(f.get('password')) me.password=f.get('password');document.documentElement.style.setProperty('--primary',me.theme);save();alert('تم الحفظ');};
    document.getElementById('deleteAcc').onclick = ()=>{if(confirm('تأكيد حذف الحساب؟')){db.users = db.users.filter(u=>u.id!==me.id);save();session=null;saveSession();render();}};
  };

  const routes = {'الرئيسية':drawHome,'المنشورات':drawPosts,'الدردشة':drawChat,'السجل':drawGrades,'الإشعارات':drawNotifications,'الإعدادات':drawSettings};
  drawHome();
  sideMenu.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{sideMenu.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');routes[btn.dataset.v]();});
}

function render(){ if(session) renderDashboard(); else {sessionBox.innerHTML=''; renderAuth();} }
render();
