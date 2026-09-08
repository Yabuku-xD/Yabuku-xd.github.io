document.addEventListener("DOMContentLoaded", () => {
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll(".reveal"),
  );
  var reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reducedMotion) {
    document.querySelectorAll("section.reveal .p-2 img").forEach((img) => {
      img.style.animation =
        "float " +
        (3 + Math.random() * 4).toFixed(1) +
        "s ease-in-out infinite";
      img.style.animationDelay = "-" + (Math.random() * 5).toFixed(1) + "s";
    });
  }

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => {
      el.classList.add("visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    },
  );

  revealEls.forEach((el) => {
    observer.observe(el);
  });
});
