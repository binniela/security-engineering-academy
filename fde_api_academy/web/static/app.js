const state = {
  selectedLessonId: null,
  lesson: null,
};

const els = {
  lessonNav: document.querySelector("#lessonNav"),
  statsGrid: document.querySelector("#statsGrid"),
  completionValue: document.querySelector("#completionValue"),
  skillBars: document.querySelector("#skillBars"),
  lessonMeta: document.querySelector("#lessonMeta"),
  lessonTitle: document.querySelector("#lessonTitle"),
  lessonStatus: document.querySelector("#lessonStatus"),
  lessonExplanation: document.querySelector("#lessonExplanation"),
  lessonVisual: document.querySelector("#lessonVisual"),
  exampleCode: document.querySelector("#exampleCode"),
  guidedTitle: document.querySelector("#guidedTitle"),
  guidedPrompt: document.querySelector("#guidedPrompt"),
  challengeTitle: document.querySelector("#challengeTitle"),
  challengePrompt: document.querySelector("#challengePrompt"),
  validationResult: document.querySelector("#validationResult"),
  mentorLabel: document.querySelector("#mentorLabel"),
  mentorHint: document.querySelector("#mentorHint"),
  starterPath: document.querySelector("#starterPath"),
  codeEditor: document.querySelector("#codeEditor"),
  codeResult: document.querySelector("#codeResult"),
  codePromptTitle: document.querySelector("#codePromptTitle"),
  codePromptText: document.querySelector("#codePromptText"),
  codeExample: document.querySelector("#codeExample"),
  codeExpected: document.querySelector("#codeExpected"),
  codeDrills: document.querySelector("#codeDrills"),
  activeSourceLink: document.querySelector("#activeSourceLink"),
  activeSourceNote: document.querySelector("#activeSourceNote"),
  codeMentorLabel: document.querySelector("#codeMentorLabel"),
  codeMentorHint: document.querySelector("#codeMentorHint"),
  codeHintButton: document.querySelector("#codeHintButton"),
  saveCode: document.querySelector("#saveCode"),
  runCode: document.querySelector("#runCode"),
  submitCode: document.querySelector("#submitCode"),
  editGuided: document.querySelector("#editGuided"),
  editChallenge: document.querySelector("#editChallenge"),
  reflectionList: document.querySelector("#reflectionList"),
  refreshButton: document.querySelector("#refreshButton"),
  mentorButton: document.querySelector("#mentorButton"),
  validateGuided: document.querySelector("#validateGuided"),
  validateChallenge: document.querySelector("#validateChallenge"),
  viewLeetcode: document.querySelector("#viewLeetcode"),
};

let editingChallenge = false;
let activeDrillId = null;

// Per-context editor contents so switching between guided/challenge/drills
// keeps whatever the user typed instead of clobbering it.
const codeBuffers = {};
let activeContextKey = null;

function contextKey(kind, id = "") {
  const lessonId = state.lesson ? state.lesson.id : "?";
  return `${lessonId}::${kind}::${id}`;
}

function stashCurrentCode() {
  if (activeContextKey !== null) {
    codeBuffers[activeContextKey] = els.codeEditor.value;
  }
}

function loadEditorFor(key, defaultCode) {
  activeContextKey = key;
  els.codeEditor.value = key in codeBuffers ? codeBuffers[key] : defaultCode;
}

function scaffoldForDrill(drill) {
  const fnName =
    drill.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "solve_drill";
  const wrapped = drill.prompt.match(/.{1,72}(\s+|$)/g) || [drill.prompt];
  const comment = wrapped.map((line) => `    # ${line.trim()}`).join("\n");
  return `def ${fnName}(records):\n${comment}\n    # TODO: implement this drill, then test it with your own sample data.\n    pass\n`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function titleCase(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusSymbol(status) {
  if (status === "completed") return "✓";
  if (status === "unlocked") return "→";
  return "•";
}

function expectedForExercise(exercise) {
  const expectations = {
    validate_user_summary:
      "{'total': 3, 'active': 2, 'emails': ['ada@example.com', 'grace@example.com', 'kj@example.com']}",
    validate_extract_contacts:
      "[{'name': 'Ada', 'email': 'ada@example.com', 'phone': '555-0100'}, {'name': 'Linus', 'email': 'linus@example.com', 'phone': None}]",
    validate_json_transform:
      "{'total_repos': 3, 'total_stars': 16, 'top_repo': 'api-tool', 'languages': {'Python': 2, 'TypeScript': 1}}",
    validate_status_classifier:
      "200 -> success, 401 -> auth_error, 429 -> rate_limited, 500 -> server_error",
    validate_github_profile:
      "{'username': 'octocat', 'display_name': 'The Octocat', 'total_stars': 212, 'most_starred_repo': 'Spoon-Knife', ...}",
    validate_sqlite_store:
      "A repositories table where SELECT language, sum(stars) returns [('Python', 15)]",
  };
  return expectations[exercise.validator] || "Pass the lesson validator shown by this exercise.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitExpectedGot(message) {
  if (!message) return null;
  // Drill grader: "Case X/Y failed: <call>\n  expected: <e>\n  got:      <g>"
  const drill = message.match(/^(Case \d+\/\d+ failed:[^\n]*)\n\s*expected:\s*([\s\S]*?)\n\s*got:\s*([\s\S]*)$/);
  if (drill) {
    return { caseLine: drill[1].trim(), expected: drill[2].trim(), actual: drill[3].trim() };
  }
  // Legacy lesson validators: "Expected <e>, got <g>"
  const marker = ", got ";
  if (message.startsWith("Expected ") && message.includes(marker)) {
    const body = message.slice("Expected ".length);
    const index = body.lastIndexOf(marker);
    return { caseLine: null, expected: body.slice(0, index), actual: body.slice(index + marker.length) };
  }
  return null;
}

function stdoutPanel(stdout) {
  if (!stdout) {
    return "";
  }
  return `
    <section class="stdout-panel">
      <span>Printed output</span>
      <pre>${escapeHtml(stdout)}</pre>
    </section>
  `;
}

function renderCodeResult({ passed, title, message, stdout }) {
  const status = passed ? "pass" : "fail";
  const heading = passed ? "Accepted" : "Wrong Answer";
  const split = splitExpectedGot(message || "");
  els.codeResult.className = `result-box show ${status}`;
  if (passed) {
    els.codeResult.innerHTML = `
      <div class="result-header"><strong>${heading}</strong><span>${escapeHtml(title)}</span></div>
      ${stdoutPanel(stdout)}
    `;
    return;
  }
  if (split) {
    const caseLine = split.caseLine
      ? `<p class="result-caseline">${escapeHtml(split.caseLine)}</p>`
      : "";
    els.codeResult.innerHTML = `
      <div class="result-header"><strong>${heading}</strong><span>${escapeHtml(title)}</span></div>
      ${caseLine}
      <div class="result-grid">
        <section class="expected"><span>Expected</span><pre>${escapeHtml(split.expected)}</pre></section>
        <section class="got"><span>Your output</span><pre>${escapeHtml(split.actual)}</pre></section>
      </div>
      ${stdoutPanel(stdout)}
    `;
    return;
  }
  els.codeResult.innerHTML = `
    <div class="result-header"><strong>${heading}</strong><span>${escapeHtml(title)}</span></div>
    <pre>${escapeHtml(message)}</pre>
    ${stdoutPanel(stdout)}
  `;
}

function renderPracticeDrills(lesson) {
  const drills = lesson.practice_drills || [];
  if (drills.length === 0) {
    els.codeDrills.innerHTML = '<p class="empty-drills">No extra drills for this lesson yet.</p>';
    return;
  }
  els.codeDrills.innerHTML = drills
    .map(
      (drill) => `
        <button class="drill-card ${drill.id === activeDrillId ? "active" : ""}" data-drill-id="${escapeHtml(drill.id)}">
          <h5>${escapeHtml(drill.title)}</h5>
          <p>${escapeHtml(drill.prompt)}</p>
          <span class="drill-source">${escapeHtml(drill.source_title)}</span>
          <small>${escapeHtml(drill.verification_note)}</small>
        </button>
      `,
    )
    .join("");
  document.querySelectorAll("[data-drill-id]").forEach((button) => {
    button.addEventListener("click", () => selectPracticeDrill(button.dataset.drillId));
  });
}

function selectPracticeDrill(drillId) {
  const drill = (state.lesson.practice_drills || []).find((item) => item.id === drillId);
  if (!drill) return;
  activeDrillId = drill.id;
  els.editGuided.classList.remove("active");
  els.editChallenge.classList.remove("active");
  els.codePromptTitle.textContent = drill.title;
  els.codePromptText.textContent = drill.prompt;
  els.codeExample.textContent = drill.example || "";
  els.codeExpected.textContent = drill.expected || "Press Run to grade your solution against the hidden test cases.";
  els.activeSourceLink.href = drill.source_url;
  els.activeSourceLink.textContent = drill.source_title;
  els.activeSourceNote.textContent = drill.verification_note;
  stashCurrentCode();
  loadEditorFor(contextKey("drill", drill.id), drill.starter_code || scaffoldForDrill(drill));
  els.starterPath.textContent = drill.absolute_path || `${drill.title} · drill`;
  els.codeResult.className = "result-box";
  els.codeResult.textContent = "";
  renderPracticeDrills(state.lesson);
}

function renderStats(stats) {
  if (els.completionValue) {
    els.completionValue.textContent = `${stats.completion_percent}%`;
  }
  if (els.statsGrid) {
    const cards = [
      ["Accuracy", `${stats.accuracy_percent}%`],
      ["Time Spent", `${stats.time_spent_minutes}m`],
      ["Lessons", `${stats.lessons_completed}/${stats.total_lessons}`],
      ["Projects", stats.projects_completed],
    ];
    els.statsGrid.innerHTML = cards
      .map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`)
      .join("");
  }
  if (els.skillBars) {
    const maxPoints = Math.max(8, ...Object.values(stats.skill_points));
    els.skillBars.innerHTML = Object.entries(stats.skill_points)
      .map(([skill, points]) => {
        const width = Math.min(100, Math.round((points / maxPoints) * 100));
        return `
          <div class="skill-row">
            <header><span>${titleCase(skill)}</span><span>${points}</span></header>
            <div class="bar"><div class="bar-fill" style="width: ${width}%"></div></div>
          </div>
        `;
      })
      .join("");
  }
}

function renderNav(modules) {
  els.lessonNav.innerHTML = modules
    .flatMap((module) =>
      module.lessons.map((lesson) => {
        const active = lesson.id === state.selectedLessonId ? "active" : "";
        return `
          <button class="lesson-item ${lesson.status} ${active}" data-lesson-id="${lesson.id}" ${lesson.status === "locked" ? "disabled" : ""}>
            <strong>${statusSymbol(lesson.status)} ${lesson.title}</strong>
            <small>Module ${module.id} · ${lesson.difficulty}</small>
          </button>
        `;
      }),
    )
    .join("");

  document.querySelectorAll("[data-lesson-id]").forEach((button) => {
    button.addEventListener("click", () => loadLesson(button.dataset.lessonId));
  });
}

function renderLesson(lesson) {
  state.lesson = lesson;
  state.selectedLessonId = lesson.id;
  activeDrillId = null;
  els.lessonMeta.textContent = `Module ${lesson.module} · ${lesson.difficulty} · ${lesson.estimated_minutes} min`;
  els.lessonTitle.textContent = lesson.title;
  els.lessonStatus.textContent = lesson.status;
  els.lessonStatus.className = `status-pill ${lesson.status}`;
  els.lessonExplanation.textContent = lesson.explanation;
  els.lessonVisual.textContent = lesson.visual;
  els.exampleCode.textContent = lesson.example_code;
  els.guidedTitle.textContent = lesson.guided_exercise.title;
  els.guidedPrompt.textContent = lesson.guided_exercise.prompt;
  els.challengeTitle.textContent = lesson.challenge_exercise.title;
  els.challengePrompt.textContent = lesson.challenge_exercise.prompt;
  renderPracticeDrills(lesson);
  editingChallenge = false;
  setEditorMode(false);
  els.reflectionList.innerHTML = lesson.reflection_questions.map((question) => `<li>${question}</li>`).join("");
  els.mentorLabel.textContent = "Hint ladder";
  els.mentorHint.textContent = "Ask for a hint when you are stuck. The first one is intentionally gentle.";
  els.validationResult.className = "result-box";
  els.validationResult.textContent = "";
}

function setEditorMode(challenge) {
  editingChallenge = challenge;
  activeDrillId = null;
  const exercise = challenge ? state.lesson.challenge_exercise : state.lesson.guided_exercise;
  els.editGuided.classList.toggle("active", !challenge);
  els.editChallenge.classList.toggle("active", challenge);
  els.codePromptTitle.textContent = exercise.title;
  els.codePromptText.textContent = exercise.prompt;
  els.codeExample.textContent = state.lesson.example_code;
  els.codeExpected.textContent = expectedForExercise(exercise);
  els.activeSourceLink.href = "#";
  els.activeSourceLink.textContent = "Current lesson validator";
  els.activeSourceNote.textContent = "Guided/challenge validator built into FDE API Academy.";
  renderPracticeDrills(state.lesson);
  els.starterPath.textContent = exercise.absolute_path;
  stashCurrentCode();
  loadEditorFor(contextKey(challenge ? "challenge" : "guided"), exercise.starter_code);
  els.codeMentorLabel.textContent = "Mentor";
  els.codeMentorHint.textContent = "Need a nudge? Ask for a hint without leaving this workspace.";
  els.codeResult.className = "result-box";
  els.codeResult.textContent = "";
}

async function loadState(preferredLessonId = null) {
  const academy = await api("/api/state");
  const lessons = academy.modules.flatMap((module) => module.lessons);
  const firstAvailable = lessons.find((lesson) => lesson.status !== "locked") || lessons[0];
  const selected = preferredLessonId || state.selectedLessonId || firstAvailable.id;
  state.selectedLessonId = selected;
  renderStats(academy.dashboard);
  renderNav(academy.modules);
  await loadLesson(selected, false);
}

async function loadLesson(lessonId, refreshNav = true) {
  const lesson = await api(`/api/lesson/${lessonId}`);
  renderLesson(lesson);
  if (refreshNav) {
    const academy = await api("/api/state");
    renderStats(academy.dashboard);
    renderNav(academy.modules);
  }
}

function activateCodeTab() {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector('[data-tab="code"]').classList.add("active");
  document.querySelector("#codeTab").classList.add("active");
}

async function openLeetcodeDrill() {
  await loadLesson("m09-auth-env");
  activateCodeTab();
  selectPracticeDrill("m09-drill-4");
}

async function validate(challenge) {
  if (!state.lesson) return;
  els.validationResult.className = "result-box show";
  els.validationResult.textContent = "Running validator...";
  const result = await api(`/api/validate/${state.lesson.id}`, {
    method: "POST",
    body: JSON.stringify({ challenge, minutes: challenge ? 30 : 15 }),
  });
  els.validationResult.className = `result-box show ${result.passed ? "pass" : "fail"}`;
  els.validationResult.textContent = result.passed ? `Passed: ${result.exercise}` : `Not yet: ${result.message}`;
  renderStats(result.dashboard);
  const academy = await api("/api/state");
  renderNav(academy.modules);
  state.lesson.status = result.status;
  els.lessonStatus.textContent = result.status;
  els.lessonStatus.className = `status-pill ${result.status}`;
}

function activeDrill() {
  if (!activeDrillId || !state.lesson) return null;
  return (state.lesson.practice_drills || []).find((item) => item.id === activeDrillId) || null;
}

async function saveCurrentCode() {
  if (!state.lesson) return;
  const drill = activeDrill();
  try {
    els.codeResult.className = "result-box show";
    els.codeResult.textContent = "Saving...";
    if (drill) {
      const result = await api(`/api/save-drill/${state.lesson.id}`, {
        method: "POST",
        body: JSON.stringify({ drill_id: drill.id, code: els.codeEditor.value }),
      });
      drill.starter_code = els.codeEditor.value;
      els.codeResult.className = "result-box show pass";
      els.codeResult.textContent = `Saved ${result.path}`;
      return;
    }
    const result = await api(`/api/save/${state.lesson.id}`, {
      method: "POST",
      body: JSON.stringify({ challenge: editingChallenge, code: els.codeEditor.value }),
    });
    const exercise = editingChallenge ? state.lesson.challenge_exercise : state.lesson.guided_exercise;
    exercise.starter_code = els.codeEditor.value;
    els.codeResult.className = "result-box show pass";
    els.codeResult.textContent = `Saved ${result.path}`;
  } catch (error) {
    els.codeResult.className = "result-box show fail";
    els.codeResult.textContent = error.message;
  }
}

async function runCurrentCode() {
  if (!state.lesson) return;
  const drill = activeDrill();
  els.runCode.disabled = true;
  try {
    els.codeResult.className = "result-box show";
    els.codeResult.textContent = "Running...";
    if (drill) {
      await api(`/api/save-drill/${state.lesson.id}`, {
        method: "POST",
        body: JSON.stringify({ drill_id: drill.id, code: els.codeEditor.value }),
      });
      const result = await api(`/api/validate-drill/${state.lesson.id}`, {
        method: "POST",
        body: JSON.stringify({ drill_id: drill.id, minutes: 10 }),
      });
      drill.starter_code = els.codeEditor.value;
      renderCodeResult({ passed: result.passed, title: result.exercise, message: result.message, stdout: result.stdout });
      renderStats(result.dashboard);
      return;
    }
    await api(`/api/save/${state.lesson.id}`, {
      method: "POST",
      body: JSON.stringify({ challenge: editingChallenge, code: els.codeEditor.value }),
    });
    const result = await api(`/api/validate/${state.lesson.id}`, {
      method: "POST",
      body: JSON.stringify({ challenge: editingChallenge, minutes: editingChallenge ? 30 : 15 }),
    });
    const exercise = editingChallenge ? state.lesson.challenge_exercise : state.lesson.guided_exercise;
    exercise.starter_code = els.codeEditor.value;
    renderCodeResult({ passed: result.passed, title: result.exercise, message: result.message, stdout: result.stdout });
    renderStats(result.dashboard);
    const academy = await api("/api/state");
    renderNav(academy.modules);
    state.lesson.status = result.status;
    els.lessonStatus.textContent = result.status;
    els.lessonStatus.className = `status-pill ${result.status}`;
  } catch (error) {
    els.codeResult.className = "result-box show fail";
    els.codeResult.innerHTML = `
      <div class="result-header"><strong>Runtime Error</strong></div>
      <pre>${escapeHtml(error.message)}</pre>
    `;
  } finally {
    els.runCode.disabled = false;
  }
}

async function mentor() {
  if (!state.lesson) return;
  const result = await api(`/api/mentor/${state.lesson.id}`, { method: "POST", body: "{}" });
  els.mentorLabel.textContent = result.label;
  els.mentorHint.textContent = result.hint;
  els.codeMentorLabel.textContent = result.label;
  els.codeMentorHint.textContent = result.hint;
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}Tab`).classList.add("active");
  });
});

els.refreshButton.addEventListener("click", () => loadState());
els.validateGuided.addEventListener("click", () => validate(false));
els.validateChallenge.addEventListener("click", () => validate(true));
if (els.viewLeetcode) {
  els.viewLeetcode.addEventListener("click", openLeetcodeDrill);
}
els.mentorButton.addEventListener("click", mentor);
els.saveCode.addEventListener("click", saveCurrentCode);
els.runCode.addEventListener("click", runCurrentCode);
els.submitCode.addEventListener("click", runCurrentCode);
els.editGuided.addEventListener("click", () => setEditorMode(false));
els.editChallenge.addEventListener("click", () => setEditorMode(true));
els.codeHintButton.addEventListener("click", mentor);

els.codeEditor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = els.codeEditor.selectionStart;
    const end = els.codeEditor.selectionEnd;
    els.codeEditor.value = `${els.codeEditor.value.slice(0, start)}    ${els.codeEditor.value.slice(end)}`;
    els.codeEditor.selectionStart = els.codeEditor.selectionEnd = start + 4;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const start = els.codeEditor.selectionStart;
    const end = els.codeEditor.selectionEnd;
    const beforeCursor = els.codeEditor.value.slice(0, start);
    const afterCursor = els.codeEditor.value.slice(end);
    const currentLine = beforeCursor.slice(beforeCursor.lastIndexOf("\n") + 1);
    const indent = currentLine.match(/^\s*/)[0];
    const extraIndent = currentLine.trimEnd().endsWith(":") ? "    " : "";
    const insertion = `\n${indent}${extraIndent}`;
    els.codeEditor.value = `${beforeCursor}${insertion}${afterCursor}`;
    els.codeEditor.selectionStart = els.codeEditor.selectionEnd = start + insertion.length;
  }
});

loadState().catch((error) => {
  document.body.innerHTML = `<main class="app"><h1>FDE API Academy</h1><p>${error.message}</p></main>`;
});
