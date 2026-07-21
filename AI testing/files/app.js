(function () {
  "use strict";

  const STORAGE_KEY = "roll-book-data-v1";

  /** @type {{classes: Array<{id:string,name:string}>, studentsByClass: Object, sessionsByClass: Object, attendanceByClass: Object}} */
  let data = loadData();
  let state = {
    activeClassId: data.classes[0] ? data.classes[0].id : null,
    activeSessionId: null,
  };

  // ---------- persistence ----------

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn("Could not read saved data, starting fresh.", err);
    }
    return { classes: [], studentsByClass: {}, sessionsByClass: {}, attendanceByClass: {} };
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      flashSaved();
    } catch (err) {
      console.warn("Could not save data.", err);
    }
  }

  function flashSaved() {
    const el = document.getElementById("saveIndicator");
    if (!el) return;
    el.classList.add("just-saved");
    setTimeout(() => el.classList.remove("just-saved"), 600);
  }

  // ---------- helpers ----------

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getStudents(classId) {
    return data.studentsByClass[classId] || [];
  }

  function getSessions(classId) {
    return data.sessionsByClass[classId] || [];
  }

  function getAttendance(classId, sessionId) {
    const byClass = data.attendanceByClass[classId] || {};
    return byClass[sessionId] || {};
  }

  function setAttendance(classId, sessionId, studentId, status) {
    if (!data.attendanceByClass[classId]) data.attendanceByClass[classId] = {};
    if (!data.attendanceByClass[classId][sessionId]) data.attendanceByClass[classId][sessionId] = {};
    const current = data.attendanceByClass[classId][sessionId][studentId];
    // clicking the active mark again clears it
    data.attendanceByClass[classId][sessionId][studentId] = current === status ? undefined : status;
    if (data.attendanceByClass[classId][sessionId][studentId] === undefined) {
      delete data.attendanceByClass[classId][sessionId][studentId];
    }
  }

  function activeClass() {
    return data.classes.find((c) => c.id === state.activeClassId) || null;
  }

  function activeSession() {
    if (!state.activeClassId) return null;
    return getSessions(state.activeClassId).find((s) => s.id === state.activeSessionId) || null;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  // ---------- rendering ----------

  function render() {
    renderClassTabs();

    const hasClasses = data.classes.length > 0;
    document.getElementById("emptyState").classList.toggle("hidden", hasClasses);
    document.getElementById("toolbar").classList.toggle("hidden", !hasClasses);
    document.getElementById("mainGrid").classList.toggle("hidden", !hasClasses);

    if (!hasClasses) return;

    renderSessionSelect();
    renderStudentList();
    renderAttendanceTable();
    renderStats();
  }

  function renderClassTabs() {
    const row = document.getElementById("classTabsRow");
    row.innerHTML = "";
    data.classes.forEach((cls) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "class-tab" + (cls.id === state.activeClassId ? " active" : "");
      tab.setAttribute("aria-pressed", cls.id === state.activeClassId ? "true" : "false");

      const label = document.createElement("span");
      label.textContent = cls.name;
      tab.appendChild(label);

      const remove = document.createElement("span");
      remove.className = "remove-tab";
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", "Delete " + cls.name);
      remove.textContent = "\u00d7";
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteClass(cls.id);
      });
      tab.appendChild(remove);

      tab.addEventListener("click", () => selectClass(cls.id));
      row.appendChild(tab);
    });
  }

  function renderSessionSelect() {
    const select = document.getElementById("sessionSelect");
    const sessions = getSessions(state.activeClassId);
    select.innerHTML = "";

    if (sessions.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No sessions yet";
      opt.value = "";
      select.appendChild(opt);
      select.disabled = true;
      state.activeSessionId = null;
      return;
    }

    select.disabled = false;
    if (!state.activeSessionId || !sessions.find((s) => s.id === state.activeSessionId)) {
      state.activeSessionId = sessions[sessions.length - 1].id;
    }

    sessions.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name + " \u2014 " + formatDate(s.date);
      if (s.id === state.activeSessionId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function renderStudentList() {
    const list = document.getElementById("studentList");
    const students = getStudents(state.activeClassId);
    const countEl = document.getElementById("rollCount");
    countEl.textContent = students.length === 0
      ? "No students yet."
      : students.length + (students.length === 1 ? " student on the roll." : " students on the roll.");

    list.innerHTML = "";
    if (students.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Add your first student using the form on the left.";
      list.appendChild(p);
      return;
    }

    students.forEach((student) => {
      const row = document.createElement("div");
      row.className = "student-row";

      const roll = document.createElement("span");
      roll.className = "student-roll";
      roll.textContent = student.roll;

      const nameWrap = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = student.name;
      nameWrap.appendChild(strong);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-student";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeStudent(student.id));

      row.appendChild(roll);
      row.appendChild(nameWrap);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  function renderAttendanceTable() {
    const table = document.getElementById("attendanceTable");
    const summary = document.getElementById("activeSummary");
    const students = getStudents(state.activeClassId);
    const session = activeSession();

    table.innerHTML = "";

    if (!session) {
      summary.textContent = "Open a session above to begin marking attendance.";
      return;
    }

    const cls = activeClass();
    summary.textContent = cls.name + " \u00b7 " + session.name + " \u00b7 " + formatDate(session.date);

    if (students.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Add students to this class to start marking attendance.";
      table.appendChild(p);
      return;
    }

    const marks = getAttendance(state.activeClassId, session.id);

    students.forEach((student) => {
      const row = document.createElement("div");
      row.className = "table-row";

      const roll = document.createElement("span");
      roll.className = "student-roll";
      roll.textContent = student.roll;

      const strong = document.createElement("strong");
      strong.textContent = student.name;

      const markGroup = document.createElement("div");
      markGroup.className = "mark-group";

      const status = marks[student.id];

      const presentBtn = document.createElement("button");
      presentBtn.type = "button";
      presentBtn.className = "stamp-btn present" + (status === "present" ? " active" : "");
      presentBtn.textContent = "Present";
      presentBtn.setAttribute("aria-pressed", status === "present" ? "true" : "false");
      presentBtn.addEventListener("click", () => markStudent(student.id, "present"));

      const absentBtn = document.createElement("button");
      absentBtn.type = "button";
      absentBtn.className = "stamp-btn absent" + (status === "absent" ? " active" : "");
      absentBtn.textContent = "Absent";
      absentBtn.setAttribute("aria-pressed", status === "absent" ? "true" : "false");
      absentBtn.addEventListener("click", () => markStudent(student.id, "absent"));

      markGroup.appendChild(presentBtn);
      markGroup.appendChild(absentBtn);

      row.appendChild(roll);
      row.appendChild(strong);
      row.appendChild(markGroup);
      table.appendChild(row);
    });
  }

  function renderStats() {
    const statsEl = document.getElementById("stats");
    const students = getStudents(state.activeClassId);
    const session = activeSession();
    statsEl.innerHTML = "";

    const total = document.createElement("span");
    total.textContent = students.length + " on roll";
    statsEl.appendChild(total);

    if (session) {
      const marks = getAttendance(state.activeClassId, session.id);
      const presentCount = Object.values(marks).filter((v) => v === "present").length;
      const absentCount = Object.values(marks).filter((v) => v === "absent").length;

      const presentEl = document.createElement("span");
      presentEl.className = "present";
      presentEl.textContent = presentCount + " present";
      statsEl.appendChild(presentEl);

      const absentEl = document.createElement("span");
      absentEl.className = "absent";
      absentEl.textContent = absentCount + " absent";
      statsEl.appendChild(absentEl);

      if (students.length > 0) {
        const pct = Math.round((presentCount / students.length) * 100);
        const pctEl = document.createElement("span");
        pctEl.textContent = pct + "% turnout";
        statsEl.appendChild(pctEl);
      }
    }
  }

  // ---------- actions ----------

  function selectClass(classId) {
    state.activeClassId = classId;
    state.activeSessionId = null;
    render();
  }

  function addClass(name) {
    const cls = { id: uid(), name: name.trim() };
    data.classes.push(cls);
    data.studentsByClass[cls.id] = [];
    data.sessionsByClass[cls.id] = [];
    data.attendanceByClass[cls.id] = {};
    state.activeClassId = cls.id;
    state.activeSessionId = null;
    saveData();
    render();
  }

  function deleteClass(classId) {
    const cls = data.classes.find((c) => c.id === classId);
    if (!cls) return;
    if (!confirm('Delete "' + cls.name + '" and all its students, sessions, and attendance records?')) return;

    data.classes = data.classes.filter((c) => c.id !== classId);
    delete data.studentsByClass[classId];
    delete data.sessionsByClass[classId];
    delete data.attendanceByClass[classId];

    if (state.activeClassId === classId) {
      state.activeClassId = data.classes[0] ? data.classes[0].id : null;
      state.activeSessionId = null;
    }
    saveData();
    render();
  }

  function addSession(name, date) {
    if (!state.activeClassId) return;
    const session = { id: uid(), name: name.trim(), date };
    if (!data.sessionsByClass[state.activeClassId]) data.sessionsByClass[state.activeClassId] = [];
    data.sessionsByClass[state.activeClassId].push(session);
    state.activeSessionId = session.id;
    saveData();
    render();
  }

  function addStudent(name, roll) {
    if (!state.activeClassId) return;
    const student = { id: uid(), name: name.trim(), roll: roll.trim() };
    if (!data.studentsByClass[state.activeClassId]) data.studentsByClass[state.activeClassId] = [];
    data.studentsByClass[state.activeClassId].push(student);
    saveData();
    render();
  }

  function removeStudent(studentId) {
    const classId = state.activeClassId;
    data.studentsByClass[classId] = getStudents(classId).filter((s) => s.id !== studentId);
    Object.values(data.attendanceByClass[classId] || {}).forEach((sessionMarks) => {
      delete sessionMarks[studentId];
    });
    saveData();
    render();
  }

  function markStudent(studentId, status) {
    if (!state.activeSessionId) return;
    setAttendance(state.activeClassId, state.activeSessionId, studentId, status);
    saveData();
    renderAttendanceTable();
    renderStats();
  }

  function exportCsv() {
    const cls = activeClass();
    const session = activeSession();
    if (!cls || !session) {
      alert("Open a session before exporting.");
      return;
    }
    const students = getStudents(cls.id);
    const marks = getAttendance(cls.id, session.id);

    const rows = [["Student number", "Student name", "Status"]];
    students.forEach((s) => {
      const status = marks[s.id] || "unmarked";
      rows.push([s.roll, s.name, status]);
    });

    const csv = rows
      .map((r) => r.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeClass = cls.name.replace(/[^a-z0-9]+/gi, "-");
    const safeSession = session.name.replace(/[^a-z0-9]+/gi, "-");
    a.href = url;
    a.download = safeClass + "_" + safeSession + "_attendance.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- event wiring ----------

  document.getElementById("classForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("classNameInput");
    if (!input.value.trim()) return;
    addClass(input.value);
    input.value = "";
  });

  document.getElementById("sessionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("sessionNameInput");
    const dateInput = document.getElementById("sessionDateInput");
    if (!nameInput.value.trim() || !dateInput.value) return;
    addSession(nameInput.value, dateInput.value);
    nameInput.value = "";
    dateInput.value = "";
  });

  document.getElementById("studentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("studentNameInput");
    const rollInput = document.getElementById("studentRollInput");
    if (!nameInput.value.trim() || !rollInput.value.trim()) return;
    addStudent(nameInput.value, rollInput.value);
    nameInput.value = "";
    rollInput.value = "";
  });

  document.getElementById("sessionSelect").addEventListener("change", (e) => {
    state.activeSessionId = e.target.value;
    renderAttendanceTable();
    renderStats();
  });

  document.getElementById("exportBtn").addEventListener("click", exportCsv);

  // default today's date in the session date field
  const dateField = document.getElementById("sessionDateInput");
  if (dateField) dateField.value = new Date().toISOString().slice(0, 10);

  render();
})();
