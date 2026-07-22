# JS Logic

The app uses a single render loop. When something changes an event handler updates the state saves it and calls `render()`. The `render()` function rebuilds the parts of the page that change by replacing their `innerHTML`.

There is no partial DOM updating, so the whole table is rendered again each time. This is fine for a small project but would become slow if there were thousands of students.

`activeClass()` and `activeSession()` are used to get the currently selected class and session. Everything else, such as the statistics, table and forms is based on these functions. The app only stores `state.selectedClassId` and `state.selectedSessionId` which avoids having multiple "current class" variables that could become inconsistent.

# Input Validation

There are three levels of validation:

### HTML Level

* `required` attributes prevent empty form submissions.

### JavaScript Level

* `.trim()` is used on all text inputs so values such as `"    "` are not accepted as valid names.

### Semantic Checks

* Duplicate class names and duplicate student numbers are checked before creating a record.
* Class names are checked without considering uppercase or lowercase letters.
* Student numbers are checked using exact matches because they are meant to be unique values.

# Data Storage

* `localStorage` operations are wrapped in `try/catch` blocks when reading and writing data.
* If the stored data is corrupted or missing fields `normalizeState()` loads `defaultState` and fills in any missing IDs or attendance records. This prevents manually edited or invalid data from breaking the application.
* If saving fails because of storage limits or private browsing mode the error is caught and logged instead of stopping the application.

# Interface Decisions

* Attendance uses chip-style radio buttons instead of checkboxes or a drop-down menu because attendance has three possible values: Present, Absent and Not Marked. A checkbox cannot represent all three states.
* The "Not Marked" option allows attendance to be returned to its default state if it was marked incorrectly.
* Deleting a class, session or student always shows a `confirm()` dialog because there is no undo feature and attendance records could otherwise be lost accidentally.

# State Management

The application uses one state object without any frameworks.

Changes are made directly to the state followed by calls to `saveState()` and `render()`. This approach works because there is only one place where data is changed and one function responsible for displaying it.

`ensureSelection()` makes sure that `selectedClassId` and `selectedSessionId` always point to valid records after changes have been made.

# Duplicate Prevention

* Class names are compared without considering uppercase or lowercase letters because `"CS101"` and `"cs101"` should be treated as the same class.
* Student numbers are only checked within the current class. The same student number may be valid in another class, so uniqueness is limited to `currentClass.students`.
* Student names are not checked because different students may share the same name. Student numbers are used as the unique identifier throughout the application.

# Attendance Calculation

Attendance is stored as:

`session.attendance[studentId] = "P" | "A" | ""`

Attendance records are linked to student IDs rather than their position in an array. This means removing or reordering students will not affect existing attendance records.

The number of marked students is calculated using:

`Object.values(attendance).filter(Boolean).length`

This counts every attendance value that is not an empty string.

`attendanceLabel()` converts `"P"`, `"A"` and `""` into `"Present"`, `"Absent"` and `"Not Marked"` so that both the attendance table and CSV exports use the same labels.
