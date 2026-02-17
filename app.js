const app = document.getElementById('app');
const sessionBox = document.getElementById('sessionBox');
const brandIcon = document.getElementById('brandIcon');

const DB_KEY = 'smart-school-db-v2';
const SESSION_KEY = 'smart-school-session';

const grades = ['السادس','السابع','الثامن','التاسع','العاشر'];
const subjects69 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','العلوم','الدراسات الاجتماعية','التربية البدنية'];
const subjects10 = ['اللغة العربية','اللغة الانجليزية','التربية الاسلامية','التكنولوجيا و البرمجة','المواد الشرعية','الرياضيات','فيزياء','كيمياء','احياء','الدراسات الاجتماعية','التربية البدنية'];
const adminJobs = ['مدير','نائب مدير','سكرتير','مرشد تربوي'];

const secretDigests = { student: 'MzAyMDE=', teacher: 'OTUxOTUx', admin: 'MjUxMjAxMQ==' };

const questions = [
  { q: 'ما عاصمة فلسطين؟', a: 'القدس' },
  { q: 'كم عدد أيام الأسبوع؟', a: '7 أيام' },
  { q: 'ما ناتج 9 × 9؟', a: '81' },
  { q: 'ما الكوكب الأحمر؟', a: 'المريخ' },
  { q: 'من كتب مقدمة ابن خلدون؟', a: 'ابن خلدون' }
];

const db = JSON.parse(localStorage.getItem(DB_KEY) || '{"users":[],"posts":[],"chatRooms":[],"chatMessages":[],"notifications":[],"grades":[]}');
let session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

const save = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
const saveSession = () => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
const genId = role => `${role[0].toUpperCase()}${Math.floor(100000 + Math.random() * 900000)}`;
const pwValid = p => /^(?=(?:.*\d){7,})(?=(?:.*[A-Za-z]){2,}).{9,}$/.test(p || '');
const subjectsByGrade = grade => grade === 'العاشر' ? subjects10 : subjects69;
const getUser = id => db.users.find(u => u.id === id);

function ensureDefaultRooms() {
  if (!db.chatRooms.some(r => r.id === 'staff-room')) {
    db.chatRooms.push({ id: 'staff-room', name: 'دردشة الطاقم المدرسي', type: 'staff', creatorId: 'system', memberIds: [] });
  }
}
ensureDefaultRooms();
save();

function renderAuth() {
  app.innerHTML = document.getElementById('authTemplate').innerHTML;
  sessionBox.innerHTML = '';

  const tabs = [...document.querySelectorAll('.role-tabs button')];
  const registerForm = document.getElementById('registerForm');
  let role = 'student';

  const optionsFrom = arr => arr.map(v => `<option>${v}</option>`).join('');
  const checkGroup = (name, arr) => `<div class="subject-grid">${arr.map(v => `<label class="checkbox"><input type="checkbox" name="${name}" value="${v}"/> ${v}</label>`).join('')}</div>`;

  function drawRegister() {
    const adminLocked = 'الإدارة المدرسية';
    registerForm.innerHTML = `
      ${role === 'admin' ? `<label>اسم الحساب<input name="name" value="${adminLocked}" readonly /></label>` : `<label>الاسم الرباعي<input name="name" required /></label>`}
      <label>البريد الإلكتروني<input name="email" type="email" required /></label>
      <label>كلمة المرور<input name="password" type="password" required /></label>
      <label>الرقم السري<input name="secret" type="password" required /></label>
      ${role === 'student' ? `<label>الصف<select name="grade" required>${optionsFrom(grades)}</select></label>` : ''}
      ${role === 'teacher' ? `
        <label>المواد (مادتان كحد أقصى)</label>
        ${checkGroup('subjects', [...new Set([...subjects69, ...subjects10])])}
        <label>الصفوف التي تدرسها (غير محدود)</label>
        ${checkGroup('gradeList', grades)}
      ` : ''}
      ${role === 'admin' ? `<label>الوظيفة<select name="job">${optionsFrom(adminJobs)}</select></label>` : ''}
      <button class="btn btn-primary">إنشاء الحساب</button>
    `;
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
    if (db.users.some(u => u.email === email)) return alert('هذا الحساب موجود. توجه إلى تسجيل الدخول.');

    const password = f.get('password');
    if (!pwValid(password)) return alert('كلمة المرور يجب أن تحتوي 7 أرقام على الأقل وحرفين على الأقل.');
    if (btoa(f.get('secret')) !== secretDigests[role]) return alert('فشل التحقق الأمني.');

    const user = {
      id: genId(role),
      role,
      name: (f.get('name') || '').trim(),
      email,
      password,
      grade: f.get('grade') || null,
      subjects: f.getAll('subjects').slice(0, 2),
      gradeList: f.getAll('gradeList'),
      job: f.get('job') || null,
      theme: '#157347',
      bg: '#eff5f1',
      icon: '🎓',
      iconShape: 'rounded',
      muted: false
    };

    if (role === 'teacher' && user.subjects.length < 1) return alert('اختر مادة واحدة على الأقل.');
    if (role === 'teacher' && user.gradeList.length < 1) return alert('اختر صفًا واحدًا على الأقل.');

    db.users.push(user);
    save();
    alert(`تم إنشاء الحساب بنجاح. ID: ${user.id}`);
  };

  document.getElementById('loginForm').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const identifier = (f.get('identifier') || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === identifier || u.id.toLowerCase() === identifier);
    if (!user || user.password !== f.get('password')) return alert('بيانات الدخول غير صحيحة.');
    session = { id: user.id };
    saveSession();
    render();
  };
}

function currentUser() {
  return session ? getUser(session.id) : null;
}

function applyTheme(me) {
  document.documentElement.style.setProperty('--primary', me.theme || '#157347');
  document.documentElement.style.setProperty('--bg', me.bg || '#eff5f1');
  brandIcon.textContent = me.icon || '🎓';
  const wrap = document.querySelector('.logo-wrap');
  if (wrap) wrap.style.borderRadius = me.iconShape === 'circle' ? '50%' : me.iconShape === 'square' ? '6px' : '14px';
}

function card(title, body) { return `<article class="card"><h3>${title}</h3>${body}</article>`; }

function gradeCell(me, semester, subject) {
  const row = db.grades.find(g => g.studentId === me.id && g.semester === semester && g.subject === subject);
  return row ? row.total : '';
}

function renderDashboard() {
  const me = currentUser();
  if (!me) return renderAuth();
  applyTheme(me);

  app.innerHTML = document.getElementById('dashboardTemplate').innerHTML;
  const sideMenu = document.getElementById('sideMenu');
  const content = document.getElementById('content');

  sessionBox.innerHTML = `<span class="badge">${me.role} - ${me.name}${me.job ? ` (${me.job})` : ''}</span> <button class="btn" id="logoutBtn">تسجيل خروج</button>`;
  document.getElementById('logoutBtn').onclick = () => { session = null; saveSession(); render(); };

  const menu = ['الرئيسية','المنشورات','الدردشة','السجل','الإشعارات','الإعدادات'];
  sideMenu.innerHTML = menu.map((m, i) => `<button class="menu-btn ${i === 0 ? 'active' : ''}" data-key="${m}">${m}</button>`).join('');

  function drawHome() {
    const latestPosts = db.posts.filter(p => p.to === 'all' || p.to === me.grade || p.to === me.id).slice(-5).reverse();
    const postsHtml = latestPosts.map(p => `<div class="notice"><b>${p.author}</b><div>${p.text}</div><div class="small">${p.to === 'all' ? 'عام' : p.to}</div></div>`).join('') || '<p>لا توجد منشورات.</p>';

    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    const studentQuestions = me.role === 'student' ? card('بطاقات أسئلة متغيرة', `
      <div class="question">
        <p><b>سؤال:</b> ${randomQ.q}</p>
        <button class="btn" id="showAnswer">إظهار الإجابة</button>
        <p id="answer" class="small" style="display:none"><b>الإجابة:</b> ${randomQ.a}</p>
      </div>
    `) : '';

    const roleText = me.role === 'teacher'
      ? `<p>المواد: ${me.subjects.join('، ')}</p><p>الصفوف: ${me.gradeList.join('، ')}</p>`
      : me.role === 'admin' ? `<p>الدور الإداري: ${me.job}</p>` : `<p>الصف: ${me.grade}</p>`;

    content.innerHTML = `<section class="grid">
      ${card('الملف الشخصي', `<p><b>الاسم:</b> ${me.name}</p><p><b>ID:</b> ${me.id}</p><p><b>البريد:</b> ${me.email}</p>${roleText}`)}
      ${card('آخر المنشورات', postsHtml)}
      ${studentQuestions}
    </section>`;

    document.getElementById('showAnswer')?.addEventListener('click', () => {
      document.getElementById('answer').style.display = 'block';
    });
  }

  function drawPosts() {
    const targets = me.role === 'teacher' ? me.gradeList : me.role === 'admin' ? ['all', ...grades] : [];
    const form = me.role === 'student' ? '' : `
      <form id="postForm" class="stack">
        <textarea name="text" required placeholder="اكتب منشورك..."></textarea>
        <label>الاستهداف<select name="to">${targets.map(t => `<option value="${t}">${t === 'all' ? 'جميع الصفوف' : t}</option>`).join('')}</select></label>
        <button class="btn btn-primary">نشر</button>
      </form>
    `;
    const list = db.posts.filter(p => p.to === 'all' || p.to === me.grade || p.to === me.id)
      .slice().reverse().map(p => `<div class="notice"><b>${p.author}</b>: ${p.text}</div>`).join('') || '<p>لا يوجد منشورات.</p>';

    content.innerHTML = card('المنشورات', form + list);
    document.getElementById('postForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      db.posts.push({ author: me.name, text: f.get('text'), to: f.get('to') });
      save(); drawPosts();
    });
  }

  function canAccessRoom(room, meUser) {
    if (room.type === 'staff') return meUser.role !== 'student';
    return room.memberIds.includes(meUser.id);
  }

  function drawChat() {
    const meGradeMates = db.users.filter(u => u.role === 'student' && u.grade === me.grade && u.id !== me.id);
    const visibleRooms = db.chatRooms.filter(r => canAccessRoom(r, me));

    const createStudentRoom = me.role === 'student' ? `
      <form id="createRoomForm" class="stack">
        <label>اسم الدردشة<input name="roomName" required /></label>
        <label>إضافة طلاب من صفك</label>
        <div class="subject-grid">${meGradeMates.map(s => `<label class="checkbox"><input type="checkbox" name="member" value="${s.id}"/> ${s.name}</label>`).join('') || '<p class="small">لا يوجد طلاب إضافيون حالياً.</p>'}</div>
        <button class="btn">إنشاء دردشة</button>
      </form>
    ` : '';

    content.innerHTML = card('الدردشة', `
      ${createStudentRoom}
      <label>اختر غرفة<select id="roomSelect">${visibleRooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      <div class="chat-box" id="chatBox"></div>
      <form id="chatForm" class="inline">
        <input name="text" required placeholder="اكتب رسالة" style="flex:1"/>
        <button class="btn btn-primary">إرسال</button>
      </form>
    `);

    document.getElementById('createRoomForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const id = 'room-' + Date.now();
      const memberIds = [me.id, ...f.getAll('member')];
      db.chatRooms.push({ id, name: f.get('roomName'), type: 'class', creatorId: me.id, memberIds });
      save(); drawChat();
    });

    const roomSelect = document.getElementById('roomSelect');
    const chatBox = document.getElementById('chatBox');
    const refreshMessages = () => {
      const roomId = roomSelect.value;
      chatBox.innerHTML = db.chatMessages.filter(m => m.roomId === roomId)
        .map(m => `<div class="msg"><b>${m.author}</b>: ${m.text}</div>`).join('') || '<p class="small">لا توجد رسائل.</p>';
      chatBox.scrollTop = chatBox.scrollHeight;
    };
    roomSelect.onchange = refreshMessages;
    refreshMessages();

    document.getElementById('chatForm').onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      db.chatMessages.push({ roomId: roomSelect.value, author: me.name, text: f.get('text') });
      save(); e.target.reset(); refreshMessages();
    };
  }

  function drawGrades() {
    if (me.role === 'student') {
      const subjects = subjectsByGrade(me.grade);
      const rowBuilder = sub => `<tr><td>${sub}</td><td>${gradeCell(me, 'الفصل الأول', sub)}</td><td>${gradeCell(me, 'الفصل الثاني', sub)}</td></tr>`;
      content.innerHTML = card('سجل العلامات', `<div class="table-wrap"><table><tr><th>المادة</th><th>الفصل الأول</th><th>الفصل الثاني</th></tr>${subjects.map(rowBuilder).join('')}</table></div>`);
      return;
    }

    if (me.role === 'teacher') {
      const students = db.users.filter(u => u.role === 'student' && me.gradeList.includes(u.grade));
      content.innerHTML = card('إدخال العلامات', `
        <form id="gradeForm" class="grid">
          <label>الطالب<select name="studentId">${students.map(s => `<option value="${s.id}">${s.name} - ${s.grade}</option>`).join('')}</select></label>
          <label>الفصل<select name="semester"><option>الفصل الأول</option><option>الفصل الثاني</option></select></label>
          <label>المادة<select name="subject">${me.subjects.map(s => `<option>${s}</option>`).join('')}</select></label>
          <label>يومي1/10 (اختياري)<input type="number" min="0" max="10" name="d1" /></label>
          <label>شهرين/20 (اختياري)<input type="number" min="0" max="20" name="m" /></label>
          <label>يومي2/10 (اختياري)<input type="number" min="0" max="10" name="d2" /></label>
          <label>نهائي/40 (اختياري)<input type="number" min="0" max="40" name="f" /></label>
          <label>تقويم/20 (اختياري)<input type="number" min="0" max="20" name="q" /></label>
          <button class="btn btn-primary">حفظ</button>
        </form>
      `);

      document.getElementById('gradeForm').onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const safeNum = k => Number(f.get(k) || 0);
        let total = safeNum('d1') + safeNum('m') + safeNum('d2') + safeNum('f') + safeNum('q');
        if (f.get('subject') === 'المواد الشرعية') total *= 2;

        const idx = db.grades.findIndex(g => g.studentId === f.get('studentId') && g.semester === f.get('semester') && g.subject === f.get('subject'));
        const payload = { studentId: f.get('studentId'), teacherId: me.id, semester: f.get('semester'), subject: f.get('subject'), total };
        if (idx >= 0) db.grades[idx] = payload; else db.grades.push(payload);
        save(); alert('تم حفظ العلامة.');
      };
      return;
    }

    const rows = db.grades.map(g => `<tr><td>${getUser(g.studentId)?.name || g.studentId}</td><td>${g.semester}</td><td>${g.subject}</td><td>${g.total}</td></tr>`).join('');
    content.innerHTML = card('متابعة العلامات للإدارة', `<div class="table-wrap"><table><tr><th>الطالب</th><th>الفصل</th><th>المادة</th><th>النتيجة</th></tr>${rows || ''}</table></div>`);
  }

  function drawNotifications() {
    const list = db.notifications.filter(n => n.to === 'all' || n.to === me.id).slice().reverse();
    const messages = list.map(n => `<div class="notice"><b>${n.title}</b><div>${n.text}</div></div>`).join('') || '<p>لا توجد إشعارات.</p>';

    let tools = '';
    if (me.role === 'admin') {
      const students = db.users.filter(u => u.role === 'student');
      const canAbsence = me.job === 'سكرتير';
      tools = `
        <form id="notifyForm" class="stack">
          <label>نوع الرسالة<select name="kind">${canAbsence ? '<option value="absence">غياب</option>' : ''}<option value="alert">تنبيه</option><option value="post">إشعار عام</option></select></label>
          <label>إرسال إلى<select name="to"><option value="all">الجميع</option>${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label>
          <label>العنوان<input name="title" required /></label>
          <label>المحتوى<textarea name="text" required></textarea></label>
          <button class="btn btn-primary">إرسال</button>
        </form>`;
    }

    content.innerHTML = card('الإشعارات', `<label class="checkbox"><input id="muteSwitch" type="checkbox" ${me.muted ? 'checked' : ''}/> كتم الإشعارات</label>${tools}${messages}`);

    document.getElementById('muteSwitch').onchange = e => { me.muted = e.target.checked; save(); };

    document.getElementById('notifyForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const kind = f.get('kind');
      if (kind === 'absence' && me.job !== 'سكرتير') return alert('رسائل الغياب مخصصة للسكرتير فقط.');
      db.notifications.push({ to: f.get('to'), title: `[${kind}] ${f.get('title')}`, text: f.get('text') });
      save(); drawNotifications();
    });
  }

  function drawSettings() {
    content.innerHTML = card('الإعدادات', `
      <form id="settingsForm" class="stack">
        <label>لون الواجهة الرئيسية<select name="theme"><option value="#157347">أخضر</option><option value="#0d6efd">أزرق</option><option value="#6f42c1">بنفسجي</option><option value="#b22222">أحمر</option></select></label>
        <label>لون الخلفية<select name="bg"><option value="#eff5f1">فاتح أخضر</option><option value="#f7f7fb">فاتح رمادي</option><option value="#fff7f2">كريمي</option><option value="#eef4ff">أزرق ناعم</option></select></label>
        <label>الأيقونة<select name="icon"><option>🎓</option><option>📘</option><option>🕌</option><option>🏫</option></select></label>
        <label>شكل الأيقونة<select name="iconShape"><option value="rounded">مستدير</option><option value="circle">دائري</option><option value="square">مربع</option></select></label>
        <label>كلمة مرور جديدة<input name="password" type="password" /></label>
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
      const newPw = f.get('password');
      if (newPw && !pwValid(newPw)) return alert('كلمة المرور الجديدة غير مطابقة للشروط.');
      me.theme = f.get('theme');
      me.bg = f.get('bg');
      me.icon = f.get('icon');
      me.iconShape = f.get('iconShape');
      if (newPw) me.password = newPw;
      save();
      applyTheme(me);
      document.querySelector('.logo-wrap').style.borderRadius = me.iconShape === 'circle' ? '50%' : me.iconShape === 'square' ? '6px' : '14px';
      alert('تم حفظ الإعدادات بنجاح.');
    };

    document.getElementById('deleteAccountBtn').onclick = () => {
      if (!confirm('تأكيد حذف الحساب؟')) return;
      db.users = db.users.filter(u => u.id !== me.id);
      db.grades = db.grades.filter(g => g.studentId !== me.id && g.teacherId !== me.id);
      save(); session = null; saveSession(); render();
    };
  }

  const routes = {
    'الرئيسية': drawHome,
    'المنشورات': drawPosts,
    'الدردشة': drawChat,
    'السجل': drawGrades,
    'الإشعارات': drawNotifications,
    'الإعدادات': drawSettings
  };

  drawHome();
  sideMenu.querySelectorAll('.menu-btn').forEach(btn => {
    btn.onclick = () => {
      sideMenu.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      routes[btn.dataset.key]();
    };
  });
}

function render() {
  const me = currentUser();
  if (me) renderDashboard(); else renderAuth();
}

render();
