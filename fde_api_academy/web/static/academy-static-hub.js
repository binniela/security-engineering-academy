(() => {
  const els = {
    body: document.body,
    chooser: document.querySelector("#academyChooser"),
    topbar: document.querySelector("#academyTopbar"),
    topEyebrow: document.querySelector("#topEyebrow"),
    topTitle: document.querySelector("#topTitle"),
    securityView: document.querySelector("#securityAcademyView"),
    palantirView: document.querySelector("#palantirAcademyView"),
  };

  let active = "home";

  function updateSwitch(name) {
    document.querySelectorAll("[data-open-academy]").forEach((button) => {
      button.classList.toggle("active", button.dataset.openAcademy === name);
    });
  }

  function showError(name, error) {
    if (name === "palantir") window.PalantirAcademy.showError(error);
    else window.SecurityAcademy.showError(error);
  }

  async function openAcademy(name) {
    active = name;
    updateSwitch(name);
    els.securityView.hidden = true;
    els.palantirView.hidden = true;

    if (name === "home") {
      els.body.className = "academy-landing";
      els.chooser.hidden = false;
      els.topbar.hidden = true;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return;
    }

    els.chooser.hidden = true;
    els.topbar.hidden = false;

    if (name === "security") {
      els.body.className = "academy-security";
      els.topEyebrow.textContent = "Mastery-based interview course";
      els.topTitle.textContent = "Security Engineering Academy";
      els.securityView.hidden = false;
      await window.SecurityAcademy.start();
      return;
    }

    els.body.className = "academy-palantir";
    els.topEyebrow.textContent = "Defense Tech SWE interview preparation";
    els.topTitle.textContent = "Palantir Engineering Academy";
    els.palantirView.hidden = false;
    await window.PalantirAcademy.start();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-academy]");
    if (!button) return;
    openAcademy(button.dataset.openAcademy).catch((error) => showError(button.dataset.openAcademy, error));
  });

  window.addEventListener("hashchange", () => {
    const requested = window.location.hash.startsWith("#palantir/")
      ? "palantir"
      : window.location.hash.startsWith("#security/")
        ? "security"
        : null;
    if (requested && requested !== active) {
      openAcademy(requested).catch((error) => showError(requested, error));
    }
  });

  const initial = window.location.hash.startsWith("#palantir/")
    ? "palantir"
    : window.location.hash.startsWith("#security/")
      ? "security"
      : "home";
  openAcademy(initial).catch((error) => showError(initial, error));
})();
