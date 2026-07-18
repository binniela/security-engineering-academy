// Central top-level view switcher for the academy shell.
// Feature modules listen for the "view:show" event to lazily render.
(() => {
  const map = {
    viewCurriculum: "curriculumView",
    viewLeetcode: "curriculumView",
    viewSystemDesign: "systemDesignView",
    viewCustomerSim: "customerSimView",
  };

  function show(viewId) {
    Object.entries(map).forEach(([btnId, vId]) => {
      const view = document.getElementById(vId);
      if (view) view.hidden = vId !== viewId;
      const btn = document.getElementById(btnId);
      if (btn) btn.classList.toggle("active", vId === viewId);
    });
    document.dispatchEvent(new CustomEvent("view:show", { detail: { viewId } }));
  }

  Object.keys(map).forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener("click", () => show(map[btnId]));
  });
})();
