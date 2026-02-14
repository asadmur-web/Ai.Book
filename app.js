const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_NAME = "ادارة المدرسة";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const baseSubjects = [
  "اللغة العربية", "اللغة الانجليزية", "التربية الاسلامية", "التكنولوجيا و البرمجة",
  "المواد الشرعية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "التربية البدنية",
];
const grade10Subjects = baseSubjects.filter((s) => s !== "العلوم").concat(["فيزياء", "كيمياء", "احياء"]);

const accounts = [
  { id: "ST1001", fullName: "خالد أحمد يوسف علي", role: "student", grade: "السادس" },
  { id: "ST1002", fullName: "محمد سامي فهد حسن", role: "student", grade: "السابع" },
  { id: "ST1003", fullName: "ليان عمر حمد سليمان", role: "student", grade: "الثامن" },
  { id: "ST1004", fullName: "سارة أنس محمود عبد الله", role: "student", grade: "التاسع" },
  { id: "ST1005", fullName: "عبدالله كريم ناصر خالد", role: "student", grade: "العاشر" },
];

const el = (id) => document.getElementById(id);
const roleTabs = document.querySelectorAll(".tab");

function safeParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
function esc(v) {
  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function subjectsForGrade(grade) { return grade === "العاشر" ? grade10Subjects : baseSubjects; }
function uid(prefix = "id") { return `${prefix}-${Math.random().toString(36).slice(2, 10)}`; }

const state = {
  role: "student",
  selectedMembers: [],
  selectedChatId: null,
  data: safeParse(localStorage.getItem("aiBookData") || '{"posts":[],"chats":[]}', { posts: [], chats: [] }),
};
let session = safeParse(localStorage.getItem("aiBookSession"), null);

function saveData() { localStorage.setItem("aiBookData", JSON.stringify(state.data)); }
function saveSession(s) { localStorage.setItem("aiBookSession", JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("aiBookSession"); }

function setRole(role) {
  state.role = role;
  roleTabs.forEach((b) => b.classList.toggle("active", b.dataset.role === role));
  el("studentIdWrap").classList.toggle("hidden", role !== "student");
  el("studentGradeWrap").classList.toggle("hidden", role !== "student");
  el("teacherEmailWrap").classList.toggle("hidden", role !== "teacher");
  el("teacherSecretWrap").classList.toggle("hidden", role !== "teacher");
  el("teacherAssignments").classList.toggle("hidden", role !== "teacher");
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
    const options = subjectsForGrade(g);
    const selected = existing[g] || [];
    return `
      <div class="assignment-card" data-grade="${g}">
        <strong>${g}</strong>
        <p>اختر مادتين كحد أقصى لهذا الصف:</p>
        <div class="subject-grid">
          ${options.map((s) => `<label><input type="checkbox" class="subjectPick" data-grade="${g}" value="${s}" ${selected.includes(s) ? "checked" : ""}/> ${s}</label>`).join("")}
        </div>
      </div>
    `;
  }).join("");

  holder.dataset.selection = JSON.stringify(existing);
}

function collectTeacherAssignments() {
  const selectedGrades = [...document.querySelectorAll(".gradePick:checked")].map((i) => i.value);
  const map = {};
  for (const grade of selectedGrades) {
    const subs = [...document.querySelectorAll(`.subjectPick[data-grade="${grade}"]:checked`)].map((i) => i.value);
    map[grade] = subs;
  }
  return map;
}

function validateTeacherAssignments(assignments) {
  const grades = Object.keys(assignments);
  if (!grades.length) return "اختر صفاً واحداً على الأقل.";
  for (const grade of grades) {
    const subs = assignments[grade] || [];
    if (!subs.length) return `اختر مادة واحدة على الأقل لصف ${grade}.`;
    if (subs.length > 2) return `لا يمكن اختيار أكثر من مادتين لصف ${grade}.`;
    const valid = subjectsForGrade(grade);
    if (subs.some((s) => !valid.includes(s))) return `مواد غير صالحة في صف ${grade}.`;
  }
  return "";
}

function renderDashboard() {
  el("loginScreen").classList.add("hidden");
  el("dashboard").classList.remove("hidden");
  el("welcome").textContent = `مرحباً ${session.fullName}`;
  el("subtitle").textContent = session.role === "teacher"
    ? "لوحة المعلم: منشورات، دردشات، وإدارة صفوفك." : session.role === "admin"
    ? "لوحة الإدارة: متابعة شاملة ومنشورات عامة." : "لوحة الطالب: منشوراتك ودردشات صفك.";

  el("teacherPostBox").classList.toggle("hidden", session.role !== "teacher");
  el("adminPostBox").classList.toggle("hidden", session.role !== "admin");
  el("teacherChatTools").classList.toggle("hidden", session.role !== "teacher");

  hydrateTeacherSelectors();
  el("openaiKey").value = localStorage.getItem("openai_api_key") || "";
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
    out.push(`<li><strong>${esc(session.grade)}</strong><p>موادك حسب صفك مع دردشات مخصصة.</p></li>`);
  } else {
    out.push("<li><strong>الإدارة</strong><p>متابعة كل الصفوف والنشاط.</p></li>");
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
  const pSubs = session.assignments[pg] || [];
  const cSubs = session.assignments[cg] || [];
  el("postSubject").innerHTML = pSubs.map((s) => `<option value="${s}">${s}</option>`).join("");
  el("chatSubject").innerHTML = cSubs.map((s) => `<option value="${s}">${s}</option>`).join("");
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
  if (!text) return;
  if (!session.assignments[grade]?.includes(subject)) return;
  state.data.posts.unshift({ id: uid("p"), audience: "targeted", authorId: session.id, authorName: session.fullName, grade, subject, text });
  el("postText").value = "";
  saveData();
  renderPosts();
}

function publishAdminPost() {
  const text = el("adminPostText").value.trim();
  if (!text) return;
  state.data.posts.unshift({ id: uid("p"), audience: "global", authorId: session.id, authorName: `الإدارة - ${session.fullName}`, grade: "all", subject: "all", text });
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

  if (!state.selectedChatId || !chats.some((c) => c.id === state.selectedChatId)) {
    state.selectedChatId = chats[0]?.id || null;
  }
  renderConversation();
}

function renderConversation() {
  const box = el("chatConversation");
  const chat = state.data.chats.find((c) => c.id === state.selectedChatId);
  if (!chat) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  el("chatRoomTitle").textContent = `${chat.title} (${chat.grade} - ${chat.subject})`;
  el("chatMessages").innerHTML = (chat.messages || []).map((m) => `<div class="message-item ${m.senderId === session.id ? "me" : ""}"><strong>${esc(m.senderName)}:</strong> ${esc(m.text)}</div>`).join("") || "<div>ابدأ المحادثة الآن...</div>";
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
  const results = accounts.filter((a) => a.role === "student" && a.grade === grade && (a.fullName.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)));
  el("searchResult").innerHTML = results.length ? results.map((a) => `<li>${esc(a.fullName)} (${esc(a.id)}) <button class="btn addMember" data-id="${esc(a.id)}">إضافة</button></li>`).join("") : "<li>لا نتائج</li>";
}

function renderSelectedMembers() {
  el("selectedMembers").innerHTML = state.selectedMembers.length ? state.selectedMembers.map((m) => `<li>${esc(m.fullName)} (${esc(m.id)}) <button class="btn removeMember" data-id="${esc(m.id)}">حذف</button></li>`).join("") : "<li>لا يوجد أعضاء مضافون.</li>";
}

function createChat() {
  const title = el("chatTitle").value.trim();
  const grade = el("chatGrade").value;
  const subject = el("chatSubject").value;
  if (!title || !grade || !subject || !state.selectedMembers.length) return;
  if (!session.assignments[grade]?.includes(subject)) return;

  const owner = { id: session.id, fullName: session.fullName };
  const chat = { id: uid("c"), ownerId: session.id, title, grade, subject, members: [owner, ...state.selectedMembers], messages: [] };
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
    el("aiAnswer").textContent = "ضع OpenAI API Key ليعمل ChatGPT بشكل مباشر. (حالياً رد تجريبي)";
    return;
  }

  el("aiAnswer").textContent = "جاري التفكير...";
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

function getOrCreateStudent(fullName, id, grade) {
  let s = accounts.find((a) => (id && a.id === id) || a.fullName === fullName);
  if (s && s.role !== "student") return null;
  if (!s) {
    s = { id: id || `ST${Math.floor(Math.random() * 9000 + 1000)}`, fullName, role: "student", grade };
    accounts.push(s);
  }
  s.grade = grade;
  return s;
}

roleTabs.forEach((btn) => btn.addEventListener("click", () => { el("loginMsg").textContent = ""; setRole(btn.dataset.role); }));

document.addEventListener("change", (e) => {
  if (e.target.classList.contains("gradePick")) renderPerGradeSubjects();

  if (e.target.classList.contains("subjectPick")) {
    const grade = e.target.dataset.grade;
    const checked = [...document.querySelectorAll(`.subjectPick[data-grade="${grade}"]:checked`)];
    if (checked.length > 2) {
      e.target.checked = false;
      el("loginMsg").textContent = `حد المواد لصف ${grade} هو مادتان فقط.`;
    }

    const holder = el("perGradeSubjects");
    const map = collectTeacherAssignments();
    holder.dataset.selection = JSON.stringify(map);
  }

  if (session?.role === "teacher" && (e.target.id === "postGrade" || e.target.id === "chatGrade")) updateTeacherSubjectSelectors();
});

document.addEventListener("click", (e) => {
  if (e.target.matches(".addMember")) {
    const id = e.target.dataset.id;
    const acc = accounts.find((a) => a.id === id);
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
  if (password.length < 6) return (el("loginMsg").textContent = "كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل.");

  if (state.role === "student") {
    const grade = el("studentGrade").value;
    const student = getOrCreateStudent(fullName, el("studentId").value.trim(), grade);
    if (!student) return (el("loginMsg").textContent = "تعارض في بيانات الحساب.");
    session = { ...student };
  }

  if (state.role === "teacher") {
    if (el("teacherSecret").value.trim() !== TEACHER_SECRET) return (el("loginMsg").textContent = "الرقم السري للمعلم غير صحيح.");
    const email = el("teacherEmail").value.trim();
    if (!email) return (el("loginMsg").textContent = "بريد المعلم مطلوب.");

    const assignments = collectTeacherAssignments();
    const err = validateTeacherAssignments(assignments);
    if (err) return (el("loginMsg").textContent = err);

    session = { id: `TC-${email.toLowerCase()}`, fullName, role: "teacher", email, assignments };
  }

  if (state.role === "admin") {
    if (fullName !== ADMIN_NAME) return (el("loginMsg").textContent = "اسم الإدارة يجب أن يكون: ادارة المدرسة");
    if (el("adminSecret").value.trim() !== ADMIN_SECRET) return (el("loginMsg").textContent = "الرقم السري للإدارة غير صحيح.");
    session = { id: "ADMIN-1", fullName, role: "admin" };
  }

  saveSession(session); // حفظ تسجيل الدخول للكل
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
