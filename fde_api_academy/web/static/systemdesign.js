// System Design — two topics for the academy:
//   * Distributed Systems (component cards)
//   * Schema Design / SQL (relational-modeling cards + reference schemas)
// Same card-picking engine, including the over/under-engineering signal.
(() => {
  const PROGRESS_KEY = "sdc-progress-v1";
  const POINTS = { optimal: 2, acceptable: 1, poor: -1 };

  const TOPICS = {
    distributed: { label: "Distributed Systems", cards: "/data/sd_cards.json", scenarios: "/data/sd_scenarios.json" },
    schema: { label: "Schema Design", cards: "/data/sd_schema_cards.json", scenarios: "/data/sd_schema_scenarios.json" },
  };

  const els = {
    topicDistributed: document.querySelector("#sdTopicDistributed"),
    topicSchema: document.querySelector("#sdTopicSchema"),
    modePractice: document.querySelector("#sdModePractice"),
    modeStudy: document.querySelector("#sdModeStudy"),
    body: document.querySelector("#sdBody"),
    footer: document.querySelector("#sdFooter"),
    score: document.querySelector("#sdScore"),
  };

  const state = { topic: "distributed", mode: "practice", decks: {} };

  // ---- data ----------------------------------------------------------------
  async function ensureDeck(topic) {
    if (state.decks[topic]) return state.decks[topic];
    const cfg = TOPICS[topic];
    const [cards, scenarios] = await Promise.all([
      fetch(cfg.cards).then((r) => r.json()),
      fetch(cfg.scenarios).then((r) => r.json()),
    ]);
    state.decks[topic] = {
      cards,
      scenarios,
      byId: Object.fromEntries(cards.map((c) => [c.id, c])),
      categories: [...new Set(cards.map((c) => c.category))].sort(),
      idx: 0,
      selected: new Set(),
      result: null,
      studyFilter: "All",
    };
    return state.decks[topic];
  }
  const deck = () => state.decks[state.topic];

  // ---- logic ---------------------------------------------------------------
  function verdictFor(scenario, id) {
    if (scenario.best.includes(id)) return "optimal";
    if (scenario.acceptable.includes(id)) return "acceptable";
    return "poor";
  }
  function relationFor(scenario, id) {
    if (scenario.notes && scenario.notes[id]) return scenario.notes[id];
    const card = deck().byId[id];
    return `Not part of the expected design for this scenario. ${card ? card.whenNotToUse : ""}`.trim();
  }
  function seededShuffle(arr, seedStr) {
    const out = [...arr];
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function buildHand(scenario, distractorCount = 3) {
    // Always include the core cards PLUS a few poor distractors, so there's a
    // real chance to over-engineer (pick something that doesn't belong).
    const core = [...scenario.best, ...scenario.acceptable];
    const distractors = deck().cards.map((c) => c.id).filter((id) => !core.includes(id));
    const fill = seededShuffle(distractors, scenario.id).slice(0, distractorCount);
    return seededShuffle([...core, ...fill], scenario.id + "-hand");
  }
  function scoreSelection(scenario, ids) {
    let score = 0;
    ids.forEach((id) => (score += POINTS[verdictFor(scenario, id)]));
    const foundOptimal = scenario.best.filter((id) => ids.includes(id));
    const missedOptimal = scenario.best.filter((id) => !ids.includes(id));
    const pickedPoor = ids.filter((id) => verdictFor(scenario, id) === "poor");
    const half = Math.ceil(scenario.best.length / 2);
    const over = pickedPoor.length >= 2 ? "strong" : pickedPoor.length === 1 ? "mild" : null;
    const under = missedOptimal.length >= half ? "strong" : missedOptimal.length >= 1 ? "mild" : null;
    return { score, maxScore: scenario.best.length * POINTS.optimal, selectedCount: ids.length, foundOptimal, missedOptimal, pickedPoor, over, under };
  }

  // ---- progress ------------------------------------------------------------
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || { totalScore: 0, attempts: {} };
    } catch {
      return { totalScore: 0, attempts: {} };
    }
  }
  function recordAttempt(scenarioId, result) {
    const p = loadProgress();
    const prevBest = p.attempts[scenarioId]?.best ?? -Infinity;
    p.attempts[scenarioId] = { best: Math.max(prevBest, result.score), last: result.score, max: result.maxScore, completed: true };
    p.totalScore = Object.values(p.attempts).reduce((s, a) => s + (a.best > 0 ? a.best : 0), 0);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return p;
  }
  function resetProgress() {
    localStorage.removeItem(PROGRESS_KEY);
    return loadProgress();
  }

  // ---- helpers -------------------------------------------------------------
  const esc = (v) =>
    String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function cardMarkup(card, { selected = false, verdict = null, relation = null, graded = false, pickable = true } = {}) {
    const stateClass = graded && verdict ? `sd-${verdict}` : selected ? "sd-selected" : "";
    const badge = graded && verdict
      ? `<span class="sd-badge sd-badge-${verdict}">${{ optimal: "Optimal", acceptable: "Acceptable", poor: "Poor fit" }[verdict]}</span>`
      : selected
        ? `<span class="sd-badge sd-badge-pick">Picked</span>`
        : "";
    const pickBtn = pickable
      ? `<button class="sd-btn sd-pick" data-pick="${card.id}" ${graded ? "disabled" : ""}>${selected ? "Unpick" : "Pick"}</button>`
      : "";
    const relationBlock = relation
      ? `<div class="sd-relation ${verdict ? `sd-${verdict}` : ""}"><strong>In this scenario:</strong> ${esc(relation)}</div>`
      : "";
    return `
      <div class="sd-card ${stateClass}" data-card="${card.id}">
        <div class="sd-card-inner">
          <div class="sd-face sd-front">
            <div class="sd-card-top"><span class="sd-cat">${esc(card.category)}</span>${badge}</div>
            <h4>${esc(card.name)}</h4>
            <p class="sd-def">${esc(card.definition)}</p>
            <div class="sd-card-actions">
              <button class="sd-btn sd-flip" data-flip="${card.id}">Flip ↻</button>
              ${pickBtn}
            </div>
          </div>
          <div class="sd-face sd-back">
            <div class="sd-card-top"><h4>${esc(card.name)}</h4><button class="sd-btn-link sd-flip" data-flip="${card.id}">← back</button></div>
            <p class="sd-def">${esc(card.definition)}</p>
            <div class="sd-pc">
              <div><span class="sd-pros">Pros</span><ul>${card.pros.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
              <div><span class="sd-cons">Cons</span><ul>${card.cons.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
            </div>
            <p class="sd-when"><strong>Use when:</strong> ${esc(card.whenToUse)}</p>
            <p class="sd-when"><strong>Avoid when:</strong> ${esc(card.whenNotToUse)}</p>
            ${relationBlock}
          </div>
        </div>
      </div>`;
  }

  function solutionMarkup(scenario, open) {
    if (!scenario.solution) return "";
    const tables = scenario.solution.tables
      .map(
        (t) => `
        <div class="sd-table">
          <div class="sd-table-name">${esc(t.name)}</div>
          <ul>${t.columns.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
          ${t.note ? `<p class="sd-table-note">${esc(t.note)}</p>` : ""}
        </div>`,
      )
      .join("");
    const notes = scenario.solution.notes ? `<p class="sd-sol-notes">${esc(scenario.solution.notes)}</p>` : "";
    return `
      <details class="sd-solution" ${open ? "open" : ""}>
        <summary>Model schema (reference answer)</summary>
        <div class="sd-tables">${tables}</div>
        ${notes}
      </details>`;
  }

  // ---- practice render -----------------------------------------------------
  function renderPractice() {
    const d = deck();
    const scenario = d.scenarios[d.idx];
    const progress = loadProgress();
    const hand = buildHand(scenario);
    const result = d.result;

    const picker = d.scenarios
      .map((s, i) => {
        const done = progress.attempts[s.id]?.completed ? "✓ " : "";
        const label = s.title.replace(/^(Schema: |Design (a |an )?)/, "");
        return `<button class="sd-chip ${i === d.idx ? "active" : ""}" data-scenario="${i}">${done}${esc(label)}</button>`;
      })
      .join("");

    const companies = (scenario.companies || []).map((c) => `<span class="sd-company">Asked at ${esc(c)}</span>`).join("");
    const tags = (scenario.tags || []).map((t) => `<span class="sd-tag">${esc(t)}</span>`).join("");
    const sources = (scenario.sources || [])
      .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label)}</a></li>`)
      .join("");

    const handMarkup = hand
      .map((id) => {
        const selected = d.selected.has(id);
        const verdict = result ? verdictFor(scenario, id) : null;
        const relation = result || selected ? relationFor(scenario, id) : null;
        return cardMarkup(d.byId[id], { selected, verdict, relation, graded: !!result });
      })
      .join("");

    const action = result
      ? `<button class="button sd-retry" id="sdRetry">Try again</button>`
      : `<button class="button primary" id="sdSubmit" ${d.selected.size === 0 ? "disabled" : ""}>Submit answer</button>`;

    els.body.innerHTML = `
      <div class="sd-picker">${picker}</div>
      <div class="sd-scenario">
        <div class="sd-tags-row"><span class="sd-diff">${esc(scenario.difficulty)}</span>${companies}${tags}</div>
        <h3 class="sd-title">${esc(scenario.title)}</h3>
        <p class="sd-prompt">${esc(scenario.prompt)}</p>
        ${solutionMarkup(scenario, false)}
        <details class="sd-sources"><summary>Sources</summary><ul>${sources}</ul></details>
      </div>
      <div class="sd-actionbar">
        <p class="sd-hint">Pick the components that best fit. Flip any card to read its tradeoffs first. <span id="sdCount">(${d.selected.size} picked)</span></p>
        ${action}
      </div>
      <div id="sdFeedback">${result ? feedbackMarkup(scenario, result) : ""}</div>
      <div class="sd-hand">${handMarkup}</div>
      <div class="sd-nav">
        <button class="button" id="sdPrev">← Previous</button>
        <button class="sd-reset" id="sdReset">Reset progress</button>
        <button class="button" id="sdNext">Next →</button>
      </div>`;
    renderScore();
  }

  function feedbackMarkup(scenario, result) {
    const pct = result.maxScore > 0 ? Math.round((Math.max(0, result.score) / result.maxScore) * 100) : 0;
    let cls = "sd-fb-poor";
    let text = "Needs work — review the tradeoffs below.";
    if (result.missedOptimal.length === 0 && result.pickedPoor.length === 0) {
      cls = "sd-fb-good";
      text = "Excellent — that's the textbook design.";
    } else if (result.foundOptimal.length >= Math.ceil(scenario.best.length / 2) && result.pickedPoor.length <= 1) {
      cls = "sd-fb-ok";
      text = "Solid — on the right track with a few gaps.";
    }

    const nameList = (ids) => ids.map((id) => esc(deck().byId[id].name)).join(", ");
    const missed = result.missedOptimal.length ? `<p><strong>Missed optimal:</strong> ${nameList(result.missedOptimal)}</p>` : "";
    const poor = result.pickedPoor.length ? `<p><strong>Unnecessary picks:</strong> ${nameList(result.pickedPoor)}</p>` : "";

    const overWord = state.topic === "schema" ? "Over-engineering / over-normalizing" : "Over-engineering";
    const underWord = state.topic === "schema" ? "Under-engineering / under-normalizing" : "Under-engineering";
    let banners = "";
    if (result.over) {
      const msg =
        result.over === "strong"
          ? `You added components that don't solve this problem (${nameList(result.pickedPoor)}). Reaching for extra structure before it's needed reads as not knowing when to keep it simple.`
          : `You added a component this design doesn't need (${nameList(result.pickedPoor)}). Be ready to justify every choice — unneeded complexity is a red flag.`;
      banners += `<div class="sd-eng sd-eng-over"><span>⚠ ${overWord}</span><p>${msg}</p></div>`;
    }
    if (result.under) {
      const msg =
        result.under === "strong"
          ? `You're missing core pieces the design needs to be correct (${nameList(result.missedOptimal)}). It wouldn't hold up to the requirements.`
          : `Close, but a key piece is missing (${nameList(result.missedOptimal)}). Interviewers probe the gap you left.`;
      banners += `<div class="sd-eng sd-eng-under"><span>▽ ${underWord}</span><p>${msg}</p></div>`;
    }
    if (!result.over && !result.under) {
      banners += `<div class="sd-eng sd-eng-right"><span>✓ Right-sized</span><p>Every choice earns its place and nothing critical is missing — exactly the judgment interviewers look for.</p></div>`;
    }

    return `
      <div class="sd-feedback ${cls}">
        <div class="sd-fb-head">
          <strong>${text}</strong>
          <span>Score ${result.score} / ${result.maxScore} · found ${result.foundOptimal.length}/${scenario.best.length} optimal · ${result.selectedCount} picked (${pct}%)</span>
        </div>
        ${banners}
        <p><strong>Key idea:</strong> ${esc(scenario.keyIdea)}</p>
        ${missed}${poor}
        ${solutionMarkup(scenario, true)}
      </div>`;
  }

  // ---- study render --------------------------------------------------------
  function renderStudy() {
    const d = deck();
    const cats = ["All", ...d.categories];
    const chips = cats
      .map((c) => `<button class="sd-chip ${d.studyFilter === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
    const shown = d.studyFilter === "All" ? d.cards : d.cards.filter((c) => c.category === d.studyFilter);
    const grid = shown.map((card) => cardMarkup(card, { pickable: false })).join("");
    const blurb =
      state.topic === "schema"
        ? "Browse the relational-modeling deck — keys, relationships, normalization, integrity, indexing, and patterns. Flip a card for definition, pros, cons, and when (not) to use it."
        : "Browse the full deck and learn each component on its own. Flip a card for definition, pros, cons, and when (not) to use it.";
    els.body.innerHTML = `
      <div class="sd-scenario">
        <h3 class="sd-title">Study mode — ${esc(TOPICS[state.topic].label)}</h3>
        <p class="sd-prompt">${blurb}</p>
      </div>
      <div class="sd-picker">${chips}</div>
      <div class="sd-hand">${grid}</div>`;
    renderScore();
  }

  function renderScore() {
    const p = loadProgress();
    const ids = new Set(deck().scenarios.map((s) => s.id));
    const done = Object.keys(p.attempts).filter((id) => ids.has(id)).length;
    els.score.innerHTML = `Score <strong>${p.totalScore}</strong> · ${done}/${deck().scenarios.length} ${TOPICS[state.topic].label.toLowerCase()} done`;
  }

  function render() {
    els.footer.innerHTML =
      state.topic === "schema"
        ? "Schema-design scenarios are standard relational data-modeling exercises drawn from reputable study sources (Hello Interview, Red-Gate, GeeksforGeeks, DataCamp, InterviewQuery), each linked per scenario. They reflect everyday relational design principles — normalization, keys, relationships, constraints, indexing — not one company’s rubric. Content lives in <code>static/data/sd_schema_*.json</code>."
        : "Scenarios are modeled on questions <em>reported by candidates</em> via public interview-prep write-ups (IGotAnOffer/Glassdoor analyses, DesignGurus, Educative, LeetCode, System Design Handbook). Company tags reflect where each question has been reported — candidate reports, not official statements. Each scenario links its sources. Content lives in <code>static/data/sd_*.json</code>.";
    if (state.mode === "practice") renderPractice();
    else renderStudy();
  }

  // ---- events --------------------------------------------------------------
  function switchTopic(topic) {
    state.topic = topic;
    els.topicDistributed.classList.toggle("active", topic === "distributed");
    els.topicSchema.classList.toggle("active", topic === "schema");
    ensureDeck(topic)
      .then(render)
      .catch((e) => (els.body.innerHTML = `<p class="sd-error">Could not load deck: ${esc(e.message)}</p>`));
  }

  els.topicDistributed.addEventListener("click", () => switchTopic("distributed"));
  els.topicSchema.addEventListener("click", () => switchTopic("schema"));
  els.modePractice.addEventListener("click", () => {
    state.mode = "practice";
    els.modePractice.classList.add("active");
    els.modeStudy.classList.remove("active");
    render();
  });
  els.modeStudy.addEventListener("click", () => {
    state.mode = "study";
    els.modeStudy.classList.add("active");
    els.modePractice.classList.remove("active");
    render();
  });

  els.body.addEventListener("click", (event) => {
    const d = deck();
    const flip = event.target.closest("[data-flip]");
    if (flip) {
      const card = els.body.querySelector(`.sd-card[data-card="${CSS.escape(flip.dataset.flip)}"]`);
      if (card) card.classList.toggle("flipped");
      return;
    }
    const pick = event.target.closest("[data-pick]");
    if (pick && !pick.disabled) {
      const id = pick.dataset.pick;
      d.selected.has(id) ? d.selected.delete(id) : d.selected.add(id);
      updatePickedUI(id);
      return;
    }
    const chip = event.target.closest("[data-scenario]");
    if (chip) {
      d.idx = Number(chip.dataset.scenario);
      d.selected = new Set();
      d.result = null;
      render();
      return;
    }
    const cat = event.target.closest("[data-cat]");
    if (cat) {
      d.studyFilter = cat.dataset.cat;
      render();
      return;
    }
    if (event.target.id === "sdSubmit") {
      const scenario = d.scenarios[d.idx];
      d.result = scoreSelection(scenario, [...d.selected]);
      recordAttempt(scenario.id, d.result);
      render();
      return;
    }
    if (event.target.id === "sdRetry") {
      d.selected = new Set();
      d.result = null;
      render();
      return;
    }
    if (event.target.id === "sdPrev") {
      d.idx = (d.idx - 1 + d.scenarios.length) % d.scenarios.length;
      d.selected = new Set();
      d.result = null;
      render();
      return;
    }
    if (event.target.id === "sdNext") {
      d.idx = (d.idx + 1) % d.scenarios.length;
      d.selected = new Set();
      d.result = null;
      render();
      return;
    }
    if (event.target.id === "sdReset") {
      resetProgress();
      render();
      return;
    }
  });

  function updatePickedUI(id) {
    const d = deck();
    const card = els.body.querySelector(`.sd-card[data-card="${CSS.escape(id)}"]`);
    const selected = d.selected.has(id);
    if (card) {
      card.classList.toggle("sd-selected", selected);
      const top = card.querySelector(".sd-front .sd-card-top");
      let badge = top.querySelector(".sd-badge");
      if (selected && !badge) top.insertAdjacentHTML("beforeend", '<span class="sd-badge sd-badge-pick">Picked</span>');
      if (!selected && badge) badge.remove();
      const pickBtn = card.querySelector(".sd-pick");
      if (pickBtn) pickBtn.textContent = selected ? "Unpick" : "Pick";
    }
    const count = els.body.querySelector("#sdCount");
    if (count) count.textContent = `(${d.selected.size} picked)`;
    const submit = els.body.querySelector("#sdSubmit");
    if (submit) submit.disabled = d.selected.size === 0;
  }

  // A shared switcher (views.js) fires this when a top-level view is shown.
  document.addEventListener("view:show", (event) => {
    if (event.detail.viewId !== "systemDesignView") return;
    ensureDeck(state.topic)
      .then(render)
      .catch((e) => {
        els.body.innerHTML = `<p class="sd-error">Could not load deck: ${esc(e.message)}</p>`;
      });
  });
})();
