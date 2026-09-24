(() => {
  const STAGGER_MS = 60;
  const MAX_STAGGER_STEPS = 5;

  function revealOnScroll() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      for (const el of targets) el.classList.add("visible");
      return;
    }

    // Elements that enter together animate as a small staggered group.
    const observer = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const delay = Math.min(step, MAX_STAGGER_STEPS) * STAGGER_MS;
          entry.target.style.setProperty("--reveal-delay", `${delay}ms`);
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
          step += 1;
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    for (const el of targets) observer.observe(el);
  }

  const COPIED_RESET_MS = 1600;

  function copyButtons() {
    for (const button of document.querySelectorAll("[data-copy]")) {
      const status = button.parentElement.querySelector("[data-copy-status]");
      let timer = 0;

      button.addEventListener("click", async () => {
        const value = button.getAttribute("data-copy");
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          if (status) status.textContent = `Couldn’t copy. The address is ${value}.`;
          return;
        }
        button.setAttribute("data-copied", "");
        if (status) status.textContent = "Email address copied.";
        clearTimeout(timer);
        timer = setTimeout(() => {
          button.removeAttribute("data-copied");
          if (status) status.textContent = "";
        }, COPIED_RESET_MS);
      });
    }
  }

  revealOnScroll();
  copyButtons();
})();
