(() => {
  const DATA_URL = "/data/security_coding_challenges.json";
  const STORAGE_KEY = "security-coding-lab-v1";
  const WORKER_URL = "/security-coding-worker.js?v=2";
  const RUN_TIMEOUT_MS = 8000;

  const els = {
    courseButton: document.querySelector("#securityViewCourse"),
    codingButton: document.querySelector("#securityViewCoding"),
    courseView: document.querySelector("#securityCourseContent"),
    codingView: document.querySelector("#securityCodingView"),
    shell: document.querySelector(".security-shell"),
    list: document.querySelector("#securityCodingList"),
    progress: document.querySelector("#securityCodingProgress"),
    company: document.querySelector("#securityCodingCompany"),
    title: document.querySelector("#securityCodingTitle"),
    meta: document.querySelector("#securityCodingMeta"),
    prompt: document.querySelector("#securityCodingPrompt"),
    why: document.querySelector("#securityCodingWhy"),
    constraints: document.querySelector("#securityCodingConstraints"),
    example: document.querySelector("#securityCodingExample"),
    source: document.querySelector("#securityCodingSource"),
    sourceNote: document.querySelector("#securityCodingSourceNote"),
    editor: document.querySelector("#securityCodingEditor"),
    hint: document.querySelector("#securityCodingHint"),
    hintButton: document.querySelector("#securityCodingHintButton"),
    resetButton: document.querySelector("#securityCodingReset"),
    runButton: document.querySelector("#securityCodingRun"),
    submitButton: document.querySelector("#securityCodingSubmit"),
    result: document.querySelector("#securityCodingResult"),
  };

  if (!els.codingView) return;

  const state = { loaded: false, challenges: [], selected: 0, running: false, worker: null };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function emptyProgress() {
    return { version: 1, selected: "", solved: {}, code: {} };
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed?.version === 1 ? parsed : emptyProgress();
    } catch {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function currentChallenge() {
    return state.challenges[state.selected];
  }

  function stashCode() {
    const challenge = currentChallenge();
    if (!challenge) return;
    const progress = loadProgress();
    progress.code[challenge.id] = els.editor.value;
    progress.selected = challenge.id;
    saveProgress(progress);
  }

  function renderList() {
    const progress = loadProgress();
    const solved = Object.keys(progress.solved).filter((id) => progress.solved[id]).length;
    els.progress.innerHTML = `<strong>${solved}/${state.challenges.length}</strong><span>accepted</span>`;
    els.list.innerHTML = state.challenges
      .map(
        (challenge, index) => `
          <button type="button" class="security-coding-item ${index === state.selected ? "active" : ""} ${progress.solved[challenge.id] ? "solved" : ""}" data-security-coding-index="${index}" ${state.running ? "disabled" : ""}>
            <span>${progress.solved[challenge.id] ? "Accepted" : challenge.difficulty}</span>
            <strong>${escapeHtml(challenge.title)}</strong>
            <small>${escapeHtml(challenge.company)} · ${challenge.minutes} min</small>
          </button>
        `,
      )
      .join("");
  }

  function renderChallenge() {
    const challenge = currentChallenge();
    if (!challenge) return;
    const progress = loadProgress();
    progress.selected = challenge.id;
    saveProgress(progress);

    els.company.textContent = `${challenge.company} · ${challenge.role}`;
    els.title.textContent = challenge.title;
    els.meta.textContent = `${challenge.difficulty} · ${challenge.minutes} minutes · ${challenge.evidence_level}`;
    els.prompt.innerHTML = `<code>${escapeHtml(challenge.signature)}</code><p>${escapeHtml(challenge.prompt)}</p>`;
    els.why.textContent = challenge.why;
    els.constraints.innerHTML = challenge.constraints.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    const visible = challenge.visible_tests[0];
    els.example.textContent = `Input\n${JSON.stringify(visible.args, null, 2)}\n\nExpected\n${JSON.stringify(visible.expected, null, 2)}`;
    els.source.href = challenge.source_url;
    els.source.textContent = challenge.source_title;
    els.sourceNote.textContent = `${challenge.evidence_level}. ${challenge.source_note}`;
    els.editor.value = progress.code[challenge.id] ?? challenge.starter_code;
    els.hint.textContent = "Try the visible case first. The hint stays hidden until requested.";
    els.hint.dataset.revealed = "false";
    els.result.className = "security-coding-result";
    els.result.textContent = "Run checks the visible example. Submit grades the full interview case set.";
    renderList();
  }

  function showMode(mode) {
    const coding = mode === "coding";
    els.courseButton.classList.toggle("active", !coding);
    els.codingButton.classList.toggle("active", coding);
    els.courseView.hidden = coding;
    els.codingView.hidden = !coding;
    els.shell.classList.toggle("coding-mode", coding);
    window.history.replaceState(null, "", coding ? "#security/coding" : `#security/${window.SecurityAcademy?.selectedId?.() || "learning-system"}`);
  }

  function setRunning(running, label = "") {
    state.running = running;
    els.runButton.disabled = running;
    els.submitButton.disabled = running;
    if (state.loaded) renderList();
    if (running) {
      els.result.className = "security-coding-result running";
      els.result.textContent = label;
    }
  }

  function runInWorker(challenge, tests) {
    return new Promise((resolve, reject) => {
      if (!state.worker) state.worker = new Worker(WORKER_URL, { type: "module" });
      const worker = state.worker;
      const requestId = `${Date.now()}-${Math.random()}`;
      const timer = window.setTimeout(() => {
        worker.terminate();
        state.worker = null;
        reject(new Error(`Execution exceeded ${RUN_TIMEOUT_MS / 1000} seconds.`));
      }, RUN_TIMEOUT_MS);
      worker.onmessage = (event) => {
        if (event.data.requestId !== requestId) return;
        window.clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        if (!event.data.ok) reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      worker.onerror = (event) => {
        window.clearTimeout(timer);
        worker.terminate();
        state.worker = null;
        reject(new Error(event.message || "Python worker failed to load."));
      };
      worker.postMessage({ requestId, code: els.editor.value, entryFunction: challenge.entry_function, tests });
    });
  }

  function renderResult(result, submitted) {
    if (result.fatal) {
      els.result.className = "security-coding-result fail";
      els.result.innerHTML = `<strong>Runtime Error</strong><pre>${escapeHtml(result.fatal)}</pre>`;
      return false;
    }
    const passed = result.details.filter((detail) => detail.passed).length;
    const accepted = passed === result.details.length;
    els.result.className = `security-coding-result ${accepted ? "pass" : "fail"}`;
    els.result.innerHTML = `
      <div><strong>${accepted ? (submitted ? "Accepted" : "Visible case passed") : "Wrong Answer"}</strong><span>${passed}/${result.details.length} cases passed</span></div>
      ${result.details
        .map(
          (detail, index) => `
            <details ${detail.passed ? "" : "open"}>
              <summary>${detail.passed ? "Pass" : "Fail"} · Case ${index + 1}: ${escapeHtml(detail.name)}</summary>
              ${detail.error ? `<pre>${escapeHtml(detail.error)}</pre>` : ""}
              ${detail.passed ? "" : `<pre>Expected:\n${escapeHtml(JSON.stringify(detail.expected, null, 2))}\n\nReceived:\n${escapeHtml(JSON.stringify(detail.actual, null, 2))}</pre>`}
              ${detail.stdout ? `<pre>Printed output:\n${escapeHtml(detail.stdout)}</pre>` : ""}
            </details>
          `,
        )
        .join("")}
    `;
    return accepted;
  }

  async function grade(submitted) {
    if (state.running) return;
    const challenge = currentChallenge();
    stashCode();
    setRunning(true, "Loading the browser Python runtime and running cases...");
    try {
      const tests = submitted ? [...challenge.visible_tests, ...challenge.hidden_tests] : challenge.visible_tests;
      const result = await runInWorker(challenge, tests);
      const accepted = renderResult(result, submitted);
      if (submitted && accepted) {
        const progress = loadProgress();
        progress.solved[challenge.id] = true;
        saveProgress(progress);
        renderList();
      }
    } catch (error) {
      els.result.className = "security-coding-result fail";
      els.result.innerHTML = `<strong>Runner Error</strong><pre>${escapeHtml(error.message)}</pre>`;
    } finally {
      setRunning(false);
    }
  }

  async function start() {
    if (state.loaded) return;
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
    const payload = await response.json();
    if (payload.challenges.length < 8) throw new Error("Security coding challenge bank is incomplete.");
    state.challenges = payload.challenges;
    const selectedId = loadProgress().selected;
    const selectedIndex = state.challenges.findIndex((challenge) => challenge.id === selectedId);
    state.selected = selectedIndex >= 0 ? selectedIndex : 0;
    state.loaded = true;
    renderChallenge();
    if (window.location.hash === "#security/coding") showMode("coding");
  }

  els.courseButton.addEventListener("click", () => showMode("course"));
  els.codingButton.addEventListener("click", () => showMode("coding"));
  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-security-coding-index]");
    if (!button || state.running) return;
    stashCode();
    state.selected = Number(button.dataset.securityCodingIndex);
    renderChallenge();
  });
  els.editor.addEventListener("input", stashCode);
  els.editor.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = els.editor.selectionStart;
      const end = els.editor.selectionEnd;
      els.editor.setRangeText("    ", start, end, "end");
      stashCode();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      grade(event.shiftKey);
    }
  });
  els.hintButton.addEventListener("click", () => {
    const challenge = currentChallenge();
    const revealed = els.hint.dataset.revealed === "true";
    els.hint.textContent = revealed ? "Try the visible case first. The hint stays hidden until requested." : challenge.hint;
    els.hint.dataset.revealed = String(!revealed);
  });
  els.resetButton.addEventListener("click", () => {
    const challenge = currentChallenge();
    const progress = loadProgress();
    delete progress.code[challenge.id];
    saveProgress(progress);
    els.editor.value = challenge.starter_code;
    stashCode();
  });
  els.runButton.addEventListener("click", () => grade(false));
  els.submitButton.addEventListener("click", () => grade(true));
  window.addEventListener("beforeunload", () => state.worker?.terminate());

  window.SecurityCodingLab = { showMode, start };
})();
