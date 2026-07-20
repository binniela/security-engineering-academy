(() => {
  const COURSE_URL = "/data/security_course.json";
  const NOTES_URL = "/data/security_notes.md";
  const INTERVIEW_BANK_URL = "/data/security_interview_bank.json";
  const ORAL_BOARD_URL = "/data/security_oral_boards.json";
  const PROGRESS_KEY = "security-academy-progress-v4";
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
    return { version: 4, selected: "", modules: {} };
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (!parsed || parsed.version !== 4 || typeof parsed.modules !== "object") return emptyProgress();
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
      oralAnswer: "",
      oralPassed: false,
      reviewOpen: false,
      rubricChecks: [],
      attempts: 0,
    };
  }

  function isMastered(moduleId, progress = loadProgress()) {
    return moduleProgress(moduleId, progress).oralPassed;
  }

  function statusFor(moduleId, progress = loadProgress()) {
    const record = moduleProgress(moduleId, progress);
    if (isMastered(moduleId, progress)) return "mastered";
    if (record.attempts) return "in-progress";
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
    const oralPassed = state.modules.filter((module) => moduleProgress(module.id, progress).oralPassed).length;
    const pct = state.modules.length ? Math.round((mastered / state.modules.length) * 100) : 0;
    els.securityProgress.innerHTML = `
      <div><strong>${pct}%</strong><span>mastery</span></div>
      <div class="security-progress-detail"><b>${mastered}/${state.modules.length}</b><span>modules mastered</span><small>${oralPassed} oral boards reviewed</small></div>
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
    const mastered = record.oralPassed;
    els.securityModuleStatus.innerHTML = `
      <span class="security-status-chip ${mastered ? "complete" : ""}">${mastered ? "Mastered" : "Oral board pending"}</span>
      <span class="security-status-chip ${record.reviewOpen ? "complete" : ""}">${record.reviewOpen ? "✓" : "1"} Written response</span>
      <span class="security-status-chip">${record.attempts} review${record.attempts === 1 ? "" : "s"}</span>
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

  function sourceLinks(sourceIds) {
    return (sourceIds || [])
      .map((sourceId) => state.course.sources[sourceId])
      .filter((source) => source && /^https:\/\//.test(source.url))
      .map(
        (source) =>
          `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.label)} <small>${esc(source.kind)}</small></a>`,
      )
      .join("");
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
      <div class="security-deep-dive">
        <h4>Interview depth</h4>
        ${module.deep_dive
          .map(
            (section) => `
              <section>
                <h5>${esc(section.title)}</h5>
                <p>${esc(section.body)}</p>
                <div class="security-source-links compact">${sourceLinks(section.sources)}</div>
              </section>
            `,
          )
          .join("")}
      </div>
      <div class="security-example"><span>Applied example</span><p>${esc(module.example)}</p></div>
      <div class="security-pitfalls"><h4>Common weak answers</h4><ul>${module.pitfalls.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>
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

  function wordCount(value) {
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }

  function renderAssessment(module, record, message = "") {
    const board = module.oral_board;
    const words = wordCount(record.oralAnswer || "");
    const minimum = state.course.oral_minimum_words;
    const checks = board.rubric.map((_, index) => Boolean(record.rubricChecks?.[index]));
    els.securityAssessment.innerHTML = `
      ${record.oralPassed ? '<div class="security-quiz-result pass"><strong>Oral board reviewed</strong><span>Your answer met the full self-review bar. Rework it whenever you can make the reasoning tighter.</span></div>' : ""}
      ${message ? `<div class="security-oral-message">${esc(message)}</div>` : ""}
      <div class="security-oral-heading">
        <span>${esc(board.frequency)} interview area</span>
        <strong>No answer choices</strong>
      </div>
      <p class="security-oral-prompt">${esc(board.prompt)}</p>
      <div class="security-oral-probes">
        <h4>Interviewer follow-ups</h4>
        <ol>${board.probes.map((probe) => `<li>${esc(probe)}</li>`).join("")}</ol>
      </div>
      <form id="securityOralForm">
        <label class="security-oral-answer">
          <span>Your interview answer</span>
          <textarea id="securityOralAnswer" name="oral-answer" spellcheck="true">${esc(record.oralAnswer || "")}</textarea>
          <small>${words} words · ${minimum} required before review</small>
        </label>
        <div class="security-question-sources"><span>Scenario basis</span><div class="security-source-links">${sourceLinks(board.sources)}</div></div>
        <button class="button primary" type="submit">${record.reviewOpen ? "Review Again" : "Review Against the Bar"}</button>
      </form>
      ${record.reviewOpen ? `
        <div class="security-oral-review">
          <h4>Strong-answer bar</h4>
          <p>Check an item only when your written answer addresses it explicitly enough to survive a follow-up.</p>
          ${board.rubric
            .map(
              (item, index) => `
                <label>
                  <input type="checkbox" data-security-rubric="${index}" ${checks[index] ? "checked" : ""} />
                  <span>${esc(item)}</span>
                </label>
              `,
            )
            .join("")}
          <button class="button primary" id="securityCompleteReview" type="button">Complete Self-Review</button>
        </div>
      ` : ""}
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
    renderInterview(module);
    renderAssessment(module, record);
    renderSource(module);
    renderProgress();
    renderNav();
    els.securityPrevious.disabled = state.selected === 0;
    els.securityNext.disabled = state.selected === state.modules.length - 1;
    els.securityNext.textContent = isMastered(module.id, progress) ? "Next Module" : "Next Module";
    if (!document.querySelector(".security-shell")?.classList.contains("coding-mode")) {
      window.history.replaceState(null, "", `#security/${module.id}`);
    }
  }

  async function ensureLoaded() {
    if (state.loaded) return;
    const [courseResponse, notesResponse, interviewBankResponse, oralBoardResponse] = await Promise.all([
      fetch(COURSE_URL),
      fetch(NOTES_URL),
      fetch(INTERVIEW_BANK_URL),
      fetch(ORAL_BOARD_URL),
    ]);
    if (!courseResponse.ok) throw new Error(`Could not load ${COURSE_URL}`);
    if (!notesResponse.ok) throw new Error(`Could not load ${NOTES_URL}`);
    if (!interviewBankResponse.ok) throw new Error(`Could not load ${INTERVIEW_BANK_URL}`);
    if (!oralBoardResponse.ok) throw new Error(`Could not load ${ORAL_BOARD_URL}`);
    const course = await courseResponse.json();
    const notes = await notesResponse.text();
    const interviewBank = await interviewBankResponse.json();
    const oralBoardBank = await oralBoardResponse.json();
    const sourceTitles = course.modules.map((module) => module.source_title).filter(Boolean);
    const sourceNotes = parseNotes(notes, sourceTitles);

    if (course.modules.length < 20) throw new Error("Security curriculum is incomplete.");
    course.sources = interviewBank.sources;
    course.oral_minimum_words = oralBoardBank.minimum_words;
    course.modules = course.modules.map((module) => {
      const moduleBank = interviewBank.modules[module.id];
      if (!moduleBank) throw new Error(`Missing interview bank: ${module.title}`);
      if (module.source_title && !sourceNotes[module.source_title]) {
        throw new Error(`Missing source section: ${module.source_title}`);
      }
      const quiz = [
        ...module.quiz.map((question) => ({ ...question, sources: question.sources || moduleBank.default_sources })),
        ...moduleBank.questions,
      ];
      if (quiz.length < 5) {
        throw new Error(`Missing assessment questions: ${module.title}`);
      }
      [...quiz, ...moduleBank.deep_dive].forEach((item) => {
        if (!item.sources?.length || item.sources.some((sourceId) => !course.sources[sourceId])) {
          throw new Error(`Missing source attribution: ${module.title}`);
        }
      });
      const roleSpecific = new Set(["exploitation", "malware-analysis", "digital-forensics", "security-projects"]);
      const oralBoard = oralBoardBank.modules[module.id] || {
        frequency: roleSpecific.has(module.id) ? "Role-specific" : "Common",
        prompt: module.interview.prompt,
        probes: [
          "Clarify the system, assets, actors, constraints, and what a secure outcome means.",
          `Walk the relevant ${module.title.toLowerCase()} flow end to end and name the trust boundaries.`,
          "Prioritize plausible attack or failure paths and state the precondition and impact of each.",
          "Design preventive, detective, containment, and recovery controls that fail independently.",
          `Defend your tradeoffs, tests, telemetry, and response to this follow-up: ${module.interview.rubric.at(-1)}`,
        ],
        rubric: [
          ...module.interview.rubric,
          "States concrete telemetry, tests, and incident-response pivots.",
          "Explains tradeoffs, residual risk, and what evidence would change the decision.",
        ],
        sources: moduleBank.default_sources,
      };
      if (oralBoard.probes.length !== 5 || oralBoard.rubric.length < 6) {
        throw new Error(`Incomplete oral board: ${module.title}`);
      }
      if (oralBoard.sources.some((sourceId) => !course.sources[sourceId])) {
        throw new Error(`Missing oral board source: ${module.title}`);
      }
      return { ...module, quiz, deep_dive: moduleBank.deep_dive, oral_board: oralBoard };
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
    window.SecurityCodingLab?.showMode("course");
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

  els.securityAssessment.addEventListener("submit", (event) => {
    if (event.target.id !== "securityOralForm") return;
    event.preventDefault();
    const module = state.modules[state.selected];
    const answer = String(new FormData(event.target).get("oral-answer") || "").trim();
    const current = moduleProgress(module.id);
    if (wordCount(answer) < state.course.oral_minimum_words) {
      const record = updateRecord(module.id, { oralAnswer: answer });
      renderAssessment(module, record, `Develop the answer to at least ${state.course.oral_minimum_words} words before opening the review bar.`);
      document.querySelector("#securityOralAnswer")?.focus();
      return;
    }
    const record = updateRecord(module.id, {
      oralAnswer: answer,
      reviewOpen: true,
      attempts: current.attempts + 1,
    });
    renderAssessment(module, record);
    renderStatus(module, record);
    renderProgress();
    renderNav();
  });

  els.securityAssessment.addEventListener("input", (event) => {
    if (event.target.id !== "securityOralAnswer") return;
    const module = state.modules[state.selected];
    updateRecord(module.id, { oralAnswer: event.target.value });
    const counter = event.target.parentElement.querySelector("small");
    if (counter) counter.textContent = `${wordCount(event.target.value)} words · ${state.course.oral_minimum_words} required before review`;
  });

  els.securityAssessment.addEventListener("change", (event) => {
    if (!event.target.matches("[data-security-rubric]")) return;
    const module = state.modules[state.selected];
    const checks = module.oral_board.rubric.map((_, index) =>
      Boolean(els.securityAssessment.querySelector(`[data-security-rubric="${index}"]`)?.checked),
    );
    updateRecord(module.id, { rubricChecks: checks });
  });

  els.securityAssessment.addEventListener("click", (event) => {
    if (event.target.id !== "securityCompleteReview") return;
    const module = state.modules[state.selected];
    const current = moduleProgress(module.id);
    const checks = module.oral_board.rubric.map((_, index) =>
      Boolean(els.securityAssessment.querySelector(`[data-security-rubric="${index}"]`)?.checked),
    );
    if (wordCount(current.oralAnswer) < state.course.oral_minimum_words || checks.some((checked) => !checked)) {
      const record = updateRecord(module.id, { rubricChecks: checks });
      renderAssessment(module, record, "The review is not complete. Strengthen the answer until every bar item is explicit, then reassess it honestly.");
      return;
    }
    const record = updateRecord(module.id, { oralPassed: true, reviewOpen: true, rubricChecks: checks });
    renderAssessment(module, record);
    renderStatus(module, record);
    renderProgress();
    renderNav();
  });

  els.securityReset.addEventListener("click", () => {
    if (!window.confirm("Reset all Security Academy scores and attempts?")) return;
    saveProgress(emptyProgress());
    state.selected = 0;
    renderModule();
  });

  async function start() {
    await Promise.all([ensureLoaded(), window.SecurityCodingLab?.start()]);
    renderModule();
  }

  function showError(error) {
    els.securityLearn.innerHTML = `<p class="sd-error">${esc(error.message)}</p>`;
  }

  window.SecurityAcademy = { parseNotes, selectedId: () => state.modules[state.selected]?.id, showError, slug, start };

  if (standalone) {
    start().catch(showError);
  }
})();
