function initSpotlight() {
  const el = document.getElementById("spotlight");
  document.addEventListener("mousemove", function (e) {
    el.style.setProperty("--x", e.clientX + "px");
    el.style.setProperty("--y", e.clientY + "px");
    el.classList.add("active");
  });

  document.addEventListener("mouseleave", function () {
    el.classList.remove("active");
  });
}

function initScrollSpy() {
  const sections = document.querySelectorAll(".section[id]");
  const links = document.querySelectorAll(".nav__link");

  if (sections.length === 0 || links.length === 0) return;

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (link) {
            link.classList.remove("active");
          });
          const active = document.querySelector(
            '.nav__link[data-target="' + entry.target.id + '"]'
          );
          if (active) active.classList.add("active");
        }
      });
    },
    {
      rootMargin: "-20% 0px -70% 0px",
    }
  );

  sections.forEach(function (section) {
    observer.observe(section);
  });
}

function initFadeIn() {
  const cards = document.querySelectorAll(
    ".experience-card, .project-card, .writing-card"
  );

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
    }
  );

  cards.forEach(function (card) {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    card.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    observer.observe(card);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initSpotlight();
  initScrollSpy();
  initFadeIn();
});
