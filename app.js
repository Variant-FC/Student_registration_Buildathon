const STORAGE_KEY = "attendance-register-state";
const getToday = () => new Date().toISOString().slice(0, 10);

const defaultState = {
  selectedClassId: "class-1",
  selectedSessionId: "session-1",
  classes: [
    {
      id: "class-1",
      name: "Computer Network Security",
      students: [
        { id: "student-1", number: "EDU01", name: "Mohammed Salah" },
        { id: "student-2", number: "EDU02", name: "Mbekezeli Mbokazi" }
      ],
      sessions: [
        { id: "session-1", name: "Week 1 lecture", date: getToday(), attendance: { "student-1": "P", "student-2": "A" } }
      ]
    }
  ]
};

const state = loadState();

const elements = {
  exportBtn: document.getElementById("exportBtn"),
  classForm: document.getElementById("classForm"),
  sessionForm: document.getElementById("sessionForm"),
  studentForm: document.getElementById("studentForm"),
  classNameInput: document.getElementById("classNameInput"),
  sessionNameInput: document.getElementById("sessionNameInput"),
  sessionDateInput: document.getElementById("sessionDateInput"),
  studentNameInput: document.getElementById("studentNameInput"),
  studentNumberInput: document.getElementById("studentIDInput"),
  classSelect: document.getElementById("classSelect"),
  sessionSelect: document.getElementById("sessionSelect"),
  deleteClassBtn: document.getElementById("deleteClassBtn"),
  deleteSessionBtn: document.getElementById("deleteSessionBtn"),
  stats: document.getElementById("stats"),
  summary: document.getElementById("activeSummary"),
  attendanceTable: document.getElementById("attendanceTable"),
  studentList: document.getElementById("studentList")
};

//storage 

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeState(saved || defaultState);
  } catch {
    return normalizeState(defaultState);
  }
}

function normalizeState(input) {
  const classes = Array.isArray(input.classes) ? input.classes.map((currentClass) => ({
    ...currentClass,
    students: Array.isArray(currentClass.students) ? currentClass.students.map((student) => ({
      id: student.id || makeId("student"),
      number: student.number || student.roll || "",
      name: student.name || "Student"
    })) : [],
    sessions: Array.isArray(currentClass.sessions) ? currentClass.sessions.map((session) => ({
      ...session,
      name: session.name || session.title || "Session",
      attendance: session.attendance || {}
    })) : []
  })) : defaultState.classes;

  return {
    selectedClassId: input.selectedClassId || classes[0]?.id || null,
    selectedSessionId: input.selectedSessionId || classes[0]?.sessions[0]?.id || null,
    classes
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Could not save attendance data:", err);
  }
}
 
function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function activeClass() {
  return state.classes.find((item) => item.id === state.selectedClassId) || state.classes[0] || null;
}

function activeSession() {
  const currentClass = activeClass();
  return currentClass?.sessions.find((session) => session.id === state.selectedSessionId) || currentClass?.sessions[0] || null;
}

function ensureSelection() {
  const currentClass = activeClass();

  if (!currentClass) {
    state.selectedClassId = null;
    state.selectedSessionId = null;
    return;
  }

  state.selectedClassId = currentClass.id;
  if (!currentClass.sessions.some((session) => session.id === state.selectedSessionId)) {
    state.selectedSessionId = currentClass.sessions[0]?.id || null;
  }
}

function optionsFrom(items, selectedId, emptyLabel) {
  if (!items.length) return `<option value="">${escapeHtml(emptyLabel)}</option>`;
  return items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function attendanceLabel(value) {
  return value === "P" ? "Present" : value === "A" ? "Absent" : "Not marked";
}


function bindAddForm(form, { fields, validate, build, after }) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value.trim()]));

    if (validate && !validate(values)) return;

    build(values);

    Object.values(fields).forEach((input) => {
      if (input.type !== "date") input.value = "";
    });
    after?.();
    render();
  });
}

// rendering 
function render() {
  ensureSelection();

  const currentClass = activeClass();
  const currentSession = activeSession();
  const studentCount = currentClass?.students.length || 0;
  const sessionCount = currentClass?.sessions.length || 0;
  const markedCount = currentSession ? Object.values(currentSession.attendance || {}).filter(Boolean).length : 0;

  elements.classSelect.innerHTML = optionsFrom(state.classes, state.selectedClassId, "No classes yet");
  elements.sessionSelect.innerHTML = optionsFrom(currentClass?.sessions || [], state.selectedSessionId, "No sessions yet");
  elements.deleteClassBtn.disabled = !currentClass;
  elements.deleteSessionBtn.disabled = !currentSession;
  elements.stats.innerHTML = `<span>${studentCount} students</span><span>${sessionCount} sessions</span><span>${markedCount} marked</span>`;
  elements.summary.textContent = currentClass ? `${currentClass.name}${currentSession ? ` · ${currentSession.name} · ${currentSession.date}` : ""}` : "Create a class to begin.";

  elements.attendanceTable.innerHTML = currentClass && currentSession && currentClass.students.length ? `
    <div class="table-head"><span>Student number</span><span>Name</span><span>Attendance</span></div>
    ${currentClass.students.map((student) => {
      const current = currentSession.attendance[student.id] || "";
      const chip = (value, label) => `
        <label class="chip ${current === value ? "active" : ""}">
          <input type="radio" name="attendance-${student.id}" value="${value}" data-student="${student.id}" ${current === value ? "checked" : ""}>${label}
        </label>`;
      return `
      <div class="table-row">
        <span>${escapeHtml(student.number)}</span>
        <span>${escapeHtml(student.name)}</span>
        <div class="attendance-choice">
          ${chip("P", "Present")}
          ${chip("A", "Absent")}
          ${chip("", "Not marked")}
        </div>
      </div>`;
    }).join("")}
  ` : '<p class="empty">Create a class and session, then add students to mark attendance.</p>';

  elements.studentList.innerHTML = currentClass?.students.length ? currentClass.students.map((student) => `
    <article class="student-row">
      <div><strong>${escapeHtml(student.number)}</strong><span>${escapeHtml(student.name)}</span></div>
      <button type="button" class="ghost-btn" data-remove="${student.id}">Remove</button>
    </article>
  `).join("") : '<p class="empty">No students added yet.</p>';

  saveState();
}

function exportCsv() {
  const rows = [["Class", "Session", "Date", "Student number", "Student", "Attendance"]];

  state.classes.forEach((currentClass) => {
    currentClass.sessions.forEach((session) => {
      currentClass.students.forEach((student) => {
        rows.push([
          currentClass.name,
          session.name,
          session.date,
          student.number,
          student.name,
          attendanceLabel(session.attendance?.[student.id])
        ]);
      });
    });
  });

  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "attendance-register.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

//events 

elements.exportBtn.addEventListener("click", exportCsv);

bindAddForm(elements.classForm, {
  fields: { name: elements.classNameInput },
  validate: ({ name }) => {
    if (!name) return false;
    if (state.classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      alert(`A class named "${name}" already exists.`);
      return false;
    }
    return true;
  },
  build: ({ name }) => {
    const newClass = { id: makeId("class"), name, students: [], sessions: [] };
    state.classes.push(newClass);
    state.selectedClassId = newClass.id;
    state.selectedSessionId = null;
  }
});

bindAddForm(elements.sessionForm, {
  fields: { name: elements.sessionNameInput, date: elements.sessionDateInput },
  validate: ({ name, date }) => Boolean(activeClass() && name && date),
  build: ({ name, date }) => {
    const currentClass = activeClass();
    const session = { id: makeId("session"), name, date, attendance: Object.fromEntries(currentClass.students.map((student) => [student.id, ""])) };
    currentClass.sessions.push(session);
    state.selectedSessionId = session.id;
  },
  after: () => {
    elements.sessionDateInput.value = getToday();
  }
});

bindAddForm(elements.studentForm, {
  fields: { name: elements.studentNameInput, number: elements.studentNumberInput },
  validate: ({ name, number }) => {
    const currentClass = activeClass();
    if (!currentClass || !name || !number) return false;
    if (currentClass.students.some((s) => s.number === number)) {
      alert(`Student number "${number}" is already in use for this class.`);
      return false;
    }
    return true;
  },
  build: ({ name, number }) => {
    const currentClass = activeClass();
    const student = { id: makeId("student"), name, number };
    currentClass.students.push(student);
    currentClass.sessions.forEach((session) => {
      session.attendance[student.id] = "";
    });
  }
});

elements.deleteClassBtn.addEventListener("click", () => {
  const currentClass = activeClass();
  if (!currentClass) return;
  if (!confirm(`Delete "${currentClass.name}"? This removes all its sessions, students, and attendance records.`)) return;
  state.classes = state.classes.filter((c) => c.id !== currentClass.id);
  state.selectedClassId = state.classes[0]?.id || null;
  state.selectedSessionId = null;
  render();
});

elements.deleteSessionBtn.addEventListener("click", () => {
  const currentClass = activeClass();
  const currentSession = activeSession();
  if (!currentClass || !currentSession) return;
  if (!confirm(`Delete session "${currentSession.name}" (${currentSession.date})? Its attendance records will be lost.`)) return;
  currentClass.sessions = currentClass.sessions.filter((s) => s.id !== currentSession.id);
  state.selectedSessionId = null;
  render();
});

elements.classSelect.addEventListener("change", (event) => {
  state.selectedClassId = event.target.value;
  state.selectedSessionId = null;
  render();
});

elements.sessionSelect.addEventListener("change", (event) => {
  state.selectedSessionId = event.target.value;
  render();
});

elements.attendanceTable.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.student) return;
  const session = activeSession();
  if (!session) return;
  session.attendance[target.dataset.student] = target.value;
  render();
});

elements.studentList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.dataset.remove) return;
  const currentClass = activeClass();
  if (!currentClass) return;
  const student = currentClass.students.find((s) => s.id === target.dataset.remove);
  if (student && !confirm(`Remove ${student.name} (${student.number}) from this class?`)) return;
  currentClass.students = currentClass.students.filter((s) => s.id !== target.dataset.remove);
  currentClass.sessions.forEach((session) => delete session.attendance[target.dataset.remove]);
  render();
});

elements.sessionDateInput.value = getToday();
render();

