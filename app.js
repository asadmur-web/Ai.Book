const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_BASE_NAME = "الإدارة المدرسية";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const baseSubjects = [
  "اللغة العربية", "اللغة الانجليزية", "التربية الاسلامية", "التكنولوجيا و البرمجة",
  "المواد الشرعية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية البدنية",
];
const grade10Subjects = baseSubjects.filter((s) => s !== "العلوم").concat(["فيزياء", "كيمياء", "احياء"]);

const seedStudents = [
  { id: "ST1001", fullName: "خالد أحمد يوسف علي", role: "student", grade: "السادس" },
  { id: "ST1002", fullName: "محمد سامي فهد حسن", role: "student", grade: "السابع" },
  { id: "ST1003", fullName: "ليان عمر حمد سليمان", role: "student", grade: "الثامن" },
  { id: "ST1004", fullName: "سارة أنس محمود عبد الله", role: "student", grade: "التاسع" },
  { id: "ST1005", fullName: "عبدالله كريم ناصر خالد", role: "student", grade: "العاشر" },
];

const el = (id) => document.getElementById(id);
const roleTabs = document.querySelectorAll(".tab");

function safeParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }
function subjectsForGrade(grade) { return grade === "العاشر" ? grade10Subjects : baseSubjects; }

const state = {
  role: "student",
  selectedMembers: [],
  selectedChatId: null,
  data: safeParse(localStorage.getItem("aiBookData") || "{}", {}),
};

state.data.posts = Array.isArray(state.data.posts) ? state.data.posts : [];
state.data.chats = Array.isArray(state.data.chats) ? state.data.chats : [];
state.data.users = Array.isArray(state.data.users) ? state.data.users : [...seedStudents];
state.data.teacherAssignmentsByGradeSubject = state.data.teacherAssignmentsByGradeSubject || {};

let session = safeParse(localStorage.getItem("aiBookSession"), null);

function saveData() { localStorage.setItem("aiBookData", JSON.stringify(state.data)); }
function saveSession(s) { localStorage.setItem("aiBookSession", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("aiBookSession"); }

function isStrongPassword(password) {
  return password.length >= 7 && /[A-Za-z\u0600-\u06FF]/.test(password) && /\d/.test(password);
}
function validStudentId(id) { return /^[A-Za-z]{2}\d{4}$/.test(id); }

function setRole(role) {
  state.role = role;
  roleTabs.forEach((b) => b.classList.toggle("active", b.dataset.role === role));

  el("studentIdWrap").classList.toggle("hidden", role !== "student");
  el("studentGradeWrap").classList.toggle("hidden", role !== "student");
  el("teacherEmailWrap").classList.toggle("hidden", role !== "teacher");
  el("teacherSecretWrap").classList.toggle("hidden", role !== "teacher");
  el("teacherAssignments").classList.toggle("hidden", role !== "teacher");
  el("adminNameWrap").classList.toggle("hidden", role !== "admin");
  el("adminSecretWrap").classList.toggle("hidden", role !== "admin");
}

function renderLoginSetup() {
  el("studentGrade").innerHTML = gradeNames.map((g) => `<option value="${g}">${g}</option>`).join("");
  renderTeacherAssignmentPicker();
}

function renderTeacherAssignmentPicker() {
  const wrap = el("teacherAssignments");
  wrap.innerHTML = `
    <label>اختر الصفوف التي تدرّسها</label>
    <div class="subject-grid">${gradeNames.map((g) => `<label><input type="checkbox" class="gradePick" value="${g}"/> ${g}</label>`).join("")}</div>
    <div id="perGradeSubjects"></div>
  `;
}

function renderPerGradeSubjects() {
  const selectedGrades = [...document.querySelectorAll(".gradePick:checked")].map((i) => i.value);
  const holder = el("perGradeSubjects");
  const existing = safeParse(holder.dataset.selection || "{}", {});

  holder.innerHTML = selectedGrades.map((g) => {
    const selected = existing[g] || [];
    return `
      <div class="assignment-card" data-grade="${g}">
        <strong>${g}</strong>
        <p>اختر مادتين كحد أقصى لهذا الصف:</p>
        <div class="subject-grid">
          ${subjectsForGrade(g).map((s) => `<label><input type="checkbox" class="subjectPick" data-grade="${g}" value="${s}" ${selected.includes(s) ? "checked" : ""}/> ${s}</label>`).join("")}
        </div>
      </div>
    `;
  }).join("");

  holder.dataset.selection = JSON.stringify(existing);
}

function collectTeacherAssignments() {
  const grades = [...document.querySelectorAll(".gradePick:checked")].map((i) => i.value);
  const map = {};
  grades.forEach((grade) => {
    map[grade] = [...document.querySelectorAll(`.subjectPick[data-grade="${grade}"]:checked`)].map((i) => i.value);
  });
  return map;
}

function validateTeacherAssignments(assignments) {
  const grades = Object.keys(assignments);
  if (!grades.length) return "اختر صفاً واحداً على الأقل.";
  for (const g of grades) {
    const subs = assignments[g] || [];
    if (!subs.length) return `اختر مادة واحدة على الأقل لصف ${g}.`;
    if (subs.length > 2) return `لا يمكن اختيار أكثر من مادتين لصف ${g}.`;
    const valid = subjectsForGrade(g);
    if (subs.some((s) => !valid.includes(s))) return `مواد غير صالحة في صف ${g}.`;
  }
  return "";
}

function hasDuplicateIdentity({ role, fullName, id = null, email = null, selfId = null }) {
  return state.data.users.some((u) => {
    if (selfId && u.id === selfId) return false;
    if (id && u.id === id) return true;
    if (email && u.email && u.email.toLowerCase() === email.toLowerCase()) return true;
    if (u.fullName === fullName) return true;
    return false;
  });
}

function registerOrUpdateUser(user) {
  const idx = state.data.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) state.data.users[idx] = { ...state.data.users[idx], ...user };
  else state.data.users.push(user);
}

function ensureTeacherAssignmentUniqueness(teacherId, assignments) {
  for (const [grade, subs] of Object.entries(assignments)) {
    for (const subject of subs) {
      const key = `${grade}|${subject}`;
      const owner = state.data.teacherAssignmentsByGradeSubject[key];
      if (owner && owner !== teacherId) {
        return `المادة ${subject} في صف ${grade} محجوزة لمعلم آخر.`;
      }
    }
  }
  return "";
}

function claimTeacherAssignments(teacherId, assignments) {
  Object.entries(assignments).forEach(([grade, subs]) => {
    subs.forEach((subject) => {
      state.data.teacherAssignmentsByGradeSubject[`${grade}|${subject}`] = teacherId;
    });
  });
}

function renderDashboard() {
  el("loginScreen").classList.add("hidden");
  el("dashboard").classList.remove("hidden");
  el("welcome").textContent = `مرحباً ${session.fullName}`;
  el("subtitle").textContent = session.role === "teacher"
    ? "لوحة المعلم: منشورات، دردشات، وإدارة صفوفك."
    : session.role === "admin"
      ? "لوحة الإدارة: متابعة شاملة ومنشورات عامة."
      : "لوحة الطالب: منشوراتك ودردشات صفك.";

  el("teacherPostBox").classList.toggle("hidden", session.role !== "teacher");
  el("adminPostBox").classList.toggle("hidden", session.role !== "admin");
  el("teacherChatTools").classList.toggle("hidden", session.role !== "teacher");

  el("openaiKey").value = localStorage.getItem("openai_api_key") || "";
  hydrateTeacherSelectors();
  renderClasses();
  renderPosts();
  renderChatRooms();
}

function renderClasses() {
  const out = [];
  if (session.role === "teacher") {
    Object.entries(session.assignments).forEach(([g, subs]) => {
      out.push(`<li><strong>${esc(g)}</strong><p>${esc(subs.join("، "))}</p></li>`);
    });
  } else if (session.role === "student") {
    out.push(`<li><strong>${esc(session.grade)}</strong><p>دردشات ومنشورات صفك.</p></li>`);
  } else {
    out.push(`<li><strong>${esc(session.position)}</strong><p>رؤية عامة للمنصة.</p></li>`);
  }
  el("classesList").innerHTML = out.join("");
}

function hydrateTeacherSelectors() {
  if (session.role !== "teacher") return;
  const grades = Object.keys(session.assignments);
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
  el("postList").innerHTML = posts.length ? posts.map((p) => {
    const title = p.audience === "global" ? "إعلان عام" : `${esc(p.grade)} - ${esc(p.subject)}`;
    return `<li><strong>${title}</strong><p>${esc(p.text)}</p><small>${esc(p.authorName)}</small></li>`;
  }).join("") : "<li>لا توجد منشورات.</li>";
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

  if (!state.selectedChatId || !chats.some((c) => c.id === state.selectedChatId)) {
    state.selectedChatId = chats[0]?.id || null;
  }
  renderConversation();
}

function renderConversation() {
  const chat = state.data.chats.find((c) => c.id === state.selectedChatId);
  if (!chat) {
    el("chatConversation").classList.add("hidden");
    return;
  }
  el("chatConversation").classList.remove("hidden");
  el("chatRoomTitle").textContent = `${chat.title} (${chat.grade} - ${chat.subject})`;
  el("chatMessages").innerHTML = (chat.messages || []).map((m) =>
    `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`
  ).join("") || "<div>ابدأ المحادثة...</div>";
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

function searchMembers() {
  const q = el("memberSearch").value.trim().toLowerCase();
  const grade = el("chatGrade").value;
  if (!q) return;

  const users = state.data.users.filter((u) => u.role === "student" && u.grade === grade && (u.fullName.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)));
  el("searchResult").innerHTML = users.length
    ? users.map((u) => `<li>${esc(u.fullName)} (${esc(u.id)}) <button class="btn addMember" data-id="${esc(u.id)}">إضافة</button></li>`).join("")
    : "<li>لا نتائج</li>";
}

function renderSelectedMembers() {
  el("selectedMembers").innerHTML = state.selectedMembers.length
    ? state.selectedMembers.map((m) => `<li>${esc(m.fullName)} (${esc(m.id)}) <button class="btn removeMember" data-id="${esc(m.id)}">حذف</button></li>`).join("")
    : "<li>لا يوجد أعضاء مضافون.</li>";
}

function createChat() {
  const title = el("chatTitle").value.trim();
  const grade = el("chatGrade").value;
  const subject = el("chatSubject").value;
  if (!title || !grade || !subject || !state.selectedMembers.length) return;
  if (!session.assignments[grade]?.includes(subject)) return;

  const chat = {
    id: uid("c"),
    ownerId: session.id,
    title,
    grade,
    subject,
    members: [{ id: session.id, fullName: session.fullName }, ...state.selectedMembers],
    messages: [],
  };
  state.data.chats.unshift(chat);
  state.selectedMembers = [];
  el("chatTitle").value = "";
  el("searchResult").innerHTML = "";
  saveData();
  renderSelectedMembers();
  renderChatRooms();
}

async function askChatGPT() {
  const prompt = el("aiPrompt").value.trim();
  if (!prompt) return;

  const key = el("openaiKey").value.trim();
  if (key) localStorage.setItem("openai_api_key", key);

  if (!key) {
    el("aiAnswer").textContent = "أدخل OpenAI API Key في الحقل ليعمل ChatGPT. لا نضع المفاتيح السرية داخل الكود.";
    return;
  }

  el("aiAnswer").textContent = "جاري معالجة سؤالك...";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "أنت مساعد تعليمي لمنصة مدرسية عربية." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!res.ok || !content) throw new Error(data?.error?.message || "AI request failed");
    el("aiAnswer").textContent = content;
  } catch (err) {
    el("aiAnswer").textContent = `تعذر الاتصال بـ ChatGPT: ${err.message}`;
  }
}

roleTabs.forEach((btn) => btn.addEventListener("click", () => {
  el("loginMsg").textContent = "";
  setRole(btn.dataset.role);
}));

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

  if (session?.role === "teacher" && (e.target.id === "postGrade" || e.target.id === "chatGrade")) {
    updateTeacherSubjectSelectors();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.matches(".addMember")) {
    const id = e.target.dataset.id;
    const acc = state.data.users.find((u) => u.id === id);
    if (acc && !state.selectedMembers.some((m) => m.id === id)) {
      state.selectedMembers.push({ id: acc.id, fullName: acc.fullName });
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
});

el("loginForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  el("loginMsg").textContent = "";

  const fullName = el("fullName").value.trim();
  const password = el("password").value.trim();

  if (!fullName || !password) return (el("loginMsg").textContent = "أكمل الحقول المطلوبة.");
  if (!isStrongPassword(password)) return (el("loginMsg").textContent = "كلمة المرور يجب أن تحتوي أحرفاً وأرقاماً ولا تقل عن 7 خانات.");

  if (state.role === "student") {
    const id = el("studentId").value.trim();
    const grade = el("studentGrade").value;
    if (!validStudentId(id)) return (el("loginMsg").textContent = "ID الطالب يجب أن يكون حرفين ثم 4 أرقام (مثال ST1234).");

    const existing = state.data.users.find((u) => u.id === id);
    if (existing && existing.role !== "student") return (el("loginMsg").textContent = "هذا الـ ID مستخدم لحساب آخر.");
    if (!existing && hasDuplicateIdentity({ role: "student", fullName, id })) return (el("loginMsg").textContent = "الاسم أو ID مستخدم مسبقاً.");

    const student = existing || { id, role: "student" };
    Object.assign(student, { id, fullName, role: "student", grade });
    registerOrUpdateUser(student);
    session = { id, fullName, role: "student", grade };
  }

  if (state.role === "teacher") {
    if (el("teacherSecret").value.trim() !== TEACHER_SECRET) return (el("loginMsg").textContent = "الرقم السري للمعلم غير صحيح.");

    const email = el("teacherEmail").value.trim();
    if (!email) return (el("loginMsg").textContent = "بريد المعلم مطلوب.");

    const teacherId = `TC-${email.toLowerCase()}`;
    const assignments = collectTeacherAssignments();
    const assignError = validateTeacherAssignments(assignments);
    if (assignError) return (el("loginMsg").textContent = assignError);

    const existing = state.data.users.find((u) => u.id === teacherId);
    if (!existing && hasDuplicateIdentity({ role: "teacher", fullName, email, selfId: teacherId })) {
      return (el("loginMsg").textContent = "اسم المعلم أو البريد مستخدم مسبقاً.");
    }

    const uniqueError = ensureTeacherAssignmentUniqueness(teacherId, assignments);
    if (uniqueError) return (el("loginMsg").textContent = uniqueError);

    claimTeacherAssignments(teacherId, assignments);
    registerOrUpdateUser({ id: teacherId, fullName, role: "teacher", email, assignments });
    session = { id: teacherId, fullName, role: "teacher", email, assignments };
  }

  if (state.role === "admin") {
    const position = el("adminPosition").value;
    if (fullName !== ADMIN_BASE_NAME) return (el("loginMsg").textContent = `اسم الإدارة يجب أن يكون: ${ADMIN_BASE_NAME}`);
    if (el("adminSecret").value.trim() !== ADMIN_SECRET) return (el("loginMsg").textContent = "الرقم السري للإدارة غير صحيح.");

    const adminId = `ADMIN-${position}`;
    registerOrUpdateUser({ id: adminId, fullName: `${ADMIN_BASE_NAME} (${position})`, role: "admin", position });
    session = { id: adminId, fullName: `${ADMIN_BASE_NAME} (${position})`, role: "admin", position };
  }

  saveData();
  saveSession(session);
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
});

el("publishTeacherPost").addEventListener("click", publishTeacherPost);
el("publishAdminPost").addEventListener("click", publishAdminPost);
el("doSearch").addEventListener("click", searchMembers);
el("createChat").addEventListener("click", createChat);
el("sendMessage").addEventListener("click", sendChatMessage);
el("askAi").addEventListener("click", askChatGPT);

renderLoginSetup();
renderSelectedMembers();
setRole("student");

if (session) renderDashboard();
