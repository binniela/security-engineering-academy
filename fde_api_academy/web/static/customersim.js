// Customer Sim — forward-deployed soft-skills practice for the academy.
(() => {
  const PROGRESS_KEY = "cs-progress-v1";
  const POINTS = { strong: 2, okay: 1, weak: 0 };

  const els = {
    body: document.querySelector("#csBody"),
    footer: document.querySelector("#csFooter"),
    score: document.querySelector("#csScore"),
  };

  const state = {
    loaded: false,
    scenarios: [],
    scenarioIdx: 0,
    answers: [], // [{ optionIndex, quality }] for answered turns of current scenario
  };

  async function ensureLoaded() {
    if (state.loaded) return;
    state.scenarios = await fetch("/data/customer_scenarios.json").then((r) => r.json());
    state.loaded = true;
  }

  const esc = (v) =>
    String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  // ---- progress ----
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { totalScore: 0, attempts: {} };
    } catch {
      return { totalScore: 0, attempts: {} };
    }
  }
  function recordAttempt(id, score, maxScore) {
    const p = loadProgress();
    const prevBest = p.attempts[id]?.best ?? -Infinity;
    p.attempts[id] = { best: Math.max(prevBest, score), last: score, max: maxScore, completed: true };
    p.totalScore = Object.values(p.attempts).reduce((s, a) => s + Math.max(0, a.best), 0);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  }
  function resetProgress() {
    localStorage.removeItem(PROGRESS_KEY);
  }

  const QUALITY = {
    strong: { label: "Strong response", cls: "cs-strong" },
    okay: { label: "Workable, but weaker", cls: "cs-okay" },
    weak: { label: "Hurts trust", cls: "cs-weak" },
  };

  function render() {
    const scenario = state.scenarios[state.scenarioIdx];
    const progress = loadProgress();

    els.footer.innerHTML =
      "Practice scenarios modeling common forward-deployed / customer-facing situations. The ‘best’ answers reflect widely-taught customer-communication and consulting principles (acknowledge → clarify → set expectations → offer a path), not one company’s rubric. FDE interviews routinely include behavioral / stakeholder rounds. Content lives in <code>static/data/customer_scenarios.json</code>.";

    const picker = state.scenarios
      .map((s, i) => {
        const done = progress.attempts[s.id]?.completed ? "✓ " : "";
        return `<button class="sd-chip ${i === state.scenarioIdx ? "active" : ""}" data-cs-scenario="${i}">${done}${esc(s.title)}</button>`;
      })
      .join("");

    const tags = scenario.tags.map((t) => `<span class="sd-company">${esc(t)}</span>`).join("");

    // Conversation: render every answered turn, then the current open turn.
    const answeredCount = state.answers.length;
    let convo = "";
    for (let i = 0; i < answeredCount; i++) {
      const turn = scenario.turns[i];
      const ans = state.answers[i];
      const opt = turn.options[ans.optionIndex];
      const q = QUALITY[opt.quality];
      convo += `
        <div class="cs-turn">
          <div class="cs-bubble cs-customer"><span class="cs-who">${esc(scenario.persona.split(" — ")[0] || "Customer")}</span>${esc(turn.customer)}</div>
          <div class="cs-bubble cs-you"><span class="cs-who">You</span>${esc(opt.text)}</div>
          ${opt.reaction ? `<div class="cs-bubble cs-customer cs-reaction"><span class="cs-who">${esc(scenario.persona.split(" — ")[0] || "Customer")}</span>${esc(opt.reaction)}</div>` : ""}
          <div class="cs-verdict ${q.cls}"><strong>${q.label}.</strong> ${esc(opt.feedback)}</div>
        </div>`;
    }

    const done = answeredCount >= scenario.turns.length;
    let active = "";
    if (!done) {
      const turn = scenario.turns[answeredCount];
      const opts = turn.options
        .map((o, idx) => `<button class="cs-option" data-cs-option="${idx}">${esc(o.text)}</button>`)
        .join("");
      active = `
        <div class="cs-turn cs-active">
          <div class="cs-bubble cs-customer"><span class="cs-who">${esc(scenario.persona.split(" — ")[0] || "Customer")}</span>${esc(turn.customer)}</div>
          <p class="cs-prompt-label">How do you respond?</p>
          <div class="cs-options">${opts}</div>
        </div>`;
    }

    let summary = "";
    if (done) {
      const score = state.answers.reduce((s, a) => s + POINTS[a.quality], 0);
      const max = scenario.turns.length * POINTS.strong;
      const pct = Math.round((score / max) * 100);
      let verdict = "Needs work — review the stronger responses above.";
      let cls = "cs-weak";
      if (pct >= 85) {
        verdict = "Excellent — you kept the customer’s trust and steered the outcome.";
        cls = "cs-strong";
      } else if (pct >= 55) {
        verdict = "Solid — a few responses left trust or scope on the table.";
        cls = "cs-okay";
      }
      const principles = scenario.principles.map((p) => `<li>${esc(p)}</li>`).join("");
      summary = `
        <div class="cs-summary ${cls}">
          <div class="cs-fb-head"><strong>${verdict}</strong><span>Score ${score} / ${max} (${pct}%)</span></div>
          <p class="cs-principles-label">What strong FDEs do here:</p>
          <ul class="cs-principles">${principles}</ul>
          <button class="button" id="csRestart">Replay scenario</button>
        </div>`;
    }

    els.body.innerHTML = `
      <div class="sd-picker">${picker}</div>
      <div class="sd-scenario">
        <div class="sd-tags"><span class="sd-diff">${esc(scenario.difficulty)}</span>${tags}</div>
        <h3 class="sd-title">${esc(scenario.title)}</h3>
        <p class="cs-persona"><strong>${esc(scenario.persona)}</strong></p>
        <p class="sd-prompt">${esc(scenario.context)}</p>
      </div>
      <div class="cs-thread">${convo}${active}${summary}</div>
      <div class="sd-nav">
        <button class="button" id="csPrev">← Previous</button>
        <button class="sd-reset" id="csReset">Reset progress</button>
        <button class="button" id="csNext">Next →</button>
      </div>`;

    renderScore();
  }

  function renderScore() {
    const p = loadProgress();
    const doneCount = Object.keys(p.attempts).length;
    els.score.innerHTML = `Score <strong>${p.totalScore}</strong> · ${doneCount}/${state.scenarios.length} done`;
  }

  function gotoScenario(idx) {
    state.scenarioIdx = (idx + state.scenarios.length) % state.scenarios.length;
    state.answers = [];
    render();
  }

  els.body.addEventListener("click", (event) => {
    const opt = event.target.closest("[data-cs-option]");
    if (opt) {
      const scenario = state.scenarios[state.scenarioIdx];
      const turnIdx = state.answers.length;
      const optionIndex = Number(opt.dataset.csOption);
      const quality = scenario.turns[turnIdx].options[optionIndex].quality;
      state.answers.push({ optionIndex, quality });
      if (state.answers.length >= scenario.turns.length) {
        const score = state.answers.reduce((s, a) => s + POINTS[a.quality], 0);
        recordAttempt(scenario.id, score, scenario.turns.length * POINTS.strong);
      }
      render();
      return;
    }
    const chip = event.target.closest("[data-cs-scenario]");
    if (chip) return gotoScenario(Number(chip.dataset.csScenario));
    if (event.target.id === "csRestart") {
      state.answers = [];
      return render();
    }
    if (event.target.id === "csPrev") return gotoScenario(state.scenarioIdx - 1);
    if (event.target.id === "csNext") return gotoScenario(state.scenarioIdx + 1);
    if (event.target.id === "csReset") {
      resetProgress();
      return render();
    }
  });

  document.addEventListener("view:show", (event) => {
    if (event.detail.viewId !== "customerSimView") return;
    ensureLoaded()
      .then(render)
      .catch((e) => {
        els.body.innerHTML = `<p class="sd-error">Could not load scenarios: ${esc(e.message)}</p>`;
      });
  });
})();
