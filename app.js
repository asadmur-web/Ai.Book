const app = document.getElementById('app');
const sessionBox = document.getElementById('sessionBox');
const brandIcon = document.getElementById('brandIcon');

const DB_KEY = 'smart-school-db-v4';
const SESSION_KEY = 'smart-school-session';

const grades = ['السادس','السابع','الثامن','التاسع','العاشر'];
const subjects69 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','العلوم','الدراسات الاجتماعية','التربية البدنية'];
const subjects10 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','فيزياء','كيمياء','احياء','الدراسات الاجتماعية','التربية البدنية'];
const adminJobs = ['مدير','نائب مدير','سكرتير','مرشد تربوي'];
const semesters = ['الفصل الأول', 'الفصل الثاني'];
const allSubjects = [...new Set([...subjects69, ...subjects10])];

const secretDigests = { student: 'MzAyMDE=', teacher: 'OTUxOTUx', admin: 'MjUxMjAxMQ==' };

const db = JSON.parse(localStorage.getItem(DB_KEY) || '{"users":[],"posts":[],"chatRooms":[],"chatMessages":[],"notifications":[],"grades":[]}');
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

const save = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
const saveSession = () => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
const getUser = id => db.users.find(u => u.id === id);
const genId = role => `${role[0].toUpperCase()}${Math.floor(100000 + Math.random() * 900000)}`;
const pwValid = p => /^(?=(?:.*\d){7,})(?=(?:.*[A-Za-z]){2,}).{9,}$/.test(p || '');
const subjectsByGrade = grade => grade === 'العاشر' ? subjects10 : subjects69;
const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function blankGradeEntry(studentId, semester, subject) {
  return { studentId, semester, subject, d1: null, m: null, d2: null, f: null, q: null, total: null, updatedAt: Date.now() };
}

function calcTotal(entry) {
  const n = k => Number(entry[k] ?? 0);
  let total = n('d1') + n('m') + n('d2') + n('f') + n('q');
  if (entry.subject === 'المواد الشرعية') total *= 2;
  return total;
}

function ensureStudentGradeRecords(studentId, grade) {
  const subjects = subjectsByGrade(grade);
  semesters.forEach(semester => {
    subjects.forEach(subject => {
      const exists = db.grades.some(g => g.studentId === studentId && g.semester === semester && g.subject === subject);
      if (!exists) db.grades.push(blankGradeEntry(studentId, semester, subject));
    });
  });
}

function migrateGrades() {
  db.grades = db.grades.map(g => ({
    d1: g.d1 ?? null,
    m: g.m ?? null,
    d2: g.d2 ?? null,
    f: g.f ?? null,
    q: g.q ?? null,
    total: g.total ?? null,
    updatedAt: g.updatedAt ?? Date.now(),
    ...g
  }));
}

function generateQuestionBank() {
  const stems = ['ما تعريف', 'اذكر مثالاً على', 'ما أهمية', 'كيف تفسر', 'ما الفرق بين'];
  const topics = ['الطاقة المتجددة', 'الصدق', 'البرمجة', 'المفعول به', 'المعادلات', 'الخلية', 'الوضوء', 'القراءة السريعة', 'التعاون', 'الأمن الرقمي'];
  const extras = ['في الحياة اليومية؟', 'بلغة بسيطة؟', 'داخل المدرسة؟', 'باختصار؟', 'مع مثال عملي؟'];
  const bank = [];
  for (let i = 0; i < 5000; i++) {
    const s = stems[i % stems.length];
    const t = topics[i % topics.length];
    const e = extras[i % extras.length];
    bank.push({ q: `${s} ${t} ${e}`, a: `إجابة إرشادية: شرح مبسط حول "${t}" مع مثال مناسب.` });
  }
  return bank;
}
const questionBank = generateQuestionBank();

function ensureDefaults() {
  if (!db.chatRooms.some(r => r.id === 'staff-room')) {
    db.chatRooms.push({ id: 'staff-room', name: 'طاقم المدرسة', type: 'staff', creatorId: 'system', memberIds: [] });
  }
  migrateGrades();
  db.users.filter(u => u.role === 'student' && u.grade).forEach(s => ensureStudentGradeRecords(s.id, s.grade));
}
ensureDefaults();
save();

function options(arr) { return arr.map(v => `<option>${v}</option>`).join(''); }
function checks(name, arr) {
  return `<div class="subject-grid">${arr.map(v => `<label class="checkbox"><input type="checkbox" name="${name}" value="${v}"/> ${v}</label>`).join('')}</div>`;
}

function renderAuth() {
  app.innerHTML = document.getElementById('authTemplate').innerHTML;
  sessionBox.innerHTML = '';

  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const loginPanel = loginForm.closest('article');
  const tabs = [...document.querySelectorAll('.role-tabs button')];
  let role = 'student';

  loginPanel.style.display = 'none';

  function drawRegister() {
    registerForm.innerHTML = `
      ${role === 'admin' ? '<label>اسم الحساب<input name="name" value="الإدارة المدرسية" readonly /></label>' : '<label>الاسم الرباعي<input name="name" required /></label>'}
      <label>البريد الإلكتروني<input id="emailInput" name="email" type="email" required /></label>
      <label>كلمة المرور<input name="password" type="password" required /></label>
      <label>الرقم السري<input name="secret" type="password" required /></label>
      ${role === 'student' ? `<label>الصف<select name="grade" required>${options(grades)}</select></label>` : ''}
      ${role === 'teacher' ? `
        <label>اختر المواد (حد أقصى مادتين)</label>
        ${checks('subjects', allSubjects)}
        <label>اختر الصفوف التي تدرسها</label>
        ${checks('gradeList', grades)}
      ` : ''}
      ${role === 'admin' ? `<label>الوظيفة<select name="job">${options(adminJobs)}</select></label>` : ''}
      <button class="btn btn-primary">إنشاء الحساب وتفعيل الدخول</button>
      <p id="existsHint" class="small"></p>
    `;

    document.getElementById('emailInput').addEventListener('blur', e => {
      const email = e.target.value.trim().toLowerCase();
      const exists = db.users.find(u => u.email === email);
      const hint = document.getElementById('existsHint');
      if (exists) {
        hint.textContent = 'هذا الحساب موجود بالفعل، تم تفعيل خانة تسجيل الدخول له.';
        loginPanel.style.display = 'block';
        loginForm.identifier.value = exists.email;
      } else {
        hint.textContent = '';
      }
    });
  }
  drawRegister();

  tabs.forEach(btn => btn.onclick = () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    role = btn.dataset.tab;
    drawRegister();
  });

  registerForm.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(registerForm);
    const email = (f.get('email') || '').trim().toLowerCase();
    const existing = db.users.find(u => u.email === email);
    if (existing) {
      loginPanel.style.display = 'block';
      loginForm.identifier.value = email;
      return alert('الحساب موجود بالفعل، استخدم تسجيل الدخول فقط.');
    }

    const password = f.get('password');
    if (!pwValid(password)) return alert('كلمة المرور يجب أن تحتوي على 7 أرقام على الأقل وحرفين.');
    if (btoa(f.get('secret')) !== secretDigests[role]) return alert('فشل التحقق الأمني.');

    const user = {
      id: genId(role), role,
      name: (f.get('name') || '').trim(),
      email, password,
      grade: f.get('grade') || null,
      subjects: f.getAll('subjects').slice(0, 2),
      gradeList: f.getAll('gradeList'),
      job: f.get('job') || null,
      theme: '#157347', bg: '#eff5f1', icon: '🎓', iconShape: 'rounded', muted: false
    };

    if (role === 'teacher' && user.subjects.length < 1) return alert('اختر مادة واحدة على الأقل.');
    if (role === 'teacher' && user.gradeList.length < 1) return alert('اختر صفاً واحداً على الأقل.');

    db.users.push(user);
    if (role === 'student') ensureStudentGradeRecords(user.id, user.grade);
    save();
    session = { id: user.id };
    saveSession();
    render();
  };

  loginForm.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(loginForm);
    const iden = (f.get('identifier') || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === iden || u.id.toLowerCase() === iden);
    if (!user || user.password !== f.get('password')) return alert('بيانات الدخول غير صحيحة.');
    session = { id: user.id };
    saveSession();
    render();
  };
}

function applyTheme(me) {
  document.documentElement.style.setProperty('--primary', me.theme || '#157347');
  document.documentElement.style.setProperty('--bg', me.bg || '#eff5f1');
  brandIcon.textContent = me.icon || '🎓';
  const wrap = document.querySelector('.logo-wrap');
  if (wrap) wrap.style.borderRadius = me.iconShape === 'circle' ? '50%' : me.iconShape === 'square' ? '8px' : '14px';
}

function card(title, body) { return `<article class="card"><h3>${title}</h3>${body}</article>`; }

function renderDashboard() {
  const me = getUser(session?.id);
  if (!me) {
    session = null;
    saveSession();
    return renderAuth();
  }

  applyTheme(me);
  app.innerHTML = document.getElementById('dashboardTemplate').innerHTML;
  const sideMenu = document.getElementById('sideMenu');
  const content = document.getElementById('content');

  sessionBox.innerHTML = `<span class="badge">${me.name} - ${me.id}</span> <button id="logoutBtn" class="btn">تسجيل خروج</button>`;
  document.getElementById('logoutBtn').onclick = () => { session = null; saveSession(); render(); };

  const menu = ['الرئيسية','المنشورات','الدردشة','السجل','الإشعارات','الإعدادات'];
  sideMenu.innerHTML = menu.map((m, i) => `<button class="menu-btn ${i===0?'active':''}" data-key="${m}">${m}</button>`).join('');

  function drawHome() {
    const posts = db.posts.filter(p => p.to === 'all' || p.to === me.grade || p.to === me.id).slice(-6).reverse();
    const postsHtml = posts.map(p => `<div class="notice"><b>${escapeHtml(p.author)}</b><div>${escapeHtml(p.text)}</div></div>`).join('') || '<p>لا توجد منشورات حالياً.</p>';
    const rand = questionBank[Math.floor(Math.random() * questionBank.length)];
    const studentQ = me.role === 'student' ? card('بطاقات الأسئلة', `
      <div class="question">
        <p><b>سؤال:</b> <span>${rand.q}</span></p>
        <div class="inline">
          <button id="showA" class="btn">إظهار الإجابة</button>
          <button id="nextQ" class="btn">السؤال التالي</button>
        </div>
        <p id="aTxt" class="small" style="display:none"><b>الإجابة:</b> ${rand.a}</p>
      </div>
    `) : '';

    content.innerHTML = `<section class="grid">
      ${card('الملف الشخصي', `<p><b>الاسم:</b> ${me.name}</p><p><b>ID:</b> ${me.id}</p><p><b>الدور:</b> ${me.role}${me.job?` (${me.job})`:''}</p>`) }
      ${card('آخر المنشورات', postsHtml)}
      ${studentQ}
    </section>`;

    document.getElementById('showA')?.addEventListener('click', () => document.getElementById('aTxt').style.display = 'block');
    document.getElementById('nextQ')?.addEventListener('click', () => drawHome());
  }

  function drawPosts() {
    const targets = me.role === 'teacher' ? me.gradeList : me.role === 'admin' ? ['all', ...grades] : [];
    const postForm = me.role === 'student' ? '' : `
      <form id="postForm" class="stack">
        <textarea name="text" required placeholder="اكتب منشوراً..."></textarea>
        <label>الصف المستهدف<select name="to" required><option value="" disabled selected>اختر الفئة المستهدفة</option>${targets.map(t => `<option value="${t}">${t==='all'?'جميع الصفوف':t}</option>`).join('')}</select></label>
        <button class="btn btn-primary">نشر</button>
      </form>
    `;
    const list = db.posts.filter(p => p.to === 'all' || p.to === me.grade || p.to === me.id)
      .slice().reverse().map(p => `<div class="notice"><b>${escapeHtml(p.author)}</b>: ${escapeHtml(p.text)}</div>`).join('') || '<p>لا يوجد منشورات.</p>';

    content.innerHTML = card('المنشورات', postForm + list);
    document.getElementById('postForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const text = (f.get('text') || '').toString().trim();
      const target = (f.get('to') || '').toString().trim();
      if (!target) return alert('يرجى اختيار الفئة المستهدفة قبل النشر.');
      if (!text) return alert('يرجى كتابة محتوى المنشور.');
      db.posts.push({ author: me.name, text, to: target });
      save();
      drawPosts();
    });
  }

  function canAccessRoom(room) {
    if (room.type === 'staff') return me.role !== 'student';
    return room.memberIds.includes(me.id);
  }

  function drawChat() {
    const visibleRooms = db.chatRooms.filter(canAccessRoom);
    const classmates = db.users.filter(u => u.role === 'student' && u.grade === me.grade && u.id !== me.id);
    const roomOptions = visibleRooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    content.innerHTML = card('الدردشة', `
      <section class="messenger">
        <aside class="rooms">
          ${me.role === 'student' ? `
            <form id="roomForm" class="stack">
              <label>إنشاء دردشة<input name="roomName" required /></label>
              <label>إضافة زملاء من صفك</label>
              <div class="subject-grid">${classmates.map(c => `<label class="checkbox"><input type="checkbox" name="member" value="${c.id}"/>${c.name}</label>`).join('') || '<span class="small">لا يوجد زملاء حالياً</span>'}</div>
              <button class="btn">إنشاء</button>
            </form>
          ` : ''}
          <label>الغرف</label>
          <select id="roomSelect" size="8">${roomOptions}</select>
        </aside>
        <section class="chat-main">
          <div id="chatBox" class="chat-box messenger-box"></div>
          <form id="chatForm" class="inline">
            <input name="text" placeholder="اكتب رسالة..." required style="flex:1"/>
            <button class="btn btn-primary">إرسال</button>
          </form>
        </section>
      </section>
    `);

    document.getElementById('roomForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const room = { id: 'room-' + Date.now(), name: f.get('roomName'), type: 'class', creatorId: me.id, memberIds: [me.id, ...f.getAll('member')] };
      db.chatRooms.push(room);
      save();
      drawChat();
    });

    const roomSelect = document.getElementById('roomSelect');
    const chatBox = document.getElementById('chatBox');

    function refreshChat() {
      const roomId = roomSelect.value;
      const msgs = db.chatMessages.filter(m => m.roomId === roomId);
      chatBox.innerHTML = msgs.map(m => `<div class="bubble ${m.authorId===me.id?'mine':'other'}"><div class="small">${m.author}</div>${m.text}</div>`).join('') || '<p class="small">ابدأ المحادثة الآن.</p>';
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    roomSelect.onchange = refreshChat;
    refreshChat();

    document.getElementById('chatForm').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      db.chatMessages.push({ roomId: roomSelect.value, authorId: me.id, author: me.name, text: f.get('text'), at: Date.now() });
      save();
      e.target.reset();
      refreshChat();
    };
  }

  function drawStudentSemesterTable(studentId, semester, studentGrade) {
    const subjects = subjectsByGrade(studentGrade);
    const rows = subjects.map(subject => {
      const g = db.grades.find(x => x.studentId===studentId && x.semester===semester && x.subject===subject) || blankGradeEntry(studentId, semester, subject);
      return `<tr><td>${subject}</td><td>${g.d1 ?? ''}</td><td>${g.m ?? ''}</td><td>${g.d2 ?? ''}</td><td>${g.f ?? ''}</td><td>${g.q ?? ''}</td><td>${g.total ?? ''}</td></tr>`;
    }).join('');
    return `<h4>${semester}</h4><div class="table-wrap"><table><tr><th>المادة</th><th>يومي 1 / 10</th><th>شهرين / 20</th><th>يومي 2 / 10</th><th>نهائي / 40</th><th>تقويم / 20</th><th>المجموع</th></tr>${rows}</table></div>`;
  }

  function drawGrades() {
    if (me.role === 'student') {
      ensureStudentGradeRecords(me.id, me.grade);
      save();
      content.innerHTML = card('سجل العلامات المقسّم', `${drawStudentSemesterTable(me.id, 'الفصل الأول', me.grade)}${drawStudentSemesterTable(me.id, 'الفصل الثاني', me.grade)}`);
      return;
    }

    if (me.role === 'teacher') {
      const students = db.users.filter(u => u.role === 'student' && me.gradeList.includes(u.grade));
      content.innerHTML = card('إدخال العلامات', `
        <form id="gradeForm" class="grid">
          <label>اختر الطالب<select id="studentId" name="studentId">${students.map(s=>`<option value="${s.id}">${s.name} (${s.grade})</option>`).join('')}</select></label>
          <label>الفصل<select name="semester"><option>الفصل الأول</option><option>الفصل الثاني</option></select></label>
          <label>المادة<select id="subjectSel" name="subject">${me.subjects.map(s=>`<option>${s}</option>`).join('')}</select></label>
          <label>يومي1/10<input type="number" min="0" max="10" name="d1" /></label>
          <label>شهرين/20<input type="number" min="0" max="20" name="m" /></label>
          <label>يومي2/10<input type="number" min="0" max="10" name="d2" /></label>
          <label>نهائي/40<input type="number" min="0" max="40" name="f" /></label>
          <label>تقويم/20<input type="number" min="0" max="20" name="q" /></label>
          <button class="btn btn-primary">حفظ</button>
        </form>
      `);

      const gradeForm = document.getElementById('gradeForm');
      gradeForm.onsubmit = e => {
        e.preventDefault();
        const f = new FormData(gradeForm);
        const studentId = f.get('studentId');
        const semester = f.get('semester');
        const subject = f.get('subject');
        const student = getUser(studentId);
        ensureStudentGradeRecords(studentId, student.grade);

        const idx = db.grades.findIndex(g => g.studentId===studentId && g.semester===semester && g.subject===subject);
        const current = idx >= 0 ? db.grades[idx] : blankGradeEntry(studentId, semester, subject);

        const val = key => {
          const raw = f.get(key);
          return raw === '' ? current[key] : Number(raw);
        };

        const updated = { ...current, d1: val('d1'), m: val('m'), d2: val('d2'), f: val('f'), q: val('q') };
        updated.total = calcTotal(updated);
        updated.updatedAt = Date.now();

        if (idx >= 0) db.grades[idx] = updated;
        else db.grades.push(updated);

        save();
        alert('تم حفظ العلامة وتحديث السجل تلقائياً.');
      };
      return;
    }

    const rows = db.grades.map(g => `<tr><td>${getUser(g.studentId)?.name || g.studentId}</td><td>${g.semester}</td><td>${g.subject}</td><td>${g.d1 ?? ''}</td><td>${g.m ?? ''}</td><td>${g.d2 ?? ''}</td><td>${g.f ?? ''}</td><td>${g.q ?? ''}</td><td>${g.total ?? ''}</td></tr>`).join('');
    content.innerHTML = card('متابعة العلامات للإدارة', `<div class="table-wrap"><table><tr><th>الطالب</th><th>الفصل</th><th>المادة</th><th>يومي1</th><th>شهرين</th><th>يومي2</th><th>نهائي</th><th>تقويم</th><th>المجموع</th></tr>${rows}</table></div>`);
  }

  function drawNotifications() {
    const list = db.notifications.filter(n => n.to === 'all' || n.to === me.id).slice().reverse();
    const items = list.map(n => `<div class="notice"><b>${n.title}</b><div>${n.text}</div></div>`).join('') || '<p>لا توجد إشعارات.</p>';

    let tools = '';
    if (me.role === 'admin') {
      const students = db.users.filter(u => u.role === 'student');
      const studentOptions = students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      tools = `
        <div class="tabs-mini">
          ${me.job === 'سكرتير' ? '<button class="chip active" data-note="absence">إرسال غياب</button>' : ''}
          <button class="chip ${me.job !== 'سكرتير' ? 'active' : ''}" data-note="alert">تنبيه</button>
          <button class="chip" data-note="general">إشعار عام</button>
        </div>
        <form id="notifyForm" class="stack"></form>
      `;

      content.innerHTML = card('الإشعارات', `<label class="checkbox"><input id="muteSwitch" type="checkbox" ${me.muted?'checked':''}/> كتم الإشعارات</label>${tools}${items}`);

      const form = document.getElementById('notifyForm');
      const chips = [...document.querySelectorAll('.chip')];
      const defaultMode = me.job === 'سكرتير' ? 'absence' : 'alert';

      function drawNotify(mode) {
        if (mode === 'absence') {
          form.innerHTML = `<label>الطالب<select name="to">${studentOptions}</select></label><label>تاريخ الغياب<input type="date" name="date" required /></label><button class="btn btn-primary">إرسال إشعار الغياب</button>`;
        } else if (mode === 'alert') {
          form.innerHTML = `<label>الطالب<select name="to">${studentOptions}</select></label><label>سبب التنبيه<textarea name="text" required></textarea></label><button class="btn btn-primary">إرسال التنبيه</button>`;
        } else {
          form.innerHTML = `<label>الإرسال إلى<select name="to"><option value="all">الجميع</option>${grades.map(g=>`<option value="${g}">${g}</option>`).join('')}</select></label><label>المحتوى<textarea name="text" required></textarea></label><button class="btn btn-primary">إرسال</button>`;
        }

        form.onsubmit = e => {
          e.preventDefault();
          const f = new FormData(form);
          if (mode === 'absence' && me.job !== 'سكرتير') return alert('إرسال الغياب مخصص للسكرتير.');
          const payload = mode === 'absence'
            ? { to: f.get('to'), title: 'إشعار غياب', text: `تم تسجيل غياب بتاريخ ${f.get('date')}.` }
            : mode === 'alert'
              ? { to: f.get('to'), title: 'تنبيه مدرسي', text: f.get('text') }
              : { to: f.get('to'), title: 'إشعار إداري', text: f.get('text') };
          db.notifications.push(payload);
          save();
          drawNotifications();
        };
      }

      chips.forEach(c => c.onclick = () => {
        chips.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        drawNotify(c.dataset.note);
      });
      drawNotify(defaultMode);
      document.getElementById('muteSwitch').onchange = e => { me.muted = e.target.checked; save(); };
      return;
    }

    content.innerHTML = card('الإشعارات', `<label class="checkbox"><input id="muteSwitch" type="checkbox" ${me.muted?'checked':''}/> كتم الإشعارات</label>${items}`);
    document.getElementById('muteSwitch').onchange = e => { me.muted = e.target.checked; save(); };
  }

  function drawSettings() {
    content.innerHTML = card('الإعدادات', `
      <p><b>الاسم:</b> ${me.name} | <b>ID:</b> ${me.id}</p>
      <form id="settingsForm" class="stack">
        <label>اللون الأساسي<select name="theme"><option value="#157347">أخضر</option><option value="#0d6efd">أزرق</option><option value="#6f42c1">بنفسجي</option><option value="#b22222">أحمر</option><option value="#ff6f00">برتقالي</option></select></label>
        <label>لون الخلفية<select name="bg"><option value="#eff5f1">فاتح أخضر</option><option value="#f7f7fb">رمادي فاتح</option><option value="#fff7f2">كريمي</option><option value="#eef4ff">أزرق ناعم</option><option value="#f7eefb">بنفسجي ناعم</option></select></label>
        <label>الأيقونة<select name="icon"><option>🎓</option><option>📘</option><option>🕌</option><option>🏫</option><option>📚</option></select></label>
        <label>شكل الأيقونة<select name="iconShape"><option value="rounded">مستدير</option><option value="circle">دائري</option><option value="square">مربع</option></select></label>
        <hr/>
        <label>كلمة المرور الحالية<input type="password" name="currentPassword" /></label>
        <label>كلمة المرور الجديدة<input type="password" name="newPassword" /></label>
        <button class="btn btn-primary">حفظ الإعدادات</button>
      </form>
      <button class="btn" id="deleteAccountBtn">حذف الحساب</button>
    `);

    const form = document.getElementById('settingsForm');
    form.theme.value = me.theme;
    form.bg.value = me.bg;
    form.icon.value = me.icon;
    form.iconShape.value = me.iconShape;

    form.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(form);
      const cur = f.get('currentPassword');
      const nw = f.get('newPassword');
      if ((cur || nw) && cur !== me.password) return alert('كلمة المرور الحالية غير صحيحة.');
      if (nw && !pwValid(nw)) return alert('كلمة المرور الجديدة لا تحقق الشروط.');

      me.theme = f.get('theme');
      me.bg = f.get('bg');
      me.icon = f.get('icon');
      me.iconShape = f.get('iconShape');
      if (nw) me.password = nw;

      save();
      applyTheme(me);
      alert('تم حفظ الإعدادات بنجاح.');
    };

    document.getElementById('deleteAccountBtn').onclick = () => {
      if (!confirm('تأكيد حذف الحساب؟')) return;
      db.users = db.users.filter(u => u.id !== me.id);
      db.grades = db.grades.filter(g => g.studentId !== me.id);
      save();
      session = null;
      saveSession();
      render();
    };
  }

  const routes = { 'الرئيسية': drawHome, 'المنشورات': drawPosts, 'الدردشة': drawChat, 'السجل': drawGrades, 'الإشعارات': drawNotifications, 'الإعدادات': drawSettings };
  drawHome();
  sideMenu.querySelectorAll('.menu-btn').forEach(btn => btn.onclick = () => {
    sideMenu.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    routes[btn.dataset.key]();
  });
}

function render() {
  if (session?.id) renderDashboard();
  else renderAuth();
}

render();
