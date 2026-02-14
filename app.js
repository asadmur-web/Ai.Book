const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_BASE_NAME = "الإدارة المدرسية";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const baseSubjects = ["اللغة العربية", "اللغة الانجليزية", "التربية الاسلامية", "التكنولوجيا و البرمجة", "المواد الشرعية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية البدنية"];
const grade10Subjects = baseSubjects.filter((s) => s !== "العلوم").concat(["فيزياء", "كيمياء", "احياء"]);

const seedUsers = [
  { id: "ST1001", fullName: "خالد أحمد يوسف علي", role: "student", grade: "السادس", email: "st1001@school.edu", password: "Abc1234" },
  { id: "ST1002", fullName: "محمد سامي فهد حسن", role: "student", grade: "السابع", email: "st1002@school.edu", password: "Abc1234" },
];

const el = (id) => document.getElementById(id);
const roleTabs = document.querySelectorAll(".tabs .tab[data-role]");
const modeTabs = document.querySelectorAll(".tabs .tab[data-mode]");

function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function subjectsForGrade(grade) { return grade === "العاشر" ? grade10Subjects : baseSubjects; }

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

let session = safeParse(localStorage.getItem("aiBookSession"), null);

function saveData() { localStorage.setItem("aiBookData", JSON.stringify(state.data)); }
function saveSession(s) { localStorage.setItem("aiBookSession", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("aiBookSession"); }

function isStrongPassword(password) { return password.length >= 7 && /[A-Za-z\u0600-\u06FF]/.test(password) && /\d/.test(password); }
function validId(id) { return /^[A-Z]{2}\d{4}$/.test(id); }
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
  const isRegister = state.mode === "register";
  const role = state.role;

  el("identifierWrap").classList.toggle("hidden", isRegister);
  el("fullNameWrap").classList.toggle("hidden", !isRegister);
  el("commonIdWrap").classList.toggle("hidden", !isRegister);
  el("studentGradeWrap").classList.toggle("hidden", !(isRegister && role === "student"));
  el("emailWrap").classList.toggle("hidden", !(isRegister && (role === "teacher" || role === "admin")));
  el("teacherSecretWrap").classList.toggle("hidden", !(isRegister && role === "teacher"));
  el("teacherAssignments").classList.toggle("hidden", !(isRegister && role === "teacher"));
  el("adminNameWrap").classList.toggle("hidden", !(isRegister && role === "admin"));
  el("adminSecretWrap").classList.toggle("hidden", !(isRegister && role === "admin"));
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
  Object.keys(state.data.teacherAssignmentsByGradeSubject).forEach((key) => {
    if (state.data.teacherAssignmentsByGradeSubject[key] === teacherId) delete state.data.teacherAssignmentsByGradeSubject[key];
  });
}

function findByIdentifier(identifier) {
  const idf = identifier.trim();
  return state.data.users.find((u) => u.id === idf || (u.email && u.email.toLowerCase() === idf.toLowerCase()));
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
  el("staffChatHint").classList.toggle("hidden", staffVisible);

  const canDelete = canAdminDelete();
  el("adminDeleteTools").classList.toggle("hidden", !canDelete);
  el("adminDeleteHint").classList.toggle("hidden", canDelete);

  el("openaiKey").value = localStorage.getItem("openai_api_key") || "";
  hydrateTeacherSelectors();
  renderClasses();
  renderPosts();
  renderChatRooms();
  renderStaffChat();
}

function renderClasses() {
  const list = [];
  if (session.role === "teacher") Object.entries(session.assignments || {}).forEach(([g, subs]) => list.push(`<li><strong>${esc(g)}</strong><p>${esc(subs.join("، "))}</p></li>`));
  else if (session.role === "student") list.push(`<li><strong>${esc(session.grade)}</strong><p>دردشات ومنشورات صفك.</p></li>`);
  else list.push(`<li><strong>${esc(session.position)}</strong><p>حساب إداري.</p></li>`);
  el("classesList").innerHTML = list.join("");
}

function hydrateTeacherSelectors() {
  if (session.role !== "teacher") return;
  const grades = Object.keys(session.assignments || {});
  el("postGrade").innerHTML = grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  el("chatGrade").innerHTML = grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  updateTeacherSubjectSelectors();
}

function updateTeacherSubjectSelectors() {
  if (session.role !== "teacher") return;
  const pg = el("postGrade").value;
  const cg = el("chatGrade").value;
  el("postSubject").innerHTML = (session.assignments[pg] || []).map((s) => `<option value="${s}">${s}</option>`).join("");
  el("chatSubject").innerHTML = (session.assignments[cg] || []).map((s) => `<option value="${s}">${s}</option>`).join("");
}

function visiblePosts() {
  if (session.role === "admin") return state.data.posts;
  if (session.role === "teacher") return state.data.posts.filter((p) => p.audience === "global" || p.authorId === session.id);
  return state.data.posts.filter((p) => p.audience === "global" || p.grade === session.grade);
}

function renderPosts() {
  const posts = visiblePosts();
  el("postList").innerHTML = posts.length ? posts.map((p) => `<li><strong>${p.audience === "global" ? "إعلان عام" : `${esc(p.grade)} - ${esc(p.subject)}`}</strong><p>${esc(p.text)}</p><small>${esc(p.authorName)}</small></li>`).join("") : "<li>لا توجد منشورات.</li>";
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
  el("chatRooms").innerHTML = chats.length ? chats.map((c) => `<li><button class="btn openChat" data-id="${c.id}">${esc(c.title)}</button><small>${esc(c.grade)} · ${esc(c.subject)}</small></li>`).join("") : "<li>لا توجد غرف.</li>";
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
  el("staffMessages").innerHTML = state.data.staffMessages.map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("") || "<div>ابدأ دردشة الطاقم...</div>";
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
  el("searchResult").innerHTML = users.length ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn addMember" data-id="${u.id}">إضافة</button></li>`).join("") : "<li>لا نتائج</li>";
}

function renderSelectedMembers() {
  el("selectedMembers").innerHTML = state.selectedMembers.length ? state.selectedMembers.map((m) => `<li>${esc(m.fullName)} (${esc(m.id)}) <button class="btn removeMember" data-id="${m.id}">حذف</button></li>`).join("") : "<li>لا يوجد أعضاء مضافون.</li>";
}

function createChat() {
  const title = el("chatTitle").value.trim();
  const grade = el("chatGrade").value;
  const subject = el("chatSubject").value;
  if (!title || !grade || !subject || !state.selectedMembers.length) return;
  if (!session.assignments[grade]?.includes(subject)) return;
  state.data.chats.unshift({ id: uid("c"), ownerId: session.id, title, grade, subject, members: [{ id: session.id, fullName: session.fullName }, ...state.selectedMembers], messages: [] });
  state.selectedMembers = [];
  el("chatTitle").value = "";
  el("searchResult").innerHTML = "";
  saveData();
  renderSelectedMembers();
  renderChatRooms();
}

function searchDeleteTargets() {
  if (!canAdminDelete()) return;
  const q = el("deleteSearch").value.trim().toLowerCase();
  const users = state.data.users.filter((u) => u.id !== session.id && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)));
  el("deleteResults").innerHTML = users.length ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn danger deleteUser" data-id="${u.id}">حذف</button></li>`).join("") : "<li>لا نتائج</li>";
}

function removeAccount(targetId) {
  const target = state.data.users.find((u) => u.id === targetId);
  if (!target) return;
  if (target.role === "teacher") releaseTeacherAssignments(target.id);
  state.data.users = state.data.users.filter((u) => u.id !== targetId);
  state.data.chats = state.data.chats.filter((c) => c.ownerId !== targetId).map((c) => ({ ...c, members: c.members.filter((m) => m.id !== targetId) }));
  state.data.posts = state.data.posts.filter((p) => p.authorId !== targetId);
  state.data.staffMessages = state.data.staffMessages.filter((m) => m.senderId !== targetId);
  saveData();
}

function deleteMyAccount() {
  const myId = session.id;
  removeAccount(myId);
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedChatId = null;
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("loginMsg").textContent = "تم حذف حسابك بنجاح.";
}

async function askChatGPT() {
  const prompt = el("aiPrompt").value.trim();
  if (!prompt) return;
  const key = el("openaiKey").value.trim();
  if (key) localStorage.setItem("openai_api_key", key);
  if (!key) return (el("aiAnswer").textContent = "أدخل OpenAI API Key في الحقل ليعمل ChatGPT.");

  el("aiAnswer").textContent = "جاري معالجة سؤالك...";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: "أنت مساعد تعليمي لمنصة مدرسية عربية." }, { role: "user", content: prompt }], temperature: 0.4 }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!res.ok || !content) throw new Error(data?.error?.message || "AI request failed");
    el("aiAnswer").textContent = content;
  } catch (e) {
    el("aiAnswer").textContent = `تعذر الاتصال بـ ChatGPT: ${e.message}`;
  }
}

function registerUser() {
  const fullName = el("fullName").value.trim();
  const id = el("accountId").value.trim();
  const password = el("password").value.trim();
  const role = state.role;

  if (!fullName || !id || !password) return "أكمل الحقول المطلوبة.";
  if (!validId(id)) return "الـ ID يجب أن يكون حرفين كابتل + 4 أرقام فقط (مثال ST1234).";
  if (!isStrongPassword(password)) return "كلمة المرور يجب أن تحتوي أحرفاً وأرقاماً ولا تقل عن 7 خانات.";

  const idExists = state.data.users.some((u) => u.id === id);
  if (idExists) return "الـ ID مكرر، اختر ID آخر.";

  if (role === "student") {
    const grade = el("studentGrade").value;
    const dupName = state.data.users.some((u) => u.fullName === fullName);
    if (dupName) {
      setMode("login");
      return "أنت مسجل دخول من قبل، انتقلنا بك إلى خانة مسجل الدخول.";
    }
    const user = { id, fullName, role: "student", grade, password };
    state.data.users.push(user);
    session = { id, fullName, role: "student", grade };
  }

  if (role === "teacher") {
    const email = el("email").value.trim().toLowerCase();
    if (!email) return "بريد المعلم مطلوب.";
    if (el("teacherSecret").value.trim() !== TEACHER_SECRET) return "الرقم السري للمعلم غير صحيح.";

    const duplicate = state.data.users.some((u) => u.fullName === fullName || (u.email && u.email.toLowerCase() === email));
    if (duplicate) {
      setMode("login");
      return "أنت مسجل دخول من قبل، انتقلنا بك إلى خانة مسجل الدخول.";
    }

    const assignments = collectTeacherAssignments();
    const err = validateTeacherAssignments(assignments);
    if (err) return err;

    const uniqueErr = ensureTeacherAssignmentUniqueness(id, assignments);
    if (uniqueErr) return uniqueErr;

    claimTeacherAssignments(id, assignments);
    const user = { id, fullName, role: "teacher", email, password, assignments };
    state.data.users.push(user);
    session = { id, fullName, role: "teacher", email, assignments };
  }

  if (role === "admin") {
    const email = el("email").value.trim().toLowerCase();
    if (!email) return "بريد الإدارة مطلوب.";
    if (fullName !== ADMIN_BASE_NAME) return `اسم الإدارة يجب أن يكون: ${ADMIN_BASE_NAME}`;
    if (el("adminSecret").value.trim() !== ADMIN_SECRET) return "الرقم السري للإدارة غير صحيح.";

    const position = el("adminPosition").value;
    const fullAdminName = `${ADMIN_BASE_NAME} (${position})`;
    const duplicate = state.data.users.some((u) => u.fullName === fullAdminName || (u.email && u.email.toLowerCase() === email));
    if (duplicate) {
      setMode("login");
      return "أنت مسجل دخول من قبل، انتقلنا بك إلى خانة مسجل الدخول.";
    }

    const user = { id, fullName: fullAdminName, role: "admin", position, email, password };
    state.data.users.push(user);
    session = { id, fullName: fullAdminName, role: "admin", position, email };
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

  if (user.role === "student") session = { id: user.id, fullName: user.fullName, role: "student", grade: user.grade };
  if (user.role === "teacher") session = { id: user.id, fullName: user.fullName, role: "teacher", email: user.email, assignments: user.assignments || {} };
  if (user.role === "admin") session = { id: user.id, fullName: user.fullName, role: "admin", position: user.position, email: user.email };

  saveSession(session);
  return "";
}

roleTabs.forEach((b) => b.addEventListener("click", () => { el("loginMsg").textContent = ""; setRole(b.dataset.role); }));
modeTabs.forEach((b) => b.addEventListener("click", () => { el("loginMsg").textContent = ""; setMode(b.dataset.mode); }));

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("gradePick")) renderPerGradeSubjects();
  if (e.target.classList.contains("subjectPick")) {
    const grade = e.target.dataset.grade;
    const checked = [...document.querySelectorAll(`.subjectPick[data-grade="${grade}"]:checked`)];
    if (checked.length > 2) {
      e.target.checked = false;
      el("loginMsg").textContent = `حد المواد لصف ${grade} هو مادتان فقط.`;
    }
    el("perGradeSubjects").dataset.selection = JSON.stringify(collectTeacherAssignments());
  }
  if (session?.role === "teacher" && (e.target.id === "postGrade" || e.target.id === "chatGrade")) updateTeacherSubjectSelectors();
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
  }
});

el("loginForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  el("loginMsg").textContent = "";

  const error = state.mode === "register" ? registerUser() : loginUser();
  if (error) return (el("loginMsg").textContent = error);
  renderDashboard();
});

el("logoutBtn").addEventListener("click", () => {
  clearSession();
  session = null;
  state.selectedMembers = [];
  state.selectedChatId = null;
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("loginForm").reset();
  renderTeacherAssignmentPicker();
  renderSelectedMembers();
  setRole("student");
  setMode("register");
});

el("deleteMyAccount").addEventListener("click", deleteMyAccount);
el("publishTeacherPost").addEventListener("click", publishTeacherPost);
el("publishAdminPost").addEventListener("click", publishAdminPost);
el("doSearch").addEventListener("click", searchMembers);
el("createChat").addEventListener("click", createChat);
el("sendMessage").addEventListener("click", sendChatMessage);
el("sendStaffMessage").addEventListener("click", sendStaffMessage);
el("searchDeleteTarget").addEventListener("click", searchDeleteTargets);
el("askAi").addEventListener("click", askChatGPT);

renderLoginSetup();
renderSelectedMembers();
setRole("student");
setMode("register");

if (session) renderDashboard();
