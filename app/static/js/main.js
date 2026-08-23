/**
 * CCMS shared UI behaviours (Phase 1 shell).
 */
(function () {
  "use strict";

  const frame = document.getElementById("app-frame");
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  const closeBtn = document.getElementById("sidebar-close");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!frame || !sidebar || !toggle) {
    return;
  }

  function setSidebarOpen(isOpen) {
    frame.classList.toggle("sidebar-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (backdrop) {
      backdrop.hidden = !isOpen;
      backdrop.classList.toggle("is-visible", isOpen);
    }
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  toggle.addEventListener("click", function () {
    const open = !frame.classList.contains("sidebar-open");
    setSidebarOpen(open);
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && frame.classList.contains("sidebar-open")) {
      closeSidebar();
    }
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 992px)").matches) {
      closeSidebar();
    }
  });
})();
