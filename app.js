const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_BASE_NAME = "الإدارة المدرسية";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const baseSubjects = ["اللغة العربية", "اللغة الانجليزية", "التربية الاسلامية", "التكنولوجيا و البرمجة", "المواد الشرعية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية البدنية"];
const grade10Subjects = baseSubjects.filter((s) => s !== "العلوم").concat(["فيزياء", "كيمياء", "احياء"]);

const seedUsers = [
  { id: "ST1001", fullName: "خالد أحمد يوسف علي", role: "student", grade: "السادس", email: "st1001@school.edu", password: "Abc1234" },
  { id: "ST1002", fullName: "محمد سامي فهد حسن", role: "student", grade: "السابع", email: "st1002@school.edu", password: "Abc1234" },
  { id: "ST1003", fullName: "ليان عمر حمد سليمان", role: "student", grade: "الثامن", email: "st1003@school.edu", password: "Abc1234" },
  { id: "ST1004", fullName: "سارة أنس محمود عبد الله", role: "student", grade: "التاسع", email: "st1004@school.edu", password: "Abc1234" },
];

const el = (id) => document.getElementById(id);
const roleTabs = document.querySelectorAll("#roleTabs .tab");
const modeTabs = document.querySelectorAll("#modeTabs .tab");

function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function subjectsForGrade(grade) { return grade === "العاشر" ? grade10Subjects : baseSubjects; }
function validId(id) { return /^[A-Z]{2}\d{4}$/.test(id); }
function isStrongPassword(password) { return password.length >= 7 && /[A-Za-z\u0600-\u06FF]/.test(password) && /\d/.test(password); }

const state = {
  role: "student",
  mode: "register",
  selectedMembers: [],
  selectedChatId: null,
  data: safeParse(localStorage.getItem("aiBookData") || "{}", {}),
};

state.data.users = Array.isArray(state.data.users) ? state.data.users : [...seedUsers];
state.data.posts = Array.isArray(state.data.posts) ? state.data.posts : [];
state.data.chats = Array.isArray(state.data.chats) ? state.data.chats : [];
state.data.staffMessages = Array.isArray(state.data.staffMessages) ? state.data.staffMessages : [];
state.data.teacherAssignmentsByGradeSubject = state.data.teacherAssignmentsByGradeSubject || {};
state.data.marks = state.data.marks || {}; // key: studentId|grade|subject => number

let session = safeParse(localStorage.getItem("aiBookSession"), null);

function saveData() { localStorage.setItem("aiBookData", JSON.stringify(state.data)); }
function saveSession(s) { localStorage.setItem("aiBookSession", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("aiBookSession"); }
function canAdminDelete() { return session?.role === "admin" && ["مدير", "نائب المدير"].includes(session.position); }

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
  el("teacherSecretWrap").classList.toggle("hidden", !(reg && role === "teacher"));
  el("teacherAssignments").classList.toggle("hidden", !(reg && role === "teacher"));
  el("adminPositionWrap").classList.toggle("hidden", !(reg && role === "admin"));
  el("adminSecretWrap").classList.toggle("hidden", !(reg && role === "admin"));
}

function renderLoginSetup() {
  el("studentGrade").innerHTML = gradeNames.map((g) => `<option value="${g}">${g}</option>`).join("");
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
  grades.forEach((g) => { out[g] = [...document.querySelectorAll(`.subjectPick[data-grade="${g}"]:checked`)].map((i) => i.value); });
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
  Object.entries(assignments).forEach(([g, subs]) => subs.forEach((s) => { state.data.teacherAssignmentsByGradeSubject[`${g}|${s}`] = teacherId; }));
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
    out.push(`<li><strong>${esc(session.grade)}</strong><p>موادك ومنشوراتك وسجل علاماتك.</p></li>`);
  } else {
    out.push(`<li><strong>${esc(session.position)}</strong><p>إدارة ومتابعة حسابات.</p></li>`);
  }
  el("classList").innerHTML = out.join("");
}

function visiblePosts() {
  if (session.role === "admin") return state.data.posts;
  if (session.role === "teacher") return state.data.posts.filter((p) => p.audience === "global" || p.authorId === session.id);
  return state.data.posts.filter((p) => p.audience === "global" || p.grade === session.grade);
}

function renderPosts() {
  const posts = visiblePosts();
  el("postList").innerHTML = posts.length
    ? posts.map((p) => `<li><strong>${p.audience === "global" ? "إعلان عام" : `${esc(p.grade)} - ${esc(p.subject)}`}</strong><p>${esc(p.text)}</p><small>${esc(p.authorName)}</small></li>`).join("")
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
  const text = el("adminPostText").value.trim();
  if (!text) return;
  state.data.posts.unshift({ id: uid("p"), audience: "global", authorId: session.id, authorName: session.fullName, grade: "all", subject: "all", text });
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

function renderTeacherGradebook() {
  if (session.role !== "teacher") return;
  const grade = el("gradebookGrade").value;
  const subject = el("gradebookSubject").value;
  const students = state.data.users.filter((u) => u.role === "student" && u.grade === grade);

  el("teacherGradebookTable").innerHTML = students.length ? `
    <div class="grade-table-wrap">
      <table class="grade-table">
        <thead>
          <tr><th>ID</th><th>الطالب</th><th>العلامة</th></tr>
        </thead>
        <tbody>
          ${students.map((s) => {
            const key = `${s.id}|${grade}|${subject}`;
            const mark = state.data.marks[key] ?? "";
            return `<tr><td>${esc(s.id)}</td><td>${esc(s.fullName)}</td><td><input class="grade-input" type="number" min="0" max="100" data-student="${s.id}" value="${mark}" /></td></tr>`;
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
  const inputs = [...document.querySelectorAll(".grade-input")];

  for (const input of inputs) {
    const value = input.value.trim();
    const sid = input.dataset.student;
    const key = `${sid}|${grade}|${subject}`;
    if (!value) {
      delete state.data.marks[key];
      continue;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      el("marksMsg").textContent = "العلامة يجب أن تكون بين 0 و 100.";
      return;
    }
    state.data.marks[key] = num;
  }

  saveData();
  el("marksMsg").textContent = "تم حفظ العلامات بنجاح.";
}

function renderStudentGradebook() {
  if (session.role !== "student") return;
  const rows = [];
  for (const [key, mark] of Object.entries(state.data.marks)) {
    const [sid, grade, subject] = key.split("|");
    if (sid === session.id) rows.push({ grade, subject, mark });
  }

  el("studentGradebookTable").innerHTML = rows.length ? `
    <div class="grade-table-wrap">
      <table class="grade-table">
        <thead><tr><th>الصف</th><th>المادة</th><th>العلامة</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.grade)}</td><td>${esc(r.subject)}</td><td>${esc(r.mark)}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  ` : "<p class='muted-note'>لا توجد علامات مسجلة لك حتى الآن.</p>";
}

function searchDeleteTargets() {
  if (!canAdminDelete()) return;
  const q = el("deleteSearch").value.trim().toLowerCase();
  const users = state.data.users.filter((u) => u.id !== session.id && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)));
  el("deleteResults").innerHTML = users.length
    ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn danger deleteUser" data-id="${u.id}">حذف</button></li>`).join("")
    : "<li>لا نتائج</li>";
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
    .map((c) => ({ ...c, members: c.members.filter((m) => m.id !== id) }));

  Object.keys(state.data.marks).forEach((k) => {
    if (k.startsWith(`${id}|`)) delete state.data.marks[k];
  });

  saveData();
}

function deleteMyAccount() {
  removeAccount(session.id);
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedChatId = null;
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

  const duplicateByProfile = state.data.users.some((u) => u.fullName === fullName || (u.email && u.email.toLowerCase() === email));
  if (duplicateByProfile) {
    setMode("login");
    return "أنت مسجل دخول من قبل، انتقل إلى خانة مسجل الدخول.";
  }

  if (role === "student") {
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
  el("staffChatBox").classList.toggle("hidden", !staffVisible);
  el("staffHint").classList.toggle("hidden", staffVisible);

  const showTeacherGrades = session.role === "teacher";
  const showStudentGrades = session.role === "student";
  const showAdminGrades = session.role === "admin";
  el("teacherGradesBox").classList.toggle("hidden", !showTeacherGrades);
  el("studentGradesBox").classList.toggle("hidden", !showStudentGrades);
  el("adminGradesInfo").classList.toggle("hidden", !showAdminGrades);

  const canDel = canAdminDelete();
  el("adminDeleteTools").classList.toggle("hidden", !canDel);
  el("adminDeleteHint").classList.toggle("hidden", canDel);

  hydrateTeacherSelectors();
  renderClasses();
  renderPosts();
  renderChatRooms();
  renderStaffChat();
  renderTeacherGradebook();
  renderStudentGradebook();
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
  if (session?.role === "teacher" && e.target.id === "gradebookSubject") renderTeacherGradebook();
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

  if (e.target.matches(".deleteUser") && canAdminDelete()) {
    removeAccount(e.target.dataset.id);
    searchDeleteTargets();
    renderPosts();
    renderChatRooms();
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
el("sendStaffMessage").addEventListener("click", sendStaffMessage);
el("searchDeleteTarget").addEventListener("click", searchDeleteTargets);
el("saveMarks").addEventListener("click", saveTeacherMarks);
el("deleteMyAccount").addEventListener("click", deleteMyAccount);

el("logoutBtn").addEventListener("click", () => {
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedChatId = null;
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("authForm").reset();
  renderTeacherAssignmentPicker();
  renderSelectedMembers();
  setRole("student");
  setMode("register");
});

renderLoginSetup();
renderSelectedMembers();
setRole("student");
setMode("register");

if (session) renderDashboard();
