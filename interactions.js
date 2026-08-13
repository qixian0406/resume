(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const progress = document.querySelector(".scroll-progress span");
  const pageGlow = document.querySelector(".page-glow");
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  const navLinks = [...document.querySelectorAll('.site-header nav a[href^="#"]')];
  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const updateProgress = () => {
    if (!progress) return;
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0;
    progress.style.transform = `scaleX(${ratio})`;
  };

  const updateHeroPassed = () => {
    if (!hero) return;
    const headerHeight = header?.offsetHeight || 0;
    root.classList.toggle("hero-passed", hero.getBoundingClientRect().bottom <= headerHeight + 8);
  };

  let progressFrame = 0;
  const requestProgressUpdate = () => {
    if (progressFrame) return;
    progressFrame = window.requestAnimationFrame(() => {
      updateProgress();
      updateHeroPassed();
      progressFrame = 0;
    });
  };

  const setActiveLink = (id) => {
    root.dataset.section = id || "top";
    navLinks.forEach((link) => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const setupNavigationObserver = () => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveLink(visible.target.id);
      },
      { rootMargin: "-24% 0px -64%", threshold: [0, 0.12, 0.35] }
    );
    observedSections.forEach((section) => observer.observe(section));
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const id = link.getAttribute("href")?.slice(1);
        if (id) setActiveLink(id);
      });
    });
  };

  const setupReveals = () => {
    const targets = [...document.querySelectorAll([
      ".hero-copy > *",
      ".portrait-card",
      ".focus-item",
      ".section-title-block",
      ".about-copy",
      ".section-head > *",
      ".education-item",
      ".project-card",
      ".capability-group",
      ".publication-item",
      ".patent-item",
      ".copyright-item",
      ".honor-card",
      ".activity-column",
      ".contact-section > *"
    ].join(","))];

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    root.classList.add("motion-ready");
    targets.forEach((target, index) => {
      target.classList.add("reveal");
      target.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
    });

    const completeReveal = (target) => {
      target.classList.remove("reveal");
      target.style.removeProperty("--reveal-delay");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          let revealFallback = window.setTimeout(() => completeReveal(entry.target), 1050);
          entry.target.addEventListener("transitionend", (event) => {
            if (event.propertyName !== "transform" && event.propertyName !== "opacity") return;
            window.clearTimeout(revealFallback);
            completeReveal(entry.target);
          }, { once: true });
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -7%", threshold: 0.08 }
    );
    targets.forEach((target) => observer.observe(target));
  };

  const setupPointerEffects = () => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (reduceMotion.matches || !finePointer.matches) return;

    root.classList.add("pointer-effects");

    let pointerFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight * 0.38;
    const updatePointerGlow = () => {
      if (pageGlow) {
        pageGlow.style.setProperty("--glow-x", `${pointerX}px`);
        pageGlow.style.setProperty("--glow-y", `${pointerY}px`);
      }
      pointerFrame = 0;
    };

    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updatePointerGlow);
    }, { passive: true });

    const surfaces = document.querySelectorAll(
      ".portrait-card, .project-card, .capability-group, .honor-card, .activity-column"
    );
    surfaces.forEach((surface) => {
      let bounds;
      let surfaceFrame = 0;
      let surfaceX = 0;
      let surfaceY = 0;
      surface.classList.add("interactive-surface");
      surface.addEventListener("pointerenter", () => {
        bounds = surface.getBoundingClientRect();
      }, { passive: true });
      surface.addEventListener("pointermove", (event) => {
        if (!bounds) bounds = surface.getBoundingClientRect();
        surfaceX = event.clientX - bounds.left;
        surfaceY = event.clientY - bounds.top;
        if (surfaceFrame) return;
        surfaceFrame = window.requestAnimationFrame(() => {
          surface.style.setProperty("--spot-x", `${surfaceX}px`);
          surface.style.setProperty("--spot-y", `${surfaceY}px`);
          const tiltX = ((surfaceX / bounds.width) - 0.5) * 3.2;
          const tiltY = ((surfaceY / bounds.height) - 0.5) * -3.2;
          surface.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
          surface.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
          surfaceFrame = 0;
        });
      }, { passive: true });
      surface.addEventListener("pointerleave", () => {
        bounds = undefined;
        surface.style.removeProperty("--spot-x");
        surface.style.removeProperty("--spot-y");
        surface.style.removeProperty("--tilt-x");
        surface.style.removeProperty("--tilt-y");
      }, { passive: true });
    });
  };

  const setupClickEffects = () => {
    if (reduceMotion.matches) return;
    document.querySelectorAll(".primary-button, .header-cta").forEach((button) => {
      const addRipple = (event) => {
        const bounds = button.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "click-ripple";
        ripple.setAttribute("aria-hidden", "true");
        const localX = event.clientX ? event.clientX - bounds.left : bounds.width / 2;
        const localY = event.clientY ? event.clientY - bounds.top : bounds.height / 2;
        ripple.style.left = `${localX}px`;
        ripple.style.top = `${localY}px`;
        button.append(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      };
      button.addEventListener("pointerdown", addRipple);
      button.addEventListener("click", (event) => {
        if (event.detail === 0) addRipple(event);
      });
    });
  };

  updateProgress();
  updateHeroPassed();
  setupNavigationObserver();
  setupReveals();
  setupPointerEffects();
  setupClickEffects();
  window.addEventListener("scroll", requestProgressUpdate, { passive: true });
  window.addEventListener("resize", requestProgressUpdate, { passive: true });
})();
