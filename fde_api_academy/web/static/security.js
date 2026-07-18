(() => {
  const COURSE_URL = "/data/security_course.json";
  const NOTES_URL = "/data/security_notes.md";
  const PROGRESS_KEY = "security-academy-progress-v2";
  const standalone = document.body.dataset.academy === "security";

  const els = {
    securityNav: document.querySelector("#securityModuleNav"),
    securityProgress: document.querySelector("#securityProgress"),
    securityReadiness: document.querySelector("#securityReadiness"),
    securitySearch: document.querySelector("#securitySearch"),
    securityTitle: document.querySelector("#securityTitle"),
    securityIntro: document.querySelector("#securityIntro"),
    securityModuleStatus: document.querySelector("#securityModuleStatus"),
    securityObjectives: document.querySelector("#securityObjectives"),
    securityLearn: document.querySelector("#securityLearn"),
    securityLab: document.querySelector("#securityLab"),
    securityInterview: document.querySelector("#securityInterview"),
    securityAssessment: document.querySelector("#securityAssessment"),
    securitySource: document.querySelector("#securitySource"),
    securityPrevious: document.querySelector("#securityPrevious"),
    securityNext: document.querySelector("#securityNext"),
    securityReset: document.querySelector("#securityReset"),
  };

  const state = {
    loaded: false,
    course: null,
    modules: [],
    selected: 0,
    search: "",
  };

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function inlineMarkdown(value) {
    return esc(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function parseNotes(markdown, sourceTitles) {
    const wanted = new Set(sourceTitles);
    const lines = markdown.split(/\r?\n/);
    const starts = [];
    lines.forEach((line, index) => {
      const match = line.match(/^#{2,3}\s+(.+)$/);
      if (match && wanted.has(match[1].trim())) {
        starts.push({ title: match[1].trim(), index });
      }
    });
    return Object.fromEntries(
      starts.map((start, index) => {
        const end = starts[index + 1]?.index ?? lines.length;
        return [start.title, lines.slice(start.index + 1, end).join("\n").trim()];
      }),
    );
  }

  function renderMarkdownBlock(markdown) {
    if (!markdown) return "";
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let listOpen = false;

    function closeList() {
      if (listOpen) html.push("</ul>");
      listOpen = false;
    }

    lines.forEach((line) => {
      if (!line.trim()) {
        closeList();
        return;
      }
      const heading = line.match(/^###\s+(.+)$/);
      if (heading) {
        closeList();
        html.push(`<h4>${inlineMarkdown(heading[1])}</h4>`);
        return;
      }
      const bullet = line.match(/^\s*-\s+(.+)$/);
      if (bullet) {
        if (!listOpen) html.push('<ul class="security-list">');
        listOpen = true;
        html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
        return;
      }
      closeList();
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    });
    closeList();
    return html.join("");
  }

  function emptyProgress() {
    return { version: 2, selected: "", modules: {} };
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (!parsed || parsed.version !== 2 || typeof parsed.modules !== "object") return emptyProgress();
      return parsed;
    } catch {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function moduleProgress(moduleId, progress = loadProgress()) {
    return progress.modules[moduleId] || {
      answers: [],
      attempts: 0,
      quizScore: 0,
      quizPassed: false,
      labComplete: false,
      notes: "",
    };
  }

  function isMastered(moduleId, progress = loadProgress()) {
    const record = moduleProgress(moduleId, progress);
    return record.quizPassed && record.labComplete;
  }

  function statusFor(moduleId, progress = loadProgress()) {
    const record = moduleProgress(moduleId, progress);
    if (isMastered(moduleId, progress)) return "mastered";
    if (record.attempts || record.labComplete || record.notes) return "in-progress";
    return "not-started";
  }

  function updateRecord(moduleId, patch) {
    const progress = loadProgress();
    progress.modules[moduleId] = { ...moduleProgress(moduleId, progress), ...patch };
    progress.selected = moduleId;
    saveProgress(progress);
    return progress.modules[moduleId];
  }

  function renderProgress() {
    const progress = loadProgress();
    const mastered = state.modules.filter((module) => isMastered(module.id, progress)).length;
    const quizPassed = state.modules.filter((module) => moduleProgress(module.id, progress).quizPassed).length;
    const pct = state.modules.length ? Math.round((mastered / state.modules.length) * 100) : 0;
    els.securityProgress.innerHTML = `
      <div><strong>${pct}%</strong><span>mastery</span></div>
      <div class="security-progress-detail"><b>${mastered}/${state.modules.length}</b><span>modules mastered</span><small>${quizPassed} knowledge checks passed</small></div>
    `;

    const phaseMap = new Map();
    state.modules.forEach((module) => {
      if (!phaseMap.has(module.phase)) phaseMap.set(module.phase, []);
      phaseMap.get(module.phase).push(module);
    });
    els.securityReadiness.innerHTML = [...phaseMap.entries()]
      .map(([phase, modules]) => {
        const count = modules.filter((module) => isMastered(module.id, progress)).length;
        const phasePct = Math.round((count / modules.length) * 100);
        return `
          <div class="security-readiness-row">
            <div><span>${esc(phase)}</span><small>${count}/${modules.length}</small></div>
            <div class="security-meter"><i style="width: ${phasePct}%"></i></div>
          </div>
        `;
      })
      .join("");
  }

  function renderNav() {
    const progress = loadProgress();
    const query = state.search.trim().toLowerCase();
    let previousPhase = "";
    const html = [];
    state.modules.forEach((module, index) => {
      const searchable = [module.title, module.phase, ...module.objectives].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return;
      if (module.phase !== previousPhase) {
        html.push(`<span class="security-phase-label">${esc(module.phase)}</span>`);
        previousPhase = module.phase;
      }
      const status = statusFor(module.id, progress);
      const icon = status === "mastered" ? "✓" : status === "in-progress" ? "•" : String(index + 1).padStart(2, "0");
      html.push(`
        <button class="security-module ${index === state.selected ? "active" : ""} ${status}" data-security-module="${index}" type="button">
          <strong><span>${icon}</span>${esc(module.title)}</strong>
          <small>${module.minutes} min · ${status.replace("-", " ")}</small>
        </button>
      `);
    });
    els.securityNav.innerHTML = html.join("") || '<p class="security-empty">No matching modules.</p>';
  }

  function renderStatus(module, record) {
    const mastered = record.quizPassed && record.labComplete;
    els.securityModuleStatus.innerHTML = `
      <span class="security-status-chip ${mastered ? "complete" : ""}">${mastered ? "Mastered" : "Mastery requires both items"}</span>
      <span class="security-status-chip ${record.quizPassed ? "complete" : ""}">${record.quizPassed ? "✓" : "1"} Knowledge ${record.quizPassed ? `${record.quizScore}%` : "pending"}</span>
      <span class="security-status-chip ${record.labComplete ? "complete" : ""}">${record.labComplete ? "✓" : "2"} Lab ${record.labComplete ? "completed" : "pending"}</span>
      <span class="security-status-chip">${record.attempts} quiz attempt${record.attempts === 1 ? "" : "s"}</span>
    `;
  }

  function renderObjectives(module) {
    els.securityObjectives.innerHTML = `
      <div class="security-objectives">
        <div><span>${module.minutes} min</span><span>Intermediate</span><span>${esc(module.phase)}</span></div>
        <h4>After this module, you can</h4>
        <ul>${module.objectives.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </div>
    `;
  }

  function renderLearn(module) {
    els.securityLearn.innerHTML = `
      <div class="security-course-note">
        <h4>Why this matters</h4>
        <p>${esc(module.why)}</p>
      </div>
      <div class="security-concepts">
        ${module.concepts.map((concept) => `<section><h4>${esc(concept.title)}</h4><p>${esc(concept.body)}</p></section>`).join("")}
      </div>
      <div class="security-example"><span>Applied example</span><p>${esc(module.example)}</p></div>
      <div class="security-pitfalls"><h4>Common weak answers</h4><ul>${module.pitfalls.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
    `;
  }

  function renderLab(module, record) {
    els.securityLab.innerHTML = `
      <h4>${esc(module.lab.title)}</h4>
      <p class="security-scenario">${esc(module.lab.scenario)}</p>
      <h5>Required evidence</h5>
      <ol>${module.lab.deliverables.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
      <label class="security-notes-label" for="securityLabNotes">Working notes or artifact link</label>
      <textarea id="securityLabNotes" rows="6" placeholder="Capture assumptions, findings, pseudocode, or a local artifact path...">${esc(record.notes)}</textarea>
      <label class="security-lab-check">
        <input id="securityLabComplete" type="checkbox" ${record.labComplete ? "checked" : ""} />
        <span>I completed every deliverable and can defend the tradeoffs aloud.</span>
      </label>
      <p class="security-integrity-note">This is an honor check. Your notes remain in this browser.</p>
    `;
  }

  function renderInterview(module) {
    els.securityInterview.innerHTML = `
      <p class="security-scenario">${esc(module.interview.prompt)}</p>
      <div class="security-answer-structure">
        <span>Clarify</span><b>→</b><span>Model</span><b>→</b><span>Solve</span><b>→</b><span>Test</span><b>→</b><span>Tradeoffs</span>
      </div>
      <details>
        <summary>Strong-answer rubric</summary>
        <ul>${module.interview.rubric.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </details>
    `;
  }

  function renderAssessment(module, record, result = null) {
    const answers = result?.answers || record.answers || [];
    const resultHtml = result
      ? `<div class="security-quiz-result ${result.passed ? "pass" : "retry"}"><strong>${result.passed ? "Passed" : "Review and retry"} · ${result.score}%</strong><span>${result.correct}/${module.quiz.length} correct. Both answers are required for mastery.</span></div>`
      : record.quizPassed
        ? `<div class="security-quiz-result pass"><strong>Passed · ${record.quizScore}%</strong><span>You can retake this check at any time.</span></div>`
        : '<p class="security-test-intro">Answer every question correctly. Feedback explains the reasoning, not just the key.</p>';

    els.securityAssessment.innerHTML = `
      ${resultHtml}
      <form id="securityQuizForm">
        ${module.quiz
          .map((question, questionIndex) => {
            const feedback = result
              ? `<div class="security-question-feedback ${result.details[questionIndex].correct ? "correct" : "incorrect"}"><strong>${result.details[questionIndex].correct ? "Correct" : "Not quite"}</strong><p>${esc(question.explanation)}</p></div>`
              : "";
            return `
              <fieldset class="security-question">
                <legend>${questionIndex + 1}. ${esc(question.prompt)}</legend>
                ${question.options
                  .map(
                    (option, optionIndex) => `
                      <label>
                        <input type="radio" name="security-q-${questionIndex}" value="${optionIndex}" ${Number(answers[questionIndex]) === optionIndex ? "checked" : ""} />
                        <span>${esc(option)}</span>
                      </label>
                    `,
                  )
                  .join("")}
                ${feedback}
              </fieldset>
            `;
          })
          .join("")}
        <button class="button primary" type="submit">${record.attempts ? "Check Again" : "Submit Knowledge Check"}</button>
      </form>
    `;
  }

  function renderSource(module) {
    if (!module.source_title) {
      els.securitySource.innerHTML = '<p class="security-original-note">Academy-original module added to cover the current intermediate security-engineering bar.</p>';
      return;
    }
    els.securitySource.innerHTML = `
      <p class="security-source-context">Original notes preserved for breadth and recall. The academy lesson above supplies the current explanation and assessment.</p>
      ${renderMarkdownBlock(module.source_notes)}
    `;
  }

  function renderModule() {
    const module = state.modules[state.selected];
    if (!module) return;
    const progress = loadProgress();
    const record = moduleProgress(module.id, progress);
    progress.selected = module.id;
    saveProgress(progress);

    els.securityTitle.textContent = module.title;
    els.securityIntro.textContent = `${module.phase} · ${module.minutes} minutes · academy v${state.course.version} · source ${state.course.source_commit.slice(0, 12)}`;
    renderStatus(module, record);
    renderObjectives(module);
    renderLearn(module);
    renderLab(module, record);
    renderInterview(module);
    renderAssessment(module, record);
    renderSource(module);
    renderProgress();
    renderNav();
    els.securityPrevious.disabled = state.selected === 0;
    els.securityNext.disabled = state.selected === state.modules.length - 1;
    els.securityNext.textContent = isMastered(module.id, progress) ? "Next Module" : "Next Module";
    window.history.replaceState(null, "", `#security/${module.id}`);
  }

  async function ensureLoaded() {
    if (state.loaded) return;
    const [courseResponse, notesResponse] = await Promise.all([fetch(COURSE_URL), fetch(NOTES_URL)]);
    if (!courseResponse.ok) throw new Error(`Could not load ${COURSE_URL}`);
    if (!notesResponse.ok) throw new Error(`Could not load ${NOTES_URL}`);
    const course = await courseResponse.json();
    const notes = await notesResponse.text();
    const sourceTitles = course.modules.map((module) => module.source_title).filter(Boolean);
    const sourceNotes = parseNotes(notes, sourceTitles);

    if (course.modules.length < 20) throw new Error("Security curriculum is incomplete.");
    course.modules.forEach((module) => {
      if (module.source_title && !sourceNotes[module.source_title]) {
        throw new Error(`Missing source section: ${module.source_title}`);
      }
      if (!Array.isArray(module.quiz) || module.quiz.length < 2) {
        throw new Error(`Missing assessment questions: ${module.title}`);
      }
    });

    state.course = course;
    state.modules = course.modules.map((module) => ({
      ...module,
      source_notes: module.source_title ? sourceNotes[module.source_title] : "",
    }));
    const progress = loadProgress();
    const hashId = window.location.hash.match(/^#security\/(.+)$/)?.[1];
    const selectedId = hashId || progress.selected;
    const selectedIndex = state.modules.findIndex((module) => module.id === selectedId);
    state.selected = selectedIndex >= 0 ? selectedIndex : 0;
    state.loaded = true;
  }

  function selectModule(index) {
    if (index < 0 || index >= state.modules.length) return;
    state.selected = index;
    renderModule();
    document.querySelector(".security-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", (event) => {
    const moduleButton = event.target.closest("[data-security-module]");
    if (moduleButton) selectModule(Number(moduleButton.dataset.securityModule));
  });

  els.securitySearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderNav();
  });

  els.securityPrevious.addEventListener("click", () => selectModule(state.selected - 1));
  els.securityNext.addEventListener("click", () => selectModule(state.selected + 1));

  els.securityLab.addEventListener("input", (event) => {
    const module = state.modules[state.selected];
    if (!module) return;
    if (event.target.id === "securityLabNotes") updateRecord(module.id, { notes: event.target.value });
  });

  els.securityLab.addEventListener("change", (event) => {
    if (event.target.id !== "securityLabComplete") return;
    const module = state.modules[state.selected];
    updateRecord(module.id, { labComplete: event.target.checked });
    renderModule();
  });

  els.securityAssessment.addEventListener("submit", (event) => {
    if (event.target.id !== "securityQuizForm") return;
    event.preventDefault();
    const module = state.modules[state.selected];
    const form = new FormData(event.target);
    const answers = module.quiz.map((_, index) => {
      const value = form.get(`security-q-${index}`);
      return value === null ? null : Number(value);
    });
    if (answers.some((answer) => answer === null)) {
      const firstMissing = event.target.querySelector(`input[name="security-q-${answers.indexOf(null)}"]`);
      firstMissing?.focus();
      event.target.classList.add("needs-answers");
      return;
    }
    const details = module.quiz.map((question, index) => ({ correct: answers[index] === question.answer }));
    const correct = details.filter((item) => item.correct).length;
    const score = Math.round((correct / module.quiz.length) * 100);
    const passed = score >= state.course.pass_score;
    const current = moduleProgress(module.id);
    const record = updateRecord(module.id, {
      answers,
      attempts: current.attempts + 1,
      quizScore: Math.max(current.quizScore, score),
      quizPassed: current.quizPassed || passed,
    });
    renderAssessment(module, record, { answers, correct, score, passed, details });
    renderStatus(module, record);
    renderProgress();
    renderNav();
  });

  els.securityReset.addEventListener("click", () => {
    if (!window.confirm("Reset all Security Academy scores, lab checks, and working notes?")) return;
    saveProgress(emptyProgress());
    state.selected = 0;
    renderModule();
  });

  async function start() {
    await ensureLoaded();
    renderModule();
  }

  function showError(error) {
    els.securityLearn.innerHTML = `<p class="sd-error">${esc(error.message)}</p>`;
  }

  window.SecurityAcademy = { parseNotes, showError, slug, start };

  if (standalone) {
    start().catch(showError);
  }
})();
