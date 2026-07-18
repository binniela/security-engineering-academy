(() => {
  const els = {
    body: document.body,
    chooser: document.querySelector("#academyChooser"),
    topbar: document.querySelector("#academyTopbar"),
    topEyebrow: document.querySelector("#topEyebrow"),
    topTitle: document.querySelector("#topTitle"),
    fdeControls: document.querySelector('[aria-label="App view"]'),
    refresh: document.querySelector("#refreshButton"),
    apiLink: document.querySelector('.top-actions a[href="/api/state"]'),
    securityView: document.querySelector("#securityAcademyView"),
    fdeViews: [
      document.querySelector("#curriculumView"),
      document.querySelector("#systemDesignView"),
      document.querySelector("#customerSimView"),
    ],
  };

  function showFdeDefault() {
    els.fdeViews.forEach((view) => {
      if (view) view.hidden = view.id !== "curriculumView";
    });
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    document.querySelector('[data-tab="learn"]')?.classList.add("active");
    document.querySelector("#learnTab")?.classList.add("active");
    document.querySelector("#viewCurriculum")?.classList.add("active");
    document.querySelector("#viewLeetcode")?.classList.remove("active");
    document.querySelector("#viewSystemDesign")?.classList.remove("active");
    document.querySelector("#viewCustomerSim")?.classList.remove("active");
  }

  async function openAcademy(name) {
    document.querySelectorAll("[data-open-academy]").forEach((button) => {
      button.classList.toggle("active", button.dataset.openAcademy === name);
    });

    if (name === "home") {
      els.body.className = "academy-landing";
      els.chooser.hidden = false;
      els.securityView.hidden = true;
      els.fdeViews.forEach((view) => {
        if (view) view.hidden = true;
      });
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    els.chooser.hidden = true;
    els.topbar.hidden = false;
    if (name === "security") {
      els.body.className = "academy-security";
      els.topEyebrow.textContent = "Mastery-based interview course";
      els.topTitle.textContent = "Security Engineering Academy";
      els.fdeControls.hidden = true;
      els.refresh.hidden = true;
      els.apiLink.hidden = true;
      els.fdeViews.forEach((view) => {
        if (view) view.hidden = true;
      });
      els.securityView.hidden = false;
      await window.SecurityAcademy.start();
      return;
    }

    els.body.className = "academy-fde";
    els.topEyebrow.textContent = "Local bootcamp";
    els.topTitle.textContent = "FDE API Academy";
    els.fdeControls.hidden = false;
    els.refresh.hidden = false;
    els.apiLink.hidden = false;
    els.securityView.hidden = true;
    window.history.replaceState(null, "", window.location.pathname);
    showFdeDefault();
  }

  document.addEventListener("click", (event) => {
    const academyButton = event.target.closest("[data-open-academy]");
    if (!academyButton) return;
    openAcademy(academyButton.dataset.openAcademy).catch(window.SecurityAcademy.showError);
  });
})();
