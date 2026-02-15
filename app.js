const STUDENT_SECRET = "20301";
const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_BASE_NAME = "الإدارة المدرسية";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const semesters = [
  { value: "term1", label: "الفصل الأول" },
  { value: "term2", label: "الفصل الثاني" },
];

const baseSubjects = [
  "اللغة العربية", "اللغة الانجليزية", "التربية الاسلامية", "التكنولوجيا و البرمجة",
  "المواد الشرعية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية البدنية",
];
const grade10Subjects = baseSubjects.filter((s) => s !== "العلوم").concat(["فيزياء", "كيمياء", "احياء"]);

const seedUsers = [];

const el = (id) => document.getElementById(id);
const roleTabs = document.querySelectorAll("#roleTabs .tab");
const modeTabs = document.querySelectorAll("#modeTabs .tab");

function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function asArray(v) { return Array.isArray(v) ? v : []; }
function asObject(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function validId(id) { return /^[A-Z]{2}\d{4}$/.test(id); }
function isStrongPassword(password) { return password.length >= 7 && /[A-Za-z\u0600-\u06FF]/.test(password) && /\d/.test(password); }
function subjectsForGrade(grade) { return grade === "العاشر" ? grade10Subjects : baseSubjects; }
function canAdminDelete() { return session?.role === "admin" && ["مدير", "نائب المدير"].includes(session.position); }

function gradeSchema(subject) {
  const factor = subject === "المواد الشرعية" ? 2 : 1;
  return {
    daily1: 10 * factor,
    monthExam: 20 * factor,
    daily2: 10 * factor,
    finalExam: 40 * factor,
    qualitative: 20 * factor,
    total: 100 * factor,
  };
}

function computeTotal(entry) {
  const vals = [entry.daily1, entry.monthExam, entry.daily2, entry.finalExam, entry.qualitative]
    .map((v) => (v === "" || v === null || v === undefined ? null : Number(v)));
  if (vals.every((v) => v === null)) return "";
  return vals.reduce((a, b) => a + (b ?? 0), 0);
}

const state = {
  role: "student",
  mode: "register",
  selectedMembers: [],
  selectedChatId: null,
  selectedStudentChatId: null,
  selectedStudentMembers: [],
  selectedDirectChatId: null,
  currentQuestion: null,
  data: safeParse(localStorage.getItem("aiBookData") || "{}", {}),
};

state.data.users = asArray(state.data.users).filter((u) => u && u.id && u.role) || [...seedUsers];
state.data.posts = asArray(state.data.posts).filter((p) => p && p.authorId && p.text);
state.data.chats = asArray(state.data.chats).map((c) => ({
  ...c,
  members: asArray(c.members),
  messages: asArray(c.messages),
})).filter((c) => c && c.id && c.title);
state.data.staffMessages = asArray(state.data.staffMessages);
state.data.teacherAssignmentsByGradeSubject = asObject(state.data.teacherAssignmentsByGradeSubject);
state.data.marks = asObject(state.data.marks); // key => {daily1,monthExam,daily2,finalExam,qualitative}
state.data.studentChats = asArray(state.data.studentChats).map((c) => ({
  ...c,
  members: asArray(c.members),
  messages: asArray(c.messages),
})).filter((c) => c && c.id && c.title);
state.data.directChats = asArray(state.data.directChats).map((c) => ({
  ...c,
  members: asArray(c.members),
  messages: asArray(c.messages),
})).filter((c) => c && c.id && c.title);
state.data.settings = { theme: "theme-green", iconShape: "icons-rounded", ...asObject(state.data.settings) };

let session = safeParse(localStorage.getItem("aiBookSession"), null);

function saveData() { localStorage.setItem("aiBookData", JSON.stringify(state.data)); }
function saveSession(s) { localStorage.setItem("aiBookSession", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("aiBookSession"); }

function applyTheme(theme) {
  const chosen = theme || "theme-green";
  document.body.classList.remove("theme-blue", "theme-green", "theme-purple", "theme-sunset");
  document.body.classList.add(chosen);
  state.data.settings.theme = chosen;
  saveData();
}

function applyIconShape(shape) {
  const chosen = shape || "icons-rounded";
  document.body.classList.remove("icons-rounded", "icons-square");
  document.body.classList.add(chosen);
  state.data.settings.iconShape = chosen;
  saveData();
}

function isCounselorMonitor() {
  return session?.role === "admin" && session?.position === "مرشد تربوي";
}


function resetDataForPublish() {
  const flag = "aiBookPublishResetV3";
  if (localStorage.getItem(flag)) return;

  state.data.users = [];
  state.data.posts = [];
  state.data.chats = [];
  state.data.staffMessages = [];
  state.data.teacherAssignmentsByGradeSubject = {};
  state.data.marks = {};
  state.data.studentChats = [];
  state.data.directChats = [];
  clearSession();
  session = null;
  localStorage.setItem(flag, "1");
  saveData();
}

function ensureSessionStillValid() {
  if (!session) return;
  const active = state.data.users.find((u) => u.id === session.id);
  if (!active) {
    clearSession();
    session = null;
  }
}


function setRole(role) {
  state.role = role;
  roleTabs.forEach((b) => b.classList.toggle("active", b.dataset.role === role));
  applyAuthLayout();
}

function setMode(mode) {
  state.mode = mode;
  modeTabs.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  applyAuthLayout();
}

function applyAuthLayout() {
  const reg = state.mode === "register";
  const role = state.role;
  el("identifierWrap").classList.toggle("hidden", reg);
  el("fullNameWrap").classList.toggle("hidden", !reg);
  el("idWrap").classList.toggle("hidden", !reg);
  el("studentGradeWrap").classList.toggle("hidden", !(reg && role === "student"));
  el("emailWrap").classList.toggle("hidden", !reg);
  el("studentSecretWrap").classList.toggle("hidden", !(reg && role === "student"));
  el("teacherSecretWrap").classList.toggle("hidden", !(reg && role === "teacher"));
  el("teacherAssignments").classList.toggle("hidden", !(reg && role === "teacher"));
  el("adminPositionWrap").classList.toggle("hidden", !(reg && role === "admin"));
  el("adminSecretWrap").classList.toggle("hidden", !(reg && role === "admin"));
}

function renderLoginSetup() {
  el("studentGrade").innerHTML = gradeNames.map((g) => `<option value="${g}">${g}</option>`).join("");
  const adminGradeSelect = el("adminPostGrade");
  if (adminGradeSelect) adminGradeSelect.innerHTML = `<option value="all">جميع الصفوف</option>${gradeNames.map((g) => `<option value="${g}">${g}</option>`).join("")}`;
  renderTeacherAssignmentPicker();
}

function renderTeacherAssignmentPicker() {
  el("teacherAssignments").innerHTML = `
    <label>اختر الصفوف التي تدرّسها</label>
    <div class="subject-grid">${gradeNames.map((g) => `<label><input type="checkbox" class="gradePick" value="${g}"/> ${g}</label>`).join("")}</div>
    <div id="perGradeSubjects"></div>
  `;
}

function renderPerGradeSubjects() {
  const selectedGrades = [...document.querySelectorAll(".gradePick:checked")].map((i) => i.value);
  const holder = el("perGradeSubjects");
  const existing = safeParse(holder.dataset.selection || "{}", {});

  holder.innerHTML = selectedGrades.map((g) => `
    <div class="assignment-card">
      <strong>${g}</strong>
      <p>اختر مادتين كحد أقصى:</p>
      <div class="subject-grid">
        ${subjectsForGrade(g).map((s) => `<label><input type="checkbox" class="subjectPick" data-grade="${g}" value="${s}" ${(existing[g] || []).includes(s) ? "checked" : ""}/> ${s}</label>`).join("")}
      </div>
    </div>
  `).join("");
  holder.dataset.selection = JSON.stringify(existing);
}

function collectTeacherAssignments() {
  const grades = [...document.querySelectorAll(".gradePick:checked")].map((i) => i.value);
  const out = {};
  grades.forEach((g) => {
    out[g] = [...document.querySelectorAll(`.subjectPick[data-grade="${g}"]:checked`)].map((i) => i.value);
  });
  return out;
}

function validateTeacherAssignments(assignments) {
  const grades = Object.keys(assignments);
  if (!grades.length) return "اختر صفاً واحداً على الأقل.";
  for (const g of grades) {
    const subs = assignments[g] || [];
    if (!subs.length) return `اختر مادة واحدة على الأقل لصف ${g}.`;
    if (subs.length > 2) return `لا يمكن اختيار أكثر من مادتين لصف ${g}.`;
  }
  return "";
}

function ensureTeacherAssignmentUniqueness(teacherId, assignments) {
  for (const [grade, subs] of Object.entries(assignments)) {
    for (const sub of subs) {
      const key = `${grade}|${sub}`;
      const owner = state.data.teacherAssignmentsByGradeSubject[key];
      if (owner && owner !== teacherId) return `المادة ${sub} في صف ${grade} محجوزة لمعلم آخر.`;
    }
  }
  return "";
}

function claimTeacherAssignments(teacherId, assignments) {
  Object.entries(assignments).forEach(([g, subs]) => subs.forEach((s) => {
    state.data.teacherAssignmentsByGradeSubject[`${g}|${s}`] = teacherId;
  }));
}

function releaseTeacherAssignments(teacherId) {
  Object.keys(state.data.teacherAssignmentsByGradeSubject).forEach((k) => {
    if (state.data.teacherAssignmentsByGradeSubject[k] === teacherId) delete state.data.teacherAssignmentsByGradeSubject[k];
  });
}

function findByIdentifier(identifier) {
  const idf = identifier.trim();
  return state.data.users.find((u) => u.id === idf || (u.email && u.email.toLowerCase() === idf.toLowerCase()));
}

function hydrateTeacherSelectors() {
  if (session.role !== "teacher") return;
  const grades = Object.keys(session.assignments || {});
  el("postGrade").innerHTML = grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  el("chatGrade").innerHTML = grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  el("gradebookGrade").innerHTML = grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  el("gradebookSemester").innerHTML = semesters.map((s) => `<option value="${s.value}">${s.label}</option>`).join("");
  updateTeacherSubjectSelectors();
  updateGradebookSubjectSelector();
}

function updateTeacherSubjectSelectors() {
  if (session.role !== "teacher") return;
  const pg = el("postGrade").value;
  const cg = el("chatGrade").value;
  el("postSubject").innerHTML = (session.assignments[pg] || []).map((s) => `<option value="${s}">${s}</option>`).join("");
  el("chatSubject").innerHTML = (session.assignments[cg] || []).map((s) => `<option value="${s}">${s}</option>`).join("");
}

function updateGradebookSubjectSelector() {
  if (session.role !== "teacher") return;
  const grade = el("gradebookGrade").value;
  el("gradebookSubject").innerHTML = (session.assignments[grade] || []).map((s) => `<option value="${s}">${s}</option>`).join("");
  renderTeacherGradebook();
}

function renderClasses() {
  const out = [];
  if (session.role === "teacher") {
    Object.entries(session.assignments || {}).forEach(([g, subs]) => out.push(`<li><strong>${esc(g)}</strong><p>${esc(subs.join("، "))}</p></li>`));
  } else if (session.role === "student") {
    out.push(`<li><strong>${esc(session.grade)}</strong><p>منشورات، دردشات، وسجل درجات الفصلين.</p></li>`);
  } else {
    out.push(`<li><strong>${esc(session.position)}</strong><p>إدارة ومتابعة حسابات.</p></li>`);
  }
  el("classList").innerHTML = out.join("");
}

function visiblePosts() {
  if (session.role === "admin") return state.data.posts;
  if (session.role === "teacher") {
    const myGrades = Object.keys(session.assignments || {});
    return state.data.posts.filter((p) => p.audience === "global" || p.authorId === session.id || (p.audience === "grade" && myGrades.includes(p.grade)));
  }
  return state.data.posts.filter((p) => p.audience === "global" || (p.audience === "grade" && p.grade === session.grade));
}

function renderPosts() {
  const posts = visiblePosts();
  el("postList").innerHTML = posts.length
    ? posts.map((p) => {
      const title = p.audience === "global" ? "إعلان إداري عام" : p.audience === "grade" ? `إعلان إداري لصف ${esc(p.grade)}` : `${esc(p.grade)} - ${esc(p.subject)}`;
      return `<li><strong>${title}</strong><p>${esc(p.text)}</p><small>${esc(p.authorName)}</small></li>`;
    }).join("")
    : "<li>لا توجد منشورات.</li>";
}

function publishTeacherPost() {
  const grade = el("postGrade").value;
  const subject = el("postSubject").value;
  const text = el("postText").value.trim();
  if (!text || !session.assignments[grade]?.includes(subject)) return;
  state.data.posts.unshift({ id: uid("p"), audience: "targeted", authorId: session.id, authorName: session.fullName, grade, subject, text });
  el("postText").value = "";
  saveData();
  renderPosts();
}

function publishAdminPost() {
  const grade = el("adminPostGrade").value;
  const text = el("adminPostText").value.trim();
  if (!text) return;
  const audience = grade === "all" ? "global" : "grade";
  state.data.posts.unshift({ id: uid("p"), audience, authorId: session.id, authorName: session.fullName, grade, subject: "إدارة مدرسية", text });
  el("adminPostText").value = "";
  saveData();
  renderPosts();
}

function visibleChats() {
  if (session.role === "admin") return state.data.chats;
  if (session.role === "teacher") return state.data.chats.filter((c) => c.ownerId === session.id);
  return state.data.chats.filter((c) => c.grade === session.grade && c.members.some((m) => m.id === session.id));
}

function renderChatRooms() {
  const chats = visibleChats();
  el("chatRooms").innerHTML = chats.length
    ? chats.map((c) => `<li><button class="btn openChat" data-id="${c.id}">${esc(c.title)}</button><small>${esc(c.grade)} · ${esc(c.subject)}</small></li>`).join("")
    : "<li>لا توجد غرف.</li>";

  if (!state.selectedChatId || !chats.some((c) => c.id === state.selectedChatId)) state.selectedChatId = chats[0]?.id || null;
  renderConversation();
}

function renderConversation() {
  const chat = state.data.chats.find((c) => c.id === state.selectedChatId);
  if (!chat) return el("chatConversation").classList.add("hidden");
  el("chatConversation").classList.remove("hidden");
  el("chatRoomTitle").textContent = `${chat.title} (${chat.grade} - ${chat.subject})`;
  el("chatMessages").innerHTML = (chat.messages || []).map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("") || "<div>ابدأ المحادثة...</div>";
}

function sendChatMessage() {
  const text = el("chatInput").value.trim();
  if (!text || !state.selectedChatId) return;
  const chat = state.data.chats.find((c) => c.id === state.selectedChatId);
  if (!chat) return;
  const allowed = session.role === "admin" || chat.ownerId === session.id || chat.members.some((m) => m.id === session.id);
  if (!allowed) return;
  chat.messages = chat.messages || [];
  chat.messages.push({ senderId: session.id, senderName: session.fullName, text, at: Date.now() });
  el("chatInput").value = "";
  saveData();
  renderConversation();
}

function renderStaffChat() {
  el("staffMessages").innerHTML = state.data.staffMessages.length
    ? state.data.staffMessages.map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("")
    : "<div>ابدأ دردشة الطاقم...</div>";
}

function sendStaffMessage() {
  if (!["teacher", "admin"].includes(session.role)) return;
  const text = el("staffInput").value.trim();
  if (!text) return;
  state.data.staffMessages.push({ senderId: session.id, senderName: session.fullName, text, at: Date.now() });
  el("staffInput").value = "";
  saveData();
  renderStaffChat();
}

function searchMembers() {
  const q = el("memberSearch").value.trim().toLowerCase();
  const grade = el("chatGrade").value;
  if (!q) return;
  const users = state.data.users.filter((u) => u.role === "student" && u.grade === grade && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)));
  el("searchResult").innerHTML = users.length
    ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn addMember" data-id="${u.id}">إضافة</button></li>`).join("")
    : "<li>لا نتائج</li>";
}

function renderSelectedMembers() {
  el("selectedMembers").innerHTML = state.selectedMembers.length
    ? state.selectedMembers.map((m) => `<li>${esc(m.fullName)} (${esc(m.id)}) <button class="btn removeMember" data-id="${m.id}">حذف</button></li>`).join("")
    : "<li>لا يوجد أعضاء مضافون.</li>";
}

function createChat() {
  const title = el("chatTitle").value.trim();
  const grade = el("chatGrade").value;
  const subject = el("chatSubject").value;
  if (!title || !grade || !subject || !state.selectedMembers.length) return;
  if (!session.assignments[grade]?.includes(subject)) return;

  state.data.chats.unshift({
    id: uid("c"),
    ownerId: session.id,
    title,
    grade,
    subject,
    members: [{ id: session.id, fullName: session.fullName }, ...state.selectedMembers],
    messages: [],
  });
  state.selectedMembers = [];
  el("chatTitle").value = "";
  el("searchResult").innerHTML = "";
  saveData();
  renderSelectedMembers();
  renderChatRooms();
}

function visibleStudentChats() {
  if (session.role === "student") return state.data.studentChats.filter((c) => c.members.some((m) => m.id === session.id));
  if (isCounselorMonitor()) return state.data.studentChats;
  return [];
}

function renderCounselorQuickChats(chats) {
  const showQuick = isCounselorMonitor();
  el("counselorQuickChats").classList.toggle("hidden", !showQuick);
  if (!showQuick) return;

  el("counselorChatRooms").innerHTML = chats.length
    ? chats.map((c) => `<li><button class="btn chip openStudentChat" data-id="${c.id}">${esc(c.title)}</button></li>`).join("")
    : '<li class="muted-note">لا توجد دردشات طلاب.</li>';
}

function renderStudentChatRooms() {
  const chats = visibleStudentChats();
  renderCounselorQuickChats(chats);
  el("studentChatRooms").innerHTML = chats.length
    ? chats.map((c) => `<li><button class="btn openStudentChat" data-id="${c.id}">${esc(c.title)}</button><small>تحت المتابعة</small></li>`).join("")
    : "<li>لا توجد دردشات طلاب حالياً.</li>";

  if (!state.selectedStudentChatId || !chats.some((c) => c.id === state.selectedStudentChatId)) state.selectedStudentChatId = chats[0]?.id || null;
  renderStudentConversation();
}

function renderStudentConversation() {
  const chat = state.data.studentChats.find((c) => c.id === state.selectedStudentChatId);
  if (!chat) return el("studentChatConversation").classList.add("hidden");
  el("studentChatConversation").classList.remove("hidden");
  el("studentChatRoomTitle").textContent = `${chat.title} (مراقبة المرشد)`;
  el("studentChatMessages").innerHTML = (chat.messages || []).map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("") || "<div>ابدأ دردشة الطلاب...</div>";
}

function sendStudentChatMessage() {
  const text = el("studentChatInput").value.trim();
  if (!text || !state.selectedStudentChatId) return;
  const chat = state.data.studentChats.find((c) => c.id === state.selectedStudentChatId);
  if (!chat) return;
  const allowed = isCounselorMonitor() || chat.members.some((m) => m.id === session.id);
  if (!allowed) return;
  chat.messages = chat.messages || [];
  chat.messages.push({ senderId: session.id, senderName: session.fullName, text, at: Date.now() });
  el("studentChatInput").value = "";
  saveData();
  renderStudentConversation();
}

function searchStudentMembers() {
  if (session.role !== "student") return;
  const q = el("studentMemberSearch").value.trim().toLowerCase();
  if (!q) return;
  const users = state.data.users.filter((u) => u.role === "student" && u.grade === session.grade && u.id !== session.id && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)));
  el("studentSearchResult").innerHTML = users.length
    ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn addStudentMember" data-id="${u.id}">إضافة</button></li>`).join("")
    : "<li>لا نتائج</li>";
}

function renderSelectedStudentMembers() {
  el("selectedStudentMembers").innerHTML = state.selectedStudentMembers.length
    ? state.selectedStudentMembers.map((m) => `<li>${esc(m.fullName)} (${esc(m.id)}) <button class="btn removeStudentMember" data-id="${m.id}">حذف</button></li>`).join("")
    : "<li>لا يوجد أعضاء.</li>";
}

function createStudentChat() {
  if (session.role !== "student") return;
  const title = el("studentChatTitle").value.trim();
  if (!title || !state.selectedStudentMembers.length) return;
  state.data.studentChats.unshift({
    id: uid("sc"),
    ownerId: session.id,
    title,
    members: [{ id: session.id, fullName: session.fullName }, ...state.selectedStudentMembers],
    messages: [],
    monitoredBy: "مرشد تربوي",
  });
  state.selectedStudentMembers = [];
  el("studentChatTitle").value = "";
  el("studentSearchResult").innerHTML = "";
  saveData();
  renderSelectedStudentMembers();
  renderStudentChatRooms();
}

function markKey(studentId, grade, subject, semester) {
  return `${studentId}|${grade}|${subject}|${semester}`;
}

function getMarkEntry(studentId, grade, subject, semester) {
  return state.data.marks[markKey(studentId, grade, subject, semester)] || {
    daily1: "",
    monthExam: "",
    daily2: "",
    finalExam: "",
    qualitative: "",
  };
}

function renderTeacherGradebook() {
  if (session.role !== "teacher") return;
  const grade = el("gradebookGrade").value;
  const subject = el("gradebookSubject").value;
  const semester = el("gradebookSemester").value;
  const students = state.data.users.filter((u) => u.role === "student" && u.grade === grade);
  const schema = gradeSchema(subject);

  el("teacherGradebookTable").innerHTML = students.length ? `
    <div class="grade-table-wrap">
      <table class="grade-table">
        <thead>
          <tr>
            <th>ID</th><th>الطالب</th>
            <th>يومي1 / ${schema.daily1}</th>
            <th>شهرين / ${schema.monthExam}</th>
            <th>يومي2 / ${schema.daily2}</th>
            <th>نهائي / ${schema.finalExam}</th>
            <th>تقويم / ${schema.qualitative}</th>
            <th>المحصلة / ${schema.total}</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s) => {
            const m = getMarkEntry(s.id, grade, subject, semester);
            const total = computeTotal(m);
            return `<tr>
              <td>${esc(s.id)}</td>
              <td>${esc(s.fullName)}</td>
              <td><input class="grade-input" data-field="daily1" data-student="${s.id}" type="number" min="0" max="${schema.daily1}" value="${m.daily1}"/></td>
              <td><input class="grade-input" data-field="monthExam" data-student="${s.id}" type="number" min="0" max="${schema.monthExam}" value="${m.monthExam}"/></td>
              <td><input class="grade-input" data-field="daily2" data-student="${s.id}" type="number" min="0" max="${schema.daily2}" value="${m.daily2}"/></td>
              <td><input class="grade-input" data-field="finalExam" data-student="${s.id}" type="number" min="0" max="${schema.finalExam}" value="${m.finalExam}"/></td>
              <td><input class="grade-input" data-field="qualitative" data-student="${s.id}" type="number" min="0" max="${schema.qualitative}" value="${m.qualitative}"/></td>
              <td>${total === "" ? "" : total}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  ` : "<p class='muted-note'>لا يوجد طلاب في هذا الصف حالياً.</p>";
}

function saveTeacherMarks() {
  if (session.role !== "teacher") return;
  const grade = el("gradebookGrade").value;
  const subject = el("gradebookSubject").value;
  const semester = el("gradebookSemester").value;
  const schema = gradeSchema(subject);

  const grouped = {};
  document.querySelectorAll(".grade-input").forEach((inp) => {
    const sid = inp.dataset.student;
    const field = inp.dataset.field;
    if (!grouped[sid]) grouped[sid] = { daily1: "", monthExam: "", daily2: "", finalExam: "", qualitative: "" };
    grouped[sid][field] = inp.value.trim();
  });

  for (const [sid, entry] of Object.entries(grouped)) {
    for (const field of ["daily1", "monthExam", "daily2", "finalExam", "qualitative"]) {
      const val = entry[field];
      if (val === "") continue;
      const num = Number(val);
      if (Number.isNaN(num) || num < 0 || num > schema[field]) {
        el("marksMsg").textContent = `قيمة ${field} غير صالحة. تحقق من الحدود.`;
        return;
      }
    }

    const k = markKey(sid, grade, subject, semester);
    const allBlank = Object.values(entry).every((v) => v === "");
    if (allBlank) delete state.data.marks[k];
    else state.data.marks[k] = entry;
  }

  saveData();
  el("marksMsg").textContent = "تم حفظ العلامات بنجاح.";
  renderTeacherGradebook();
}

function renderStudentGradebook() {
  if (session.role !== "student") return;
  const grade = session.grade;
  const taughtSubjects = [...new Set(Object.keys(state.data.teacherAssignmentsByGradeSubject)
    .filter((k) => k.startsWith(`${grade}|`))
    .map((k) => k.split("|")[1]))];

  const allSubjects = taughtSubjects.length ? taughtSubjects : subjectsForGrade(grade);

  const blocks = semesters.map((term) => {
    const rows = allSubjects.map((subject) => {
      const entry = getMarkEntry(session.id, grade, subject, term.value);
      const schema = gradeSchema(subject);
      const total = computeTotal(entry);
      return `<tr>
        <td>${esc(subject)}</td>
        <td>${entry.daily1}</td>
        <td>${entry.monthExam}</td>
        <td>${entry.daily2}</td>
        <td>${entry.finalExam}</td>
        <td>${entry.qualitative}</td>
        <td>${total === "" ? "" : `${total} / ${schema.total}`}</td>
      </tr>`;
    }).join("");

    return `
      <h4>${term.label}</h4>
      <div class="grade-table-wrap">
        <table class="grade-table">
          <thead>
            <tr><th>المادة</th><th>يومي1</th><th>شهرين</th><th>يومي2</th><th>نهائي</th><th>تقويم</th><th>المحصلة</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  el("studentGradebookTable").innerHTML = blocks;
}

function generateQuestionCard() {
  const templates = [
    () => { const a = Math.floor(Math.random() * 90) + 10; const b = Math.floor(Math.random() * 90) + 10; return { q: `ما ناتج ${a} + ${b} ؟`, a: `${a + b}` }; },
    () => { const a = Math.floor(Math.random() * 20) + 2; const b = Math.floor(Math.random() * 12) + 2; return { q: `ما ناتج ${a} × ${b} ؟`, a: `${a * b}` }; },
    () => { const a = Math.floor(Math.random() * 200) + 50; const b = Math.floor(Math.random() * 50) + 10; return { q: `احسب: ${a} - ${b}`, a: `${a - b}` }; },
    () => ({ q: "ما عاصمة الأردن؟", a: "عمّان" }),
    () => ({ q: "ما عاصمة فلسطين؟", a: "القدس" }),
    () => ({ q: "في أي مادة يحدث البناء الضوئي؟", a: "في الكلوروفيل داخل النبات." }),
    () => ({ q: "ما وحدة قياس القوة؟", a: "النيوتن." }),
    () => ({ q: "اذكر نوع الفعل في كلمة (كتب).", a: "فعل ماضٍ." }),
    () => ({ q: "ما مرادف كلمة (سريع)؟", a: "عاجل/خاطف بحسب السياق." }),
    () => ({ q: "ما ناتج قسمة 144 على 12؟", a: "12" }),
    () => ({ q: "ما الكوكب المعروف بالكوكب الأحمر؟", a: "المريخ" }),
    () => ({ q: "من هو مكتشف قانون الجاذبية؟", a: "إسحاق نيوتن" }),
    () => ({ q: "ما أكبر محيط في العالم؟", a: "المحيط الهادئ" }),
    () => ({ q: "ما اسم العملية التي تحول السائل إلى غاز؟", a: "التبخر" }),
    () => ({ q: "ما هو ضد كلمة (نجاح)؟", a: "فشل" }),
    () => ({ q: "اذكر أول سورة في القرآن الكريم.", a: "سورة الفاتحة" }),
    () => ({ q: "كم عدد زوايا المثلث؟", a: "3 زوايا" }),
    () => ({ q: "ما حاصل 2 أس 5؟", a: "32" }),
    () => ({ q: "من هو أبو الأنبياء؟", a: "إبراهيم عليه السلام" }),
    () => ({ q: "ما جمع كلمة (مدرسة)؟", a: "مدارس" }),
  ];
  return templates[Math.floor(Math.random() * templates.length)]();
}

function renderQuestionCard() {
  if (session?.role !== "student") return;
  if (!state.currentQuestion) state.currentQuestion = generateQuestionCard();
  el("questionText").textContent = state.currentQuestion.q;
  el("questionAnswer").textContent = "";
}

function nextQuestion() {
  state.currentQuestion = generateQuestionCard();
  renderQuestionCard();
  renderDirectChats();
}

function showAnswer() {
  if (session?.role !== "student" || !state.currentQuestion) return;
  el("questionAnswer").textContent = `الإجابة: ${state.currentQuestion.a}`;
}


function visibleDirectChats() {
  if (!session) return [];
  return state.data.directChats.filter((c) => c.members.some((m) => m.id === session.id));
}

function renderDirectChats() {
  const chats = visibleDirectChats();
  el("directChatRooms").innerHTML = chats.length
    ? chats.map((c) => `<li><button class="btn openDirectChat" data-id="${c.id}">${esc(c.title)}</button></li>`).join("")
    : "<li>لا توجد دردشات مباشرة.</li>";

  if (!state.selectedDirectChatId || !chats.some((c) => c.id === state.selectedDirectChatId)) state.selectedDirectChatId = chats[0]?.id || null;
  renderDirectConversation();
}

function renderDirectConversation() {
  const chat = state.data.directChats.find((c) => c.id === state.selectedDirectChatId);
  if (!chat) return el("directChatConversation").classList.add("hidden");
  el("directChatConversation").classList.remove("hidden");
  el("directChatTitle").textContent = chat.title;
  el("directChatMessages").innerHTML = (chat.messages || []).map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("") || "<div>ابدأ الدردشة...</div>";
}

function searchDirectUsers() {
  if (session.role !== "admin") return;
  const q = el("directChatSearch").value.trim().toLowerCase();
  if (!q) return;
  const users = state.data.users.filter((u) => u.id !== session.id && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)));
  el("directSearchResults").innerHTML = users.length
    ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn startDirectChat" data-id="${u.id}">فتح دردشة</button></li>`).join("")
    : "<li>لا نتائج</li>";
}

function startDirectChat(targetId) {
  if (session.role !== "admin") return;
  const user = state.data.users.find((u) => u.id === targetId);
  if (!user) return;

  let chat = state.data.directChats.find((c) => c.members.some((m) => m.id === session.id) && c.members.some((m) => m.id === user.id));
  if (!chat) {
    chat = {
      id: uid("d"),
      title: `${session.fullName} ↔ ${user.fullName}`,
      members: [{ id: session.id, fullName: session.fullName }, { id: user.id, fullName: user.fullName }],
      messages: [],
    };
    state.data.directChats.unshift(chat);
  }
  state.selectedDirectChatId = chat.id;
  saveData();
  renderDirectChats();
}

function sendDirectMessage() {
  const text = el("directChatInput").value.trim();
  if (!text || !state.selectedDirectChatId) return;
  const chat = state.data.directChats.find((c) => c.id === state.selectedDirectChatId);
  if (!chat || !chat.members.some((m) => m.id === session.id)) return;
  chat.messages.push({ senderId: session.id, senderName: session.fullName, text, at: Date.now() });
  el("directChatInput").value = "";
  saveData();
  renderDirectConversation();
}

function searchDeleteTargets() {
  if (!canAdminDelete()) return;
  const q = el("deleteSearch").value.trim().toLowerCase();
  const users = state.data.users.filter((u) => u.id !== session.id && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)));
  el("deleteResults").innerHTML = users.length ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn danger deleteUser" data-id="${u.id}">حذف</button></li>`).join("") : "<li>لا نتائج</li>";
}

function removeAccount(id) {
  const target = state.data.users.find((u) => u.id === id);
  if (!target) return;
  if (target.role === "teacher") releaseTeacherAssignments(target.id);

  state.data.users = state.data.users.filter((u) => u.id !== id);
  state.data.posts = state.data.posts.filter((p) => p.authorId !== id);
  state.data.staffMessages = state.data.staffMessages.filter((m) => m.senderId !== id);
  state.data.chats = state.data.chats
    .filter((c) => c.ownerId !== id)
    .map((c) => ({
      ...c,
      members: c.members.filter((m) => m.id !== id),
      messages: asArray(c.messages).filter((m) => m.senderId !== id),
    }))
    .filter((c) => c.members.length > 1);

  state.data.studentChats = state.data.studentChats
    .filter((c) => c.ownerId !== id)
    .map((c) => ({
      ...c,
      members: c.members.filter((m) => m.id !== id),
      messages: asArray(c.messages).filter((m) => m.senderId !== id),
    }))
    .filter((c) => c.members.length > 1);

  state.data.directChats = state.data.directChats
    .map((c) => ({ ...c, members: c.members.filter((m) => m.id !== id), messages: asArray(c.messages).filter((m) => m.senderId !== id) }))
    .filter((c) => c.members.length >= 2);
  Object.keys(state.data.marks).forEach((k) => { if (k.startsWith(`${id}|`)) delete state.data.marks[k]; });
  saveData();
}

function deleteMyAccount() {
  removeAccount(session.id);
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedStudentMembers = [];
  state.selectedChatId = null;
  state.selectedStudentChatId = null;
  state.selectedDirectChatId = null;
  state.currentQuestion = null;
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("authMsg").textContent = "تم حذف حسابك بنجاح.";
}

function registerUser() {
  const role = state.role;
  const fullName = el("fullName").value.trim();
  const id = el("accountId").value.trim();
  const email = el("email").value.trim().toLowerCase();
  const password = el("password").value.trim();

  if (!fullName || !id || !email || !password) return "أكمل الحقول المطلوبة.";
  if (!validId(id)) return "الـ ID يجب أن يكون حرفين كابتل + 4 أرقام (مثل ST1234).";
  if (!isStrongPassword(password)) return "كلمة المرور يجب أن تحتوي أحرفاً وأرقاماً ولا تقل عن 7 خانات.";
  if (state.data.users.some((u) => u.id === id)) return "الـ ID مكرر، غيره.";

  const duplicateProfile = state.data.users.some((u) => u.fullName === fullName || (u.email && u.email.toLowerCase() === email));
  if (duplicateProfile) {
    setMode("login");
    return "أنت مسجل دخول من قبل، انتقل إلى خانة مسجل الدخول.";
  }

  if (role === "student") {
    if (el("studentSecret").value.trim() !== STUDENT_SECRET) return "الرمز السري للطالب غير صحيح.";
    const grade = el("studentGrade").value;
    state.data.users.push({ id, fullName, role: "student", grade, email, password });
    session = { id, fullName, role: "student", grade, email };
  }

  if (role === "teacher") {
    if (el("teacherSecret").value.trim() !== TEACHER_SECRET) return "الرقم السري للمعلم غير صحيح.";
    const assignments = collectTeacherAssignments();
    const assignErr = validateTeacherAssignments(assignments);
    if (assignErr) return assignErr;
    const uniqueErr = ensureTeacherAssignmentUniqueness(id, assignments);
    if (uniqueErr) return uniqueErr;

    claimTeacherAssignments(id, assignments);
    state.data.users.push({ id, fullName, role: "teacher", email, password, assignments });
    session = { id, fullName, role: "teacher", email, assignments };
  }

  if (role === "admin") {
    const position = el("adminPosition").value;
    if (fullName !== ADMIN_BASE_NAME) return `اسم الإدارة يجب أن يكون: ${ADMIN_BASE_NAME}`;
    if (state.data.users.some((u) => u.role === "admin" && u.position === position)) return `حساب ${position} موجود بالفعل ويمكنه تسجيل الدخول فقط.`;
    if (el("adminSecret").value.trim() !== ADMIN_SECRET) return "الرقم السري للإدارة غير صحيح.";
    const adminName = `${ADMIN_BASE_NAME} (${position})`;
    state.data.users.push({ id, fullName: adminName, role: "admin", position, email, password });
    session = { id, fullName: adminName, role: "admin", position, email };
  }

  saveData();
  saveSession(session);
  return "";
}

function loginUser() {
  const identifier = el("identifier").value.trim();
  const password = el("password").value.trim();
  if (!identifier || !password) return "أدخل البريد/ID وكلمة المرور.";

  const user = findByIdentifier(identifier);
  if (!user || user.password !== password) return "بيانات الدخول غير صحيحة.";

  if (user.role === "student") session = { id: user.id, fullName: user.fullName, role: "student", grade: user.grade, email: user.email };
  if (user.role === "teacher") session = { id: user.id, fullName: user.fullName, role: "teacher", email: user.email, assignments: user.assignments || {} };
  if (user.role === "admin") session = { id: user.id, fullName: user.fullName, role: "admin", position: user.position, email: user.email };

  saveSession(session);
  return "";
}

function renderDashboard() {
  el("loginScreen").classList.add("hidden");
  el("dashboard").classList.remove("hidden");
  el("welcome").textContent = `مرحباً ${session.fullName}`;
  el("subtitle").textContent = session.role === "teacher" ? "لوحة المعلم" : session.role === "admin" ? "لوحة الإدارة" : "لوحة الطالب";

  el("teacherPostBox").classList.toggle("hidden", session.role !== "teacher");
  el("adminPostBox").classList.toggle("hidden", session.role !== "admin");
  el("teacherChatTools").classList.toggle("hidden", session.role !== "teacher");

  const staffVisible = ["teacher", "admin"].includes(session.role);
  el("staffChatPanel").classList.toggle("hidden", !staffVisible);
  el("staffChatBox").classList.toggle("hidden", !staffVisible);
  el("staffHint").classList.toggle("hidden", staffVisible);

  const showTeacherGrades = session.role === "teacher";
  const showStudentGrades = session.role === "student";
  const showAdminGrades = session.role === "admin";
  el("teacherGradesBox").classList.toggle("hidden", !showTeacherGrades);
  el("studentGradesBox").classList.toggle("hidden", !showStudentGrades);
  el("adminGradesInfo").classList.toggle("hidden", !showAdminGrades);

  const showCards = session.role === "student";
  el("studentCardsBox").classList.toggle("hidden", !showCards);

  const showStudentChatCreate = session.role === "student";
  el("studentChatCreator").classList.toggle("hidden", !showStudentChatCreate);
  const studentChatVisible = showStudentChatCreate || isCounselorMonitor();
  el("studentChatsPanel").classList.toggle("hidden", !studentChatVisible);
  el("studentChatHint").classList.toggle("hidden", studentChatVisible);

  const canDel = canAdminDelete();
  el("adminManagePanel").classList.toggle("hidden", !canDel);
  el("adminDeleteTools").classList.toggle("hidden", !canDel);
  el("adminDeleteHint").classList.toggle("hidden", canDel);

  const directVisible = ["admin", "teacher", "student"].includes(session.role);
  el("directChatPanel").classList.toggle("hidden", !directVisible);
  el("adminDirectTools").classList.toggle("hidden", session.role !== "admin");

  hydrateTeacherSelectors();
  renderClasses();
  renderPosts();
  renderChatRooms();
  renderStaffChat();
  renderTeacherGradebook();
  renderStudentGradebook();
  renderStudentChatRooms();
  renderSelectedStudentMembers();
  renderQuestionCard();
  renderDirectChats();
}

roleTabs.forEach((b) => b.addEventListener("click", () => { el("authMsg").textContent = ""; setRole(b.dataset.role); }));
modeTabs.forEach((b) => b.addEventListener("click", () => { el("authMsg").textContent = ""; setMode(b.dataset.mode); }));

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("gradePick")) renderPerGradeSubjects();

  if (e.target.classList.contains("subjectPick")) {
    const grade = e.target.dataset.grade;
    const checked = [...document.querySelectorAll(`.subjectPick[data-grade="${grade}"]:checked`)];
    if (checked.length > 2) {
      e.target.checked = false;
      el("authMsg").textContent = `حد المواد لصف ${grade} هو مادتان فقط.`;
    }
    el("perGradeSubjects").dataset.selection = JSON.stringify(collectTeacherAssignments());
  }

  if (session?.role === "teacher" && (e.target.id === "postGrade" || e.target.id === "chatGrade")) updateTeacherSubjectSelectors();
  if (session?.role === "teacher" && e.target.id === "gradebookGrade") updateGradebookSubjectSelector();
  if (session?.role === "teacher" && (e.target.id === "gradebookSubject" || e.target.id === "gradebookSemester")) renderTeacherGradebook();
});

document.addEventListener("click", (e) => {
  if (e.target.matches(".addMember")) {
    const id = e.target.dataset.id;
    const user = state.data.users.find((u) => u.id === id);
    if (user && !state.selectedMembers.some((m) => m.id === id)) {
      state.selectedMembers.push({ id: user.id, fullName: user.fullName });
      renderSelectedMembers();
    }
  }

  if (e.target.matches(".removeMember")) {
    state.selectedMembers = state.selectedMembers.filter((m) => m.id !== e.target.dataset.id);
    renderSelectedMembers();
  }

  if (e.target.matches(".openChat")) {
    state.selectedChatId = e.target.dataset.id;
    renderConversation();
  }

  if (e.target.matches(".openStudentChat")) {
    state.selectedStudentChatId = e.target.dataset.id;
    renderStudentConversation();
  }

  if (e.target.matches(".addStudentMember")) {
    const id = e.target.dataset.id;
    const user = state.data.users.find((u) => u.id === id);
    if (user && !state.selectedStudentMembers.some((m) => m.id === id)) {
      state.selectedStudentMembers.push({ id: user.id, fullName: user.fullName });
      renderSelectedStudentMembers();
    }
  }

  if (e.target.matches(".removeStudentMember")) {
    state.selectedStudentMembers = state.selectedStudentMembers.filter((m) => m.id !== e.target.dataset.id);
    renderSelectedStudentMembers();
  }

  if (e.target.matches(".theme-btn")) {
    applyTheme(e.target.dataset.theme);
  }

  if (e.target.matches(".icon-shape-btn")) {
    applyIconShape(e.target.dataset.iconShape);
  }

  if (e.target.matches(".startDirectChat")) {
    startDirectChat(e.target.dataset.id);
  }

  if (e.target.matches(".openDirectChat")) {
    state.selectedDirectChatId = e.target.dataset.id;
    renderDirectConversation();
  }

  if (e.target.matches(".deleteUser") && canAdminDelete()) {
    removeAccount(e.target.dataset.id);
    searchDeleteTargets();
    renderPosts();
    renderChatRooms();
    renderStudentChatRooms();
    renderStaffChat();
    renderTeacherGradebook();
    renderStudentGradebook();
  }
});

el("authForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  el("authMsg").textContent = "";
  const error = state.mode === "register" ? registerUser() : loginUser();
  if (error) return (el("authMsg").textContent = error);
  renderDashboard();
});

el("publishTeacherPost").addEventListener("click", publishTeacherPost);
el("publishAdminPost").addEventListener("click", publishAdminPost);
el("doSearch").addEventListener("click", searchMembers);
el("createChat").addEventListener("click", createChat);
el("sendMessage").addEventListener("click", sendChatMessage);
el("searchStudentMember").addEventListener("click", searchStudentMembers);
el("createStudentChat").addEventListener("click", createStudentChat);
el("sendStudentMessage").addEventListener("click", sendStudentChatMessage);
el("sendStaffMessage").addEventListener("click", sendStaffMessage);
el("doDirectSearch").addEventListener("click", searchDirectUsers);
el("sendDirectMessage").addEventListener("click", sendDirectMessage);
el("searchDeleteTarget").addEventListener("click", searchDeleteTargets);
el("saveMarks").addEventListener("click", saveTeacherMarks);
el("nextQuestion").addEventListener("click", nextQuestion);
el("showAnswer").addEventListener("click", showAnswer);
el("deleteMyAccount").addEventListener("click", deleteMyAccount);

el("logoutBtn").addEventListener("click", () => {
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedStudentMembers = [];
  state.selectedChatId = null;
  state.selectedStudentChatId = null;
  state.selectedDirectChatId = null;
  state.currentQuestion = null;
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("authForm").reset();
  renderTeacherAssignmentPicker();
  renderSelectedMembers();
  setRole("student");
  setMode("register");
});

resetDataForPublish();
ensureSessionStillValid();
renderLoginSetup();
renderSelectedMembers();
renderSelectedStudentMembers();
setRole("student");
setMode("register");
applyTheme(state.data.settings.theme || "theme-green");
applyIconShape(state.data.settings.iconShape || "icons-rounded");

if (session) renderDashboard();
