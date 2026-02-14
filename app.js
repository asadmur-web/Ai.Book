const TEACHER_SECRET = "951951";
const ADMIN_SECRET = "2512011";
const ADMIN_NAME = "ادارة المدرسة";

const gradeNames = ["السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const baseSubjects = [
  "اللغة العربية",
  "اللغة الانجليزية",
  "التربية الاسلامية",
  "التكنولوجيا و البرمجة",
  "المواد الشرعية",
  "الرياضيات",
  "العلوم",
  "الدراسات الاجتماعية",
  "التربية البدنية",
];
const grade10Subjects = baseSubjects
  .filter((s) => s !== "العلوم")
  .concat(["فيزياء", "كيمياء", "احياء"]);

const accounts = [
  { id: "ST1001", fullName: "خالد أحمد يوسف علي", role: "student", grade: "السادس" },
  { id: "ST1002", fullName: "محمد سامي فهد حسن", role: "student", grade: "السابع" },
  { id: "ST1003", fullName: "ليان عمر حمد سليمان", role: "student", grade: "الثامن" },
  { id: "ST1004", fullName: "سارة أنس محمود عبد الله", role: "student", grade: "التاسع" },
  { id: "ST1005", fullName: "عبدالله كريم ناصر خالد", role: "student", grade: "العاشر" },
];

const state = {
  role: "student",
  selectedMembers: [],
  data: safeParse(localStorage.getItem("aiBookData") || '{"posts":[],"chats":[]}', { posts: [], chats: [] }),
};


function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const el = (id) => document.getElementById(id);
const roleButtons = document.querySelectorAll(".tab");

function subjectsForGrades(grades) {
  const all = new Set();
  grades.forEach((grade) => {
    (grade === "العاشر" ? grade10Subjects : baseSubjects).forEach((s) => all.add(s));
  });
  return [...all];
}

function setRole(role) {
  state.role = role;
  roleButtons.forEach((b) => b.classList.toggle("active", b.dataset.role === role));

  el("emailField").classList.toggle("hidden", role !== "teacher");
  el("teacherCodeField").classList.toggle("hidden", role !== "teacher");
  el("teacherGradesField").classList.toggle("hidden", role !== "teacher");
  el("teacherSubjectsField").classList.toggle("hidden", role !== "teacher");

  el("studentGradeField").classList.toggle("hidden", role !== "student");
  el("idField").classList.toggle("hidden", role !== "student");
  el("rememberField").classList.toggle("hidden", role !== "student");

  el("adminCodeField").classList.toggle("hidden", role !== "admin");
}

function renderLoginOptions() {
  el("studentGrade").innerHTML = gradeNames.map((g) => `<option value="${g}">${g}</option>`).join("");

  el("teacherGrades").innerHTML = gradeNames
    .map(
      (g) =>
        `<label><input type="checkbox" name="teacherGrade" value="${g}"> ${g}</label>`
    )
    .join("");
  renderTeacherSubjects();
}

function renderTeacherSubjects() {
  const selectedGrades = [...document.querySelectorAll('input[name="teacherGrade"]:checked')].map((i) => i.value);
  const subjects = selectedGrades.length ? subjectsForGrades(selectedGrades) : baseSubjects;
  const previously = [...document.querySelectorAll('input[name="teacherSubject"]:checked')].map((i) => i.value);

  el("teacherSubjects").innerHTML = subjects
    .map((s) => `<label><input type="checkbox" name="teacherSubject" value="${s}"> ${s}</label>`)
    .join("");

  previously.forEach((subj) => {
    const input = document.querySelector(`input[name="teacherSubject"][value="${CSS.escape(subj)}"]`);
    if (input) input.checked = true;
  });
}

function readTeacherProfile() {
  const grades = [...document.querySelectorAll('input[name="teacherGrade"]:checked')].map((i) => i.value);
  const subjects = [...document.querySelectorAll('input[name="teacherSubject"]:checked')].map((i) => i.value);
  return { grades, subjects };
}

function saveSession(session, remember) {
  if (session.role === "student" && remember) {
    localStorage.setItem("aiBookSession", JSON.stringify(session));
    sessionStorage.removeItem("aiBookSession");
  } else {
    sessionStorage.setItem("aiBookSession", JSON.stringify(session));
    localStorage.removeItem("aiBookSession");
  }
}

function loadSession() {
  const v = localStorage.getItem("aiBookSession") || sessionStorage.getItem("aiBookSession");
  return v ? safeParse(v, null) : null;
}

function clearSession() {
  localStorage.removeItem("aiBookSession");
  sessionStorage.removeItem("aiBookSession");
}

function saveData() {
  localStorage.setItem("aiBookData", JSON.stringify(state.data));
}

function canTeacherTarget(session, grade, subject) {
  return session.grades.includes(grade) && session.subjects.includes(subject);
}

function renderDashboard(session) {
  el("loginScreen").classList.add("hidden");
  el("dashboard").classList.remove("hidden");

  const byRole = {
    student: "لوحة الطالب: مهامك، دردشات صفك، ومنشورات معلميك.",
    teacher: "لوحة المعلم: إدارة الصفوف، المنشورات، والدردشات الخاصة بك.",
    admin: "لوحة الإدارة: متابعة عامة وإشراف المنصة.",
  };

  el("welcome").textContent = `مرحباً ${session.fullName}`;
  el("subtitle").textContent = byRole[session.role];

  el("teacherPostComposer").classList.toggle("hidden", session.role !== "teacher");
  el("adminPostComposer").classList.toggle("hidden", session.role !== "admin");
  el("teacherChatTools").classList.toggle("hidden", session.role !== "teacher");

  renderClasses(session);
  renderPosts(session);
  renderChats(session);
  hydrateTeacherSelectors(session);
}

function renderClasses(session) {
  const items = [];
  if (session.role === "teacher") {
    session.grades.forEach((g) => {
      items.push(`<li><strong>${escapeHtml(g)}</strong><p>موادك: ${escapeHtml(session.subjects.join("، "))}</p></li>`);
    });
  } else if (session.role === "student") {
    items.push(`<li><strong>${escapeHtml(session.grade)}</strong><p>يمكنك الوصول لدردشات صفك ومنشورات المواد.</p></li>`);
  } else {
    items.push(`<li><strong>الإدارة</strong><p>مراقبة المنصة وإدارة الانضباط الرقمي.</p></li>`);
  }
  el("classesList").innerHTML = items.join("");
}

function visiblePosts(session) {
  if (session.role === "admin") return state.data.posts;
  if (session.role === "teacher") {
    return state.data.posts.filter((p) => p.audience === "global" || p.authorId === session.id);
  }
  return state.data.posts.filter((p) => p.audience === "global" || p.grade === session.grade);
}

function renderPosts(session) {
  const posts = visiblePosts(session);
  el("postsList").innerHTML = posts.length
    ? posts
        .map(
          (p) =>
            `<li><strong>${p.audience === "global" ? "إعلان عام" : `${escapeHtml(p.grade)} - ${escapeHtml(p.subject)}`}</strong><p>${escapeHtml(p.body)}</p><small>${escapeHtml(p.authorName)}</small></li>`
        )
        .join("")
    : "<li>لا توجد منشورات حالياً.</li>";
}

function visibleChats(session) {
  if (session.role === "admin") return state.data.chats;
  if (session.role === "teacher") return state.data.chats.filter((c) => c.ownerId === session.id);
  return state.data.chats.filter((c) => c.grade === session.grade && c.members.some((m) => m.id === session.id));
}

function renderChats(session) {
  const chats = visibleChats(session);
  el("chatList").innerHTML = chats.length
    ? chats
        .map(
          (c) =>
            `<li><strong>${escapeHtml(c.title)}</strong><p>${escapeHtml(c.grade)} · ${escapeHtml(c.subject)}</p><small>أعضاء: ${escapeHtml(c.members.map((m) => m.fullName).join("، "))}</small></li>`
        )
        .join("")
    : "<li>لا توجد دردشات مطابقة حالياً.</li>";
}

function hydrateTeacherSelectors(session) {
  if (session.role !== "teacher") return;
  el("postGrade").innerHTML = session.grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  el("chatGrade").innerHTML = session.grades.map((g) => `<option value="${g}">${g}</option>`).join("");
  updateSubjectSelectors(session);
}

function updateSubjectSelectors(session) {
  if (session.role !== "teacher") return;
  const grade = el("postGrade").value || session.grades[0];
  const grade2 = el("chatGrade").value || session.grades[0];

  const s1 = session.subjects.filter((s) => subjectsForGrades([grade]).includes(s));
  const s2 = session.subjects.filter((s) => subjectsForGrades([grade2]).includes(s));

  el("postSubject").innerHTML = s1.map((s) => `<option value="${s}">${s}</option>`).join("");
  el("chatSubject").innerHTML = s2.map((s) => `<option value="${s}">${s}</option>`).join("");
}

function validateTeacherSelection(grades, subjects) {
  if (!grades.length) return "اختر صفاً واحداً على الأقل للمعلم.";
  if (!subjects.length) return "اختر مادة واحدة على الأقل للمعلم.";
  if (subjects.length > 2) return "يسمح للمعلم باختيار مادتين كحد أقصى.";

  const valid = new Set(subjectsForGrades(grades));
  if (subjects.some((s) => !valid.has(s))) return "مادة مختارة غير متاحة ضمن الصفوف المختارة.";
  return "";
}

function getOrCreateStudent(name, id, grade) {
  let user = accounts.find((a) => a.id === id || a.fullName === name);
  if (user && user.role !== "student") return null;
  if (!user) {
    user = { id: id || `ST${Math.floor(Math.random() * 9000 + 1000)}`, fullName: name, role: "student", grade };
    accounts.push(user);
  }
  user.grade = grade;
  return user;
}

function publishTeacherPost(session) {
  const grade = el("postGrade").value;
  const subject = el("postSubject").value;
  const body = el("postBody").value.trim();
  if (!body) return;
  if (!canTeacherTarget(session, grade, subject)) return;

  state.data.posts.unshift({
    id: crypto.randomUUID(),
    authorId: session.id,
    authorName: session.fullName,
    audience: "targeted",
    grade,
    subject,
    body,
  });
  el("postBody").value = "";
  saveData();
  renderPosts(session);
}

function publishAdminPost(session) {
  const body = el("adminPostBody").value.trim();
  if (!body || session.role !== "admin") return;

  state.data.posts.unshift({
    id: crypto.randomUUID(),
    authorId: session.id,
    authorName: `الإدارة - ${session.fullName}`,
    audience: "global",
    grade: "all",
    subject: "all",
    body,
  });
  el("adminPostBody").value = "";
  saveData();
  renderPosts(session);
}

function renderSelectedMembers() {
  el("selectedMembers").innerHTML = state.selectedMembers.length
    ? state.selectedMembers
        .map((m) => `<li>${escapeHtml(m.fullName)} (${escapeHtml(m.id)}) <button class="btn remove" data-id="${escapeHtml(m.id)}">إزالة</button></li>`)
        .join("")
    : "<li>لا يوجد أعضاء مضافون.</li>";
}

function searchAccounts(session) {
  const q = el("accountSearch").value.trim().toLowerCase();
  if (!q) return;
  const g = el("chatGrade").value;
  const list = accounts.filter(
    (a) =>
      a.role === "student" &&
      a.grade === g &&
      (a.fullName.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
  );

  el("searchResults").innerHTML = list.length
    ? list
        .map((a) => `<li>${escapeHtml(a.fullName)} (${escapeHtml(a.id)}) <button class="btn add" data-id="${escapeHtml(a.id)}">إضافة</button></li>`)
        .join("")
    : "<li>لا نتائج.</li>";

  renderChats(session);
}

function createChat(session) {
  const title = el("chatTitle").value.trim();
  const grade = el("chatGrade").value;
  const subject = el("chatSubject").value;

  if (!title || !subject || !grade || !canTeacherTarget(session, grade, subject)) return;
  if (!state.selectedMembers.length) return;

  const owner = { id: session.id, fullName: session.fullName };
  state.data.chats.unshift({
    id: crypto.randomUUID(),
    ownerId: session.id,
    title,
    grade,
    subject,
    members: [owner, ...state.selectedMembers],
  });

  state.selectedMembers = [];
  el("chatTitle").value = "";
  el("searchResults").innerHTML = "";
  saveData();
  renderSelectedMembers();
  renderChats(session);
}

function aiReply(session, text) {
  if (session.role === "teacher") return `خطة مقترحة: بداية تفاعلية 7 دقائق، نشاط جماعي 15 دقيقة، تقييم ختامي مرتبط بسؤالك: ${text}`;
  if (session.role === "admin") return `توصية إدارية: راقب مؤشرات المشاركة الأسبوعية واربطها بخطة دعم للصفوف الأقل نشاطاً. (${text})`;
  return `مذاكرة ذكية: 25 دقيقة تركيز + 5 دقائق مراجعة، وكرر 3 مرات لسؤالك: ${text}`;
}

let currentSession = null;

document.addEventListener("change", (e) => {
  if (e.target.name === "teacherGrade") renderTeacherSubjects();
  if (currentSession?.role === "teacher" && (e.target.id === "postGrade" || e.target.id === "chatGrade")) updateSubjectSelectors(currentSession);

  if (e.target.name === "teacherSubject") {
    const checked = [...document.querySelectorAll('input[name="teacherSubject"]:checked')];
    if (checked.length > 2) {
      e.target.checked = false;
      el("loginMessage").textContent = "حد المواد للمعلم هو مادتان فقط.";
    }
  }
});

document.addEventListener("click", (e) => {
  if (e.target.matches(".add")) {
    const user = accounts.find((a) => a.id === e.target.dataset.id);
    if (user && !state.selectedMembers.some((m) => m.id === user.id)) {
      state.selectedMembers.push({ id: user.id, fullName: user.fullName });
      renderSelectedMembers();
    }
  }

  if (e.target.matches(".remove")) {
    state.selectedMembers = state.selectedMembers.filter((m) => m.id !== e.target.dataset.id);
    renderSelectedMembers();
  }
});

roleButtons.forEach((btn) => btn.addEventListener("click", () => setRole(btn.dataset.role)));

el("loginForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  el("loginMessage").textContent = "";

  const fullName = el("fullName").value.trim();
  const password = el("password").value.trim();

  if (!fullName || !password) {
    el("loginMessage").textContent = "أكمل الحقول المطلوبة.";
    return;
  }

  if (password.length < 6) {
    el("loginMessage").textContent = "كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل.";
    return;
  }

  if (state.role === "student") {
    const id = el("userId").value.trim();
    const grade = el("studentGrade").value;
    const student = getOrCreateStudent(fullName, id, grade);
    if (!student) {
      el("loginMessage").textContent = "تعارض في بيانات الحساب.";
      return;
    }
    currentSession = { ...student };
    saveSession(currentSession, el("rememberStudent").checked);
  }

  if (state.role === "teacher") {
    const teacherCode = el("teacherCode").value.trim();
    const email = el("email").value.trim();
    const { grades, subjects } = readTeacherProfile();
    const error = validateTeacherSelection(grades, subjects);

    if (!email) {
      el("loginMessage").textContent = "بريد المعلم مطلوب.";
      return;
    }
    if (teacherCode !== TEACHER_SECRET) {
      el("loginMessage").textContent = "الرقم السري للمعلم غير صحيح.";
      return;
    }
    if (error) {
      el("loginMessage").textContent = error;
      return;
    }

    currentSession = {
      id: `TC-${email.toLowerCase()}`,
      fullName,
      role: "teacher",
      email,
      grades,
      subjects,
    };
    saveSession(currentSession, false);
  }

  if (state.role === "admin") {
    if (fullName !== ADMIN_NAME) {
      el("loginMessage").textContent = "اسم حساب الإدارة غير صحيح.";
      return;
    }
    if (el("adminCode").value.trim() !== ADMIN_SECRET) {
      el("loginMessage").textContent = "الرقم السري للإدارة غير صحيح.";
      return;
    }

    currentSession = { id: "ADMIN-1", fullName, role: "admin" };
    saveSession(currentSession, false);
  }

  renderDashboard(currentSession);
});

el("publishPost").addEventListener("click", () => currentSession && publishTeacherPost(currentSession));
el("publishAdminPost").addEventListener("click", () => currentSession && publishAdminPost(currentSession));
el("searchAccount").addEventListener("click", () => currentSession && searchAccounts(currentSession));
el("createChat").addEventListener("click", () => currentSession && createChat(currentSession));

el("askAi").addEventListener("click", () => {
  if (!currentSession) return;
  const text = el("aiPrompt").value.trim();
  if (!text) return;
  el("aiAnswer").textContent = aiReply(currentSession, text);
});

el("logoutBtn").addEventListener("click", () => {
  clearSession();
  currentSession = null;
  state.selectedMembers = [];
  el("dashboard").classList.add("hidden");
  el("loginScreen").classList.remove("hidden");
  el("loginForm").reset();
  renderSelectedMembers();
  setRole("student");
});

renderLoginOptions();
renderSelectedMembers();
setRole("student");

const saved = loadSession();
if (saved) {
  currentSession = saved;
  renderDashboard(saved);
}
