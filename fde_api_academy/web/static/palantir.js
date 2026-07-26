(() => {
  const DATA_URL = "/data/palantir_academy.json";
  const PROGRESS_KEY = "palantir-academy-progress-v1";

  const state = {
    data: null,
    selected: "behavioral",
  };

  const els = {
    view: document.querySelector("#palantirAcademyView"),
    nav: document.querySelector("#palantirStageNav"),
    progress: document.querySelector("#palantirProgress"),
    title: document.querySelector("#palantirStageTitle"),
    meta: document.querySelector("#palantirStageMeta"),
    content: document.querySelector("#palantirContent"),
    role: document.querySelector("#palantirRoleBrief"),
    previous: document.querySelector("#palantirPrevious"),
    next: document.querySelector("#palantirNext"),
    reset: document.querySelector("#palantirReset"),
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadProgress() {
    try {
      const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      return progress?.version === 1 && progress.completed ? progress : { version: 1, completed: {} };
    } catch {
      return { version: 1, completed: {} };
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function taskId(stage, item) {
    return `${stage}:${item}`;
  }

  function isComplete(stage, item) {
    return Boolean(loadProgress().completed[taskId(stage, item)]);
  }

  function taskCheckbox(stage, item, label) {
    const id = taskId(stage, item);
    return `
      <label class="palantir-task">
        <input type="checkbox" data-palantir-task="${esc(id)}" ${isComplete(stage, item) ? "checked" : ""} />
        <span>${esc(label)}</span>
      </label>
    `;
  }

  function sourceLinks(sourceIds) {
    return sourceIds
      .map((id) => {
        const source = state.data.sources[id];
        if (!source) return "";
        if (!source.url) {
          return `<span class="palantir-source-note"><strong>${esc(source.title)}</strong><span>${esc(source.kind)}</span><small>${esc(source.note)}</small></span>`;
        }
        return `<a href="${esc(source.url)}" target="_blank" rel="noreferrer"><strong>${esc(source.title)}</strong><span>${esc(source.kind)}</span></a>`;
      })
      .join("");
  }

  function sourceBlock(sourceIds, label = "Evidence") {
    return `<div class="palantir-sources"><span>${esc(label)}</span><div>${sourceLinks(sourceIds)}</div></div>`;
  }

  function renderProgress() {
    const progress = loadProgress();
    const total = els.view.querySelectorAll("[data-palantir-task]").length;
    const stageIds = state.data.loop.map((stage) => `${stage.id}:`);
    const completed = Object.keys(progress.completed).filter((id) => progress.completed[id] && stageIds.some((prefix) => id.startsWith(prefix))).length;
    const visibleComplete = [...els.view.querySelectorAll("[data-palantir-task]:checked")].length;
    const count = Math.max(completed, visibleComplete);
    els.progress.innerHTML = `<strong>${count}</strong><span>practice items completed</span><small>Progress is stored in this browser</small>`;

    document.querySelectorAll("[data-palantir-stage]").forEach((button) => {
      const prefix = `${button.dataset.palantirStage}:`;
      const stageCount = Object.entries(progress.completed).filter(([id, done]) => done && id.startsWith(prefix)).length;
      const counter = button.querySelector("small");
      if (counter) counter.textContent = stageCount ? `${stageCount} complete` : "not started";
    });
    if (!total) return;
  }

  function renderRoleBrief() {
    const role = state.data.role;
    els.role.innerHTML = `
      <div><span>Target role</span><strong>${esc(role.position)}</strong><small>${esc(role.product)} · ${esc(role.location_note)}</small></div>
      <div class="palantir-stack">${role.stack.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      <details><summary>What the role actually rewards</summary><p>${esc(role.mission)}</p><ul>${role.signals.map((signal) => `<li>${esc(signal)}</li>`).join("")}</ul>${sourceBlock(["official-role"], "Official role source")}</details>
    `;
  }

  function renderBehavioral() {
    const section = state.data.behavioral;
    const resume = section.resume_profile;
    return `
      <section class="palantir-lead">
        <p>${esc(section.intro)}</p>
        <aside class="palantir-recent-signal"><strong>Fresh recruiter signal</strong><p>${esc(section.recent_signal)}</p>${sourceBlock(["discord-local"], "User-supplied source")}</aside>
        <div class="palantir-answer-model">
          <h4>Answer model</h4>
          <ol>${section.answer_framework.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>
        </div>
      </section>
      <section class="palantir-section-head"><div><span>Personalized from your resume</span><h4>Your Palantir narrative</h4></div><p>Use this as a thesis, not a memorized script. Every claim still needs your real details.</p></section>
      <section class="palantir-resume-thesis">
        <div><strong>Positioning</strong><p>${esc(resume.positioning)}</p></div>
        <blockquote><span>Working role thesis</span><p>${esc(resume.role_thesis)}</p></blockquote>
        <aside><strong>Claims to pressure-test</strong><ul>${resume.risks.map((risk) => `<li>${esc(risk)}</li>`).join("")}</ul></aside>
        ${sourceBlock(["resume-local"], "Personalization source")}
      </section>
      <section class="palantir-section-head"><div><span>Six reusable stories</span><h4>Resume evidence bank</h4></div><p>Prepare facts and decisions. Choose the story after hearing the question.</p></section>
      <div class="palantir-resume-story-list">
        ${resume.stories.map((story, index) => `
          <details ${index === 0 ? "open" : ""}>
            <summary><span>${String(index + 1).padStart(2, "0")}</span><div><h4>${esc(story.title)}</h4><small>${story.best_for.map((item) => esc(item)).join(" · ")}</small></div></summary>
            <div>
              <section><strong>Resume evidence</strong><p>${esc(story.evidence)}</p></section>
              <section><strong>What you must prove</strong><p>${esc(story.prove)}</p></section>
              <section><strong>Pressure questions</strong><ol>${story.pressure_questions.map((question) => `<li>${esc(question)}</li>`).join("")}</ol></section>
              <aside><strong>Do not overclaim</strong><p>${esc(story.caution)}</p></aside>
              ${taskCheckbox("behavioral", `resume-${story.id}`, "I can defend this story without notes")}
            </div>
          </details>
        `).join("")}
      </div>
      <section class="palantir-section-head"><div><span>Most repeated and highest-signal</span><h4>10 behavioral questions</h4></div><p>Prepare evidence, not scripts. Open each question and answer the follow-ups aloud.</p></section>
      <div class="palantir-question-list">
        ${section.questions
          .map(
            (item, index) => `
              <details class="palantir-question" ${index === 0 ? "open" : ""}>
                <summary><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item.question)}</strong><em>${esc(item.frequency)}</em></summary>
                <div class="palantir-question-body">
                  <section><h5>Why it is likely</h5><p>${esc(item.why)}</p></section>
                  <section><h5>Strong answer blueprint</h5><p>${esc(item.blueprint)}</p></section>
                  <section><h5>Likely follow-ups</h5><ul>${item.followups.map((followup) => `<li>${esc(followup)}</li>`).join("")}</ul></section>
                  <aside><strong>Weak-answer pattern</strong><p>${esc(item.avoid)}</p></aside>
                  ${taskCheckbox("behavioral", item.id, "I answered this aloud and survived every follow-up")}
                  ${sourceBlock(item.sources)}
                </div>
              </details>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderOa() {
    const section = state.data.oa;
    return `
      <section class="palantir-format">
        <div><span>${esc(section.current_format.confidence)} confidence</span><h4>${esc(section.current_format.duration)} · three tasks</h4><p>${esc(section.current_format.tasks)}</p></div>
        <aside><strong>Contingency format</strong><p>${esc(section.current_format.historical_variant)}</p></aside>
        ${sourceBlock(section.current_format.sources)}
      </section>
      <section class="palantir-section-head"><div><span>Clock discipline</span><h4>90-minute execution plan</h4></div><p>A working second problem beats a half-optimized first problem.</p></section>
      <div class="palantir-timeline">
        ${section.execution.map((item, index) => `<div><strong>${esc(item.time)}</strong><p>${esc(item.action)}</p>${taskCheckbox("oa", `time-${index}`, "Practiced this checkpoint")}</div>`).join("")}
      </div>
      <section class="palantir-section-head"><div><span>Coverage</span><h4>What to know cold</h4></div></section>
      <div class="palantir-coverage">
        ${section.must_know.map((item, index) => `<section><strong>${esc(item.topic)}</strong><p>${esc(item.reason)}</p>${taskCheckbox("oa", `topic-${index}`, "Ready under time pressure")}</section>`).join("")}
      </div>
      <section class="palantir-section-head"><div><span>No LeetCode equivalent</span><h4>Implementation drills</h4></div></section>
      <div class="palantir-drills">
        ${section.custom_drills.map((drill, index) => `<article><span>OA drill ${index + 1}</span><h4>${esc(drill.title)}</h4><p>${esc(drill.prompt)}</p><div><strong>Interview bar</strong><p>${esc(drill.bar)}</p></div>${taskCheckbox("oa", `custom-${index}`, "Completed in 30 minutes or less")}${sourceBlock(drill.sources)}</article>`).join("")}
      </div>
    `;
  }

  function renderCoding() {
    const section = state.data.coding;
    const taggedSlugs = new Set(section.tagged_problems.map((problem) => problem.slug));
    const grindOverlap = section.grind75.filter((problem) => taggedSlugs.has(problem.slug)).length;
    const grindMinutes = section.grind75.reduce((total, problem) => total + problem.minutes, 0);
    const difficultyCounts = section.tagged_problems.reduce((counts, problem) => {
      counts[problem.difficulty] = (counts[problem.difficulty] || 0) + 1;
      return counts;
    }, {});
    return `
      <section class="palantir-lead">
        <p>The highest return is not grinding every tagged problem. Master the reported questions, then cover the few recurring patterns and practice responding to follow-ups without losing code quality.</p>
        <div class="palantir-answer-model"><h4>Live interview bar</h4><ol>${section.interview_bar.map((item) => `<li>${esc(item)}</li>`).join("")}</ol></div>
      </section>
      <section class="palantir-section-head"><div><span>Start here</span><h4>Priority shortlist and reported questions</h4></div><p>Finish the A set first. Use the B set for pattern insurance, then expand into the inventories only when a miss log shows a gap.</p></section>
      <div class="palantir-priority-key"><span><b>A</b> Do first</span><span><b>B</b> Pattern insurance</span><span>Evidence labels distinguish reports from analogues</span></div>
      <div class="palantir-problem-list">
        ${section.problems
          .map(
            (problem, index) => `
              <article>
                <div class="palantir-problem-rank"><span class="priority-${problem.priority.toLowerCase()}">${esc(problem.priority)}</span><small>${esc(problem.evidence)}</small></div>
                <div class="palantir-problem-copy">
                  <div><a href="${esc(problem.url)}" target="_blank" rel="noreferrer">${esc(problem.title)}</a><span>${esc(problem.difficulty)}</span></div>
                  <p>${esc(problem.why)}</p>
                  <div class="palantir-patterns">${problem.patterns.map((pattern) => `<span>${esc(pattern)}</span>`).join("")}</div>
                  <details><summary>Practice standard</summary><p>${esc(problem.practice)}</p>${sourceBlock(problem.sources)}</details>
                  ${taskCheckbox("coding", `problem-${index}`, "Solved, explained, tested, and handled a follow-up")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      <section class="palantir-section-head"><div><span>Screenshot-backed inventory</span><h4>All ${section.tagged_problems.length} Palantir-tagged problems</h4></div><p>This is the complete set visible in your screenshots, not a claim that every problem is equally likely.</p></section>
      <div class="palantir-tagged-toolbar">
        <div><strong>${section.tagged_problems.length}</strong><span>Total</span></div>
        <div><strong>${difficultyCounts.Easy || 0}</strong><span>Easy</span></div>
        <div><strong>${difficultyCounts.Medium || 0}</strong><span>Medium</span></div>
        <div><strong>${difficultyCounts.Hard || 0}</strong><span>Hard</span></div>
        <div class="segmented" role="tablist" aria-label="Tagged problem difficulty">
          <button class="segment active" type="button" data-tagged-filter="all">All</button>
          <button class="segment" type="button" data-tagged-filter="easy">Easy</button>
          <button class="segment" type="button" data-tagged-filter="medium">Medium</button>
          <button class="segment" type="button" data-tagged-filter="hard">Hard</button>
        </div>
      </div>
      <div class="palantir-tagged-list">
        <header><span>#</span><span>Problem</span><span>Difficulty</span><span>Acceptance</span><span>Pattern</span><span>Done</span></header>
        ${section.tagged_problems
          .map(
            (problem) => `
              <article data-tagged-difficulty="${problem.difficulty.toLowerCase()}">
                <strong>${problem.number}</strong>
                <a href="https://leetcode.com/problems/${esc(problem.slug)}/" target="_blank" rel="noreferrer">${esc(problem.title)}</a>
                <span class="tagged-difficulty ${problem.difficulty.toLowerCase()}">${esc(problem.difficulty)}</span>
                <span>${esc(problem.acceptance)}</span>
                <div class="palantir-patterns">${problem.patterns.map((pattern) => `<span>${esc(pattern)}</span>`).join("")}</div>
                ${taskCheckbox("coding", `tagged-${problem.number}`, "Complete")}
              </article>
            `,
          )
          .join("")}
      </div>
      ${sourceBlock(["leetcode-screenshots"], "Inventory source")}
      <section class="palantir-section-head"><div><span>Optional fundamentals track</span><h4>Grind 75 checklist</h4></div><p>This is a coverage library, not an extra 14-day assignment. Follow the official priority order when your miss log exposes a fundamentals gap.</p></section>
      <div class="palantir-grind-toolbar">
        <div><strong>${section.grind75.length}</strong><span>Problems</span></div>
        <div><strong>${Math.round(grindMinutes / 60)}h</strong><span>Target time</span></div>
        <div><strong>${grindOverlap}</strong><span>Tag overlap</span></div>
        <div class="segmented" role="tablist" aria-label="Grind 75 priority block">
          <button class="segment active" type="button" data-grind-filter="all">All</button>
          <button class="segment" type="button" data-grind-filter="1">1-25</button>
          <button class="segment" type="button" data-grind-filter="2">26-50</button>
          <button class="segment" type="button" data-grind-filter="3">51-75</button>
          <button class="segment" type="button" data-grind-filter="overlap">Palantir overlap</button>
        </div>
      </div>
      <div class="palantir-grind-list">
        <header><span>#</span><span>Problem</span><span>Level</span><span>Target</span><span>Signal</span><span>Done</span></header>
        ${section.grind75
          .map((problem) => {
            const overlap = taggedSlugs.has(problem.slug);
            const block = Math.ceil(problem.rank / 25);
            return `
              <article data-grind-block="${block}" data-grind-overlap="${overlap}">
                <strong>${problem.rank}</strong>
                <a href="https://leetcode.com/problems/${esc(problem.slug)}/" target="_blank" rel="noreferrer">${esc(problem.title)}</a>
                <span class="tagged-difficulty ${problem.difficulty.toLowerCase()}">${esc(problem.difficulty)}</span>
                <span>${problem.minutes} min</span>
                <span class="grind-signal ${overlap ? "overlap" : "core"}">${overlap ? "Palantir tag" : "Core"}</span>
                ${taskCheckbox("coding", `grind-${problem.slug}`, "Complete")}
              </article>
            `;
          })
          .join("")}
      </div>
      ${sourceBlock(["grind75-official"], "Study-plan source")}
      <section class="palantir-section-head"><div><span>Reported without a clean LeetCode match</span><h4>Custom technical prompts</h4></div></section>
      <div class="palantir-drills">
        ${section.custom.map((item, index) => `<article><span>${esc(item.evidence)}</span><h4>${esc(item.title)}</h4><p>${esc(item.prompt)}</p><div><strong>Expected reasoning</strong><p>${esc(item.expected_reasoning)}</p></div>${taskCheckbox("coding", `custom-${index}`, "Solved from a clarified contract")}${sourceBlock(item.sources)}</article>`).join("")}
      </div>
    `;
  }

  function renderLearning() {
    const section = state.data.learning;
    return `
      <section class="palantir-lead"><p>${esc(section.intro)}</p><div class="palantir-answer-model"><h4>Working protocol</h4><ol>${section.protocol.map((item) => `<li>${esc(item)}</li>`).join("")}</ol></div></section>
      <section class="palantir-section-head"><div><span>Re-engineering practice</span><h4>Four realistic drills</h4></div><p>Use an unfamiliar repository or have a partner introduce the pressure condition halfway through.</p></section>
      <div class="palantir-scenario-list">
        ${section.drills.map((drill, index) => `<article><header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${esc(drill.evidence)}</small><h4>${esc(drill.title)}</h4></div></header><section><strong>Initial task</strong><p>${esc(drill.setup)}</p></section><section><strong>Mid-interview change</strong><p>${esc(drill.pressure)}</p></section><aside><strong>Passing bar</strong><p>${esc(drill.bar)}</p></aside>${taskCheckbox("learning", `drill-${index}`, "Completed while narrating my model and uncertainty")}${sourceBlock(drill.sources)}</article>`).join("")}
      </div>
    `;
  }

  function renderDecomposition() {
    const section = state.data.decomposition;
    return `
      <section class="palantir-lead"><p>${esc(section.intro)}</p></section>
      <div class="palantir-decomp-framework">
        ${section.framework.map((item) => `<section><span>${esc(item.step)}</span><strong>${esc(item.name)}</strong><p>${esc(item.prompt)}</p></section>`).join("")}
      </div>
      <section class="palantir-section-head"><div><span>45-minute mocks</span><h4>Reported and role-tailored scenarios</h4></div><p>Drive each from user outcome to primitives and MVP before scaling.</p></section>
      <div class="palantir-scenario-list">
        ${section.scenarios.map((scenario, index) => `<article><header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${esc(scenario.evidence)}</small><h4>${esc(scenario.title)}</h4></div></header><section><strong>Prompt</strong><p>${esc(scenario.prompt)}</p></section><section><strong>Interviewer twist</strong><p>${esc(scenario.twist)}</p></section><div class="palantir-patterns">${scenario.look_for.map((item) => `<span>${esc(item)}</span>`).join("")}</div>${taskCheckbox("decomposition", `scenario-${index}`, "Completed a 45-minute structured design")}${sourceBlock(scenario.sources)}</article>`).join("")}
      </div>
    `;
  }

  function renderHiringManager() {
    const section = state.data.hiring_manager;
    return `
      <section class="palantir-lead"><p>${esc(section.intro)}</p>${sourceBlock(section.sources)}</section>
      <div class="palantir-hm-blocks">
        ${section.likely_blocks.map((item, index) => `<section><span>${esc(item.weight)}</span><h4>${esc(item.name)}</h4><p>${esc(item.prepare)}</p>${taskCheckbox("hiring-manager", `block-${index}`, "Prepared with evidence")}</section>`).join("")}
      </div>
      <section class="palantir-section-head"><div><span>Personalized packet defense</span><h4>${esc(section.resume_grill.headline)}</h4></div><p>${esc(section.resume_grill.intro)}</p></section>
      <ol class="palantir-resume-grill">
        ${section.resume_grill.questions.map((question, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(question)}</p>${taskCheckbox("hiring-manager", `resume-${index}`, "Answered with concrete architecture and evidence")}</li>`).join("")}
      </ol>
      ${sourceBlock(["resume-local"], "Personalization source")}
      <section class="palantir-section-head"><div><span>Pressure set</span><h4>Questions to answer without notes</h4></div></section>
      <ol class="palantir-hm-questions">${section.questions.map((question, index) => `<li><span>${esc(question)}</span>${taskCheckbox("hiring-manager", `question-${index}`, "Answered and handled a follow-up")}</li>`).join("")}</ol>
      <section class="palantir-closing"><span>Your questions</span><h4>Close like an engineer evaluating mutual fit</h4><ul>${section.closing.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>
      <section class="palantir-section-head"><div><span>Final two weeks</span><h4>14-day preparation sequence</h4></div></section>
      <div class="palantir-schedule">${state.data.schedule.map((item, index) => `<section><strong>${esc(item.day)}</strong><div><h5>${esc(item.focus)}</h5><p>${esc(item.deliverable)}</p></div>${taskCheckbox("hiring-manager", `day-${index}`, "Done")}</section>`).join("")}</div>
    `;
  }

  const renderers = {
    behavioral: renderBehavioral,
    oa: renderOa,
    coding: renderCoding,
    learning: renderLearning,
    decomposition: renderDecomposition,
    "hiring-manager": renderHiringManager,
  };

  function renderNav() {
    els.nav.innerHTML = state.data.loop
      .map(
        (stage) => `
          <button type="button" data-palantir-stage="${esc(stage.id)}" class="${stage.id === state.selected ? "active" : ""}">
            <span>${esc(stage.step)}</span>
            <div><strong>${esc(stage.label)}</strong><small>not started</small></div>
          </button>
        `,
      )
      .join("");
  }

  function renderStage() {
    const stage = state.data.loop.find((item) => item.id === state.selected) || state.data.loop[0];
    state.selected = stage.id;
    els.title.textContent = stage.label;
    els.meta.innerHTML = `<span>${esc(stage.duration)}</span><span>${esc(stage.confidence)} confidence</span><p>${esc(stage.summary)}</p>`;
    els.content.innerHTML = renderers[stage.id]();
    document.querySelectorAll("[data-palantir-stage]").forEach((button) => button.classList.toggle("active", button.dataset.palantirStage === stage.id));
    const index = state.data.loop.findIndex((item) => item.id === stage.id);
    els.previous.disabled = index === 0;
    els.next.disabled = index === state.data.loop.length - 1;
    els.next.textContent = index === state.data.loop.length - 1 ? "End of Loop" : `Next: ${state.data.loop[index + 1].label}`;
    window.history.replaceState(null, "", `#palantir/${stage.id}`);
    renderProgress();
  }

  function selectStage(id, shouldScroll = true) {
    if (!state.data.loop.some((item) => item.id === id)) return;
    state.selected = id;
    renderStage();
    if (shouldScroll) document.querySelector(".palantir-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function start() {
    if (!state.data) {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
      state.data = await response.json();
      if (state.data.behavioral.questions.length !== 10) throw new Error("Behavioral curriculum is incomplete.");
      if (state.data.coding.problems.length < 10) throw new Error("Coding curriculum is incomplete.");
      renderRoleBrief();
      renderNav();
    }
    const route = window.location.hash.match(/^#palantir\/([^/]+)/)?.[1];
    state.selected = state.data.loop.some((item) => item.id === route) ? route : state.selected;
    renderStage();
  }

  function showError(error) {
    els.content.innerHTML = `<div class="palantir-error"><strong>Could not load the Palantir academy.</strong><p>${esc(error.message)}</p></div>`;
  }

  els.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-palantir-stage]");
    if (button) selectStage(button.dataset.palantirStage);
  });

  els.content.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-palantir-task]");
    if (!checkbox) return;
    const progress = loadProgress();
    progress.completed[checkbox.dataset.palantirTask] = checkbox.checked;
    saveProgress(progress);
    renderProgress();
  });

  els.content.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-tagged-filter]");
    if (filter) {
      const selected = filter.dataset.taggedFilter;
      els.content.querySelectorAll("[data-tagged-filter]").forEach((button) => button.classList.toggle("active", button === filter));
      els.content.querySelectorAll("[data-tagged-difficulty]").forEach((row) => {
        row.hidden = selected !== "all" && row.dataset.taggedDifficulty !== selected;
      });
      return;
    }

    const grindFilter = event.target.closest("[data-grind-filter]");
    if (!grindFilter) return;
    const selected = grindFilter.dataset.grindFilter;
    els.content.querySelectorAll("[data-grind-filter]").forEach((button) => button.classList.toggle("active", button === grindFilter));
    els.content.querySelectorAll("[data-grind-block]").forEach((row) => {
      row.hidden = selected !== "all" && (selected === "overlap" ? row.dataset.grindOverlap !== "true" : row.dataset.grindBlock !== selected);
    });
  });

  els.previous.addEventListener("click", () => {
    const index = state.data.loop.findIndex((item) => item.id === state.selected);
    if (index > 0) selectStage(state.data.loop[index - 1].id);
  });

  els.next.addEventListener("click", () => {
    const index = state.data.loop.findIndex((item) => item.id === state.selected);
    if (index < state.data.loop.length - 1) selectStage(state.data.loop[index + 1].id);
  });

  els.reset.addEventListener("click", () => {
    if (!window.confirm("Reset all Palantir academy progress in this browser?")) return;
    localStorage.removeItem(PROGRESS_KEY);
    renderStage();
  });

  window.addEventListener("hashchange", () => {
    const route = window.location.hash.match(/^#palantir\/([^/]+)/)?.[1];
    if (route && state.data && !els.view.hidden && route !== state.selected) {
      selectStage(route, false);
    }
  });

  window.PalantirAcademy = { start, showError };
})();
