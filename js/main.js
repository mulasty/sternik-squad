(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  root.classList.add("js");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

  const state = {
    targetY: window.scrollY || 0,
    currentY: window.scrollY || 0,
    viewportH: window.innerHeight,
    docH: Math.max(root.scrollHeight, document.body.scrollHeight),
    ease: prefersReducedMotion ? 1 : 0.11,
    reduceMotion: prefersReducedMotion,
    heroMouse: { x: 0, y: 0 },
    gallery: {
      start: 0,
      end: 1,
      travel: 0
    },
    timeline: {
      start: 0,
      end: 1,
      stepPoints: []
    }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const easeInOutCubic = (value) => (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);

  const header = document.getElementById("site-header");
  const progressBar = document.querySelector(".scroll-progress__bar");
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.getElementById("nav-links");

  const hero = document.getElementById("hero");
  const heroLayers = {
    media: document.querySelector('[data-depth-layer="media"]'),
    texture: document.querySelector('[data-depth-layer="texture"]'),
    content: document.querySelector('[data-depth-layer="content"]'),
    feature: document.querySelector('[data-depth-layer="feature"]'),
    accents: document.querySelector('[data-depth-layer="accents"]')
  };

  const gallerySection = document.querySelector(".gallery-section");
  const galleryTrack = document.querySelector("[data-gallery-track]");
  const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));

  const timeline = document.querySelector("[data-timeline]");
  const timelineProgress = document.querySelector("[data-timeline-progress]");
  const timelineSteps = Array.from(document.querySelectorAll("[data-step]"));

  const parallaxMedia = Array.from(document.querySelectorAll("[data-parallax]"));
  const tiltCards = Array.from(document.querySelectorAll("[data-tilt]"));

  let heroPointerHandlers = null;
  const tiltHandlerMap = new WeakMap();

  splitText(document.querySelectorAll(".split-text"));
  setupReveals();
  setupNav();
  setupAnchors();
  refreshLayout();
  updateInteractiveModes();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize);
  window.addEventListener("load", () => {
    refreshLayout();
    state.targetY = window.scrollY || 0;
  });

  requestAnimationFrame(animationLoop);

  function splitText(elements) {
    elements.forEach((element) => {
      if (element.dataset.split === "true") {
        return;
      }

      const text = element.textContent.trim();
      const fragment = document.createDocumentFragment();

      Array.from(text).forEach((char, index) => {
        const span = document.createElement("span");
        span.className = char === " " ? "char space" : "char";
        span.style.setProperty("--char-index", String(index));
        span.textContent = char === " " ? "\u00A0" : char;
        fragment.appendChild(span);
      });

      element.textContent = "";
      element.appendChild(fragment);
      element.dataset.split = "true";
    });
  }

  function setupReveals() {
    const revealTargets = Array.from(document.querySelectorAll(".reveal, .split-text"));

    revealTargets.forEach((element, index) => {
      element.style.transitionDelay = `${(index % 7) * 70}ms`;
    });

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -12% 0px"
      }
    );

    revealTargets.forEach((element) => revealObserver.observe(element));
  }

  function setupNav() {
    if (!navToggle || !navLinks) {
      return;
    }

    navToggle.addEventListener("click", () => {
      const isExpanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isExpanded));
      navLinks.classList.toggle("is-open", !isExpanded);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!navLinks.classList.contains("is-open")) {
        return;
      }

      if (navLinks.contains(target) || navToggle.contains(target)) {
        return;
      }

      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
    });
  }

  function setupAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const href = anchor.getAttribute("href") || "";

        if (href.length < 2) {
          return;
        }

        const target = document.querySelector(href);
        if (!target) {
          return;
        }

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });

        if (navToggle && navLinks) {
          navToggle.setAttribute("aria-expanded", "false");
          navLinks.classList.remove("is-open");
        }
      });
    });
  }

  function onScroll() {
    state.targetY = window.scrollY || 0;
  }

  function onResize() {
    refreshLayout();
    updateInteractiveModes();
  }

  function refreshLayout() {
    state.viewportH = window.innerHeight;
    setupGalleryMetrics();
    setupTimelineMetrics();
    state.docH = Math.max(root.scrollHeight, document.body.scrollHeight);
  }

  function updateInteractiveModes() {
    updateHeroPointerBinding();
    updateServiceTiltBinding();
  }

  function setupGalleryMetrics() {
    if (!gallerySection || !galleryTrack) {
      return;
    }

    const trackWidth = galleryTrack.scrollWidth;
    const travel = Math.max(0, trackWidth - window.innerWidth + 96);
    state.gallery.travel = travel;

    const sectionHeight = Math.max(state.viewportH * 1.24, travel + state.viewportH * 1.24);
    gallerySection.style.height = `${sectionHeight}px`;

    state.gallery.start = gallerySection.offsetTop;
    state.gallery.end = state.gallery.start + sectionHeight - state.viewportH;
  }

  function setupTimelineMetrics() {
    if (!timeline) {
      return;
    }

    const timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
    const timelineHeight = timeline.offsetHeight;

    state.timeline.start = timelineTop - state.viewportH * 0.38;
    state.timeline.end = timelineTop + timelineHeight - state.viewportH * 0.35;
    state.timeline.stepPoints = timelineSteps.map((step) => step.getBoundingClientRect().top + window.scrollY - state.viewportH * 0.6);
  }

  function updateHeroPointerBinding() {
    if (!hero) {
      return;
    }

    const shouldBind = !state.reduceMotion && !isCoarsePointer() && window.innerWidth > 900;

    if (shouldBind && !heroPointerHandlers) {
      const onPointerMove = (event) => {
        const rect = hero.getBoundingClientRect();
        const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const normalizedY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        state.heroMouse.x = clamp(normalizedX, -1, 1);
        state.heroMouse.y = clamp(normalizedY, -1, 1);
      };

      const onPointerLeave = () => {
        state.heroMouse.x = 0;
        state.heroMouse.y = 0;
      };

      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", onPointerLeave);
      heroPointerHandlers = { onPointerMove, onPointerLeave };
    }

    if (!shouldBind && heroPointerHandlers) {
      hero.removeEventListener("pointermove", heroPointerHandlers.onPointerMove);
      hero.removeEventListener("pointerleave", heroPointerHandlers.onPointerLeave);
      heroPointerHandlers = null;
      state.heroMouse.x = 0;
      state.heroMouse.y = 0;
    }
  }

  function updateServiceTiltBinding() {
    const shouldBind = !state.reduceMotion && !isCoarsePointer() && window.innerWidth > 900;

    tiltCards.forEach((card) => {
      const hasHandlers = tiltHandlerMap.has(card);

      if (shouldBind && !hasHandlers) {
        const onPointerMove = (event) => {
          const rect = card.getBoundingClientRect();
          const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
          const relativeY = (event.clientY - rect.top) / rect.height - 0.5;

          card.style.setProperty("--ry", `${relativeX * 10}deg`);
          card.style.setProperty("--rx", `${relativeY * -10}deg`);
        };

        const onPointerLeave = () => {
          card.style.setProperty("--ry", "0deg");
          card.style.setProperty("--rx", "0deg");
        };

        card.addEventListener("pointermove", onPointerMove);
        card.addEventListener("pointerleave", onPointerLeave);
        card.addEventListener("pointercancel", onPointerLeave);
        tiltHandlerMap.set(card, { onPointerMove, onPointerLeave });
      }

      if (!shouldBind && hasHandlers) {
        const handlers = tiltHandlerMap.get(card);
        if (!handlers) {
          return;
        }

        card.removeEventListener("pointermove", handlers.onPointerMove);
        card.removeEventListener("pointerleave", handlers.onPointerLeave);
        card.removeEventListener("pointercancel", handlers.onPointerLeave);
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
        tiltHandlerMap.delete(card);
      }
    });
  }

  function animationLoop() {
    const delta = state.targetY - state.currentY;
    state.currentY += delta * state.ease;

    if (Math.abs(delta) < 0.08) {
      state.currentY = state.targetY;
    }

    updateHeader();
    updateScrollProgress();
    updateHeroDepth();
    updateGalleryMotion();
    updateTimelineProgress();
    updateParallaxMedia();

    requestAnimationFrame(animationLoop);
  }

  function updateHeader() {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", state.currentY > 20);
  }

  function updateScrollProgress() {
    if (!progressBar) {
      return;
    }

    const scrollRange = Math.max(1, state.docH - state.viewportH);
    const progress = clamp(state.currentY / scrollRange, 0, 1);
    progressBar.style.transform = `scaleX(${progress})`;
  }

  function updateHeroDepth() {
    if (!hero || !heroLayers.media || !heroLayers.content || !heroLayers.texture || !heroLayers.accents) {
      return;
    }

    const heroStart = hero.offsetTop;
    const heroRange = Math.max(hero.offsetHeight, 1);
    const scrollProgress = clamp((state.currentY - heroStart) / heroRange, 0, 1);

    const mouseX = state.heroMouse.x;
    const mouseY = state.heroMouse.y;
    const isMobileHero = window.innerWidth <= 900;

    if (isMobileHero) {
      heroLayers.media.style.transform = `translate3d(0, ${(scrollProgress * 10).toFixed(2)}px, -40px) scale(1.08)`;
      heroLayers.texture.style.transform = `translate3d(0, ${(-scrollProgress * 6).toFixed(2)}px, 14px) scale(1.03)`;
      heroLayers.content.style.transform = `translate3d(0, ${(-scrollProgress * 16).toFixed(2)}px, 36px)`;
      heroLayers.content.style.opacity = String(1 - scrollProgress * 0.72);

      if (heroLayers.feature) {
        heroLayers.feature.style.transform = "translate3d(0, 0, 0) scale(1)";
        heroLayers.feature.style.opacity = String(1 - scrollProgress * 0.25);
      }

      heroLayers.accents.style.transform = "translate3d(0, 0, 0)";
      heroLayers.accents.style.opacity = "0";
      body.classList.toggle("is-after-hero", scrollProgress > 0.11);
      return;
    }

    heroLayers.media.style.transform = `translate3d(${(mouseX * -24).toFixed(2)}px, ${((mouseY * -10) + scrollProgress * 24).toFixed(2)}px, -120px) scale(1.22)`;
    heroLayers.texture.style.transform = `translate3d(${(mouseX * 12).toFixed(2)}px, ${((mouseY * 8) - scrollProgress * 16).toFixed(2)}px, 20px) scale(1.05)`;
    heroLayers.content.style.transform = `translate3d(${(mouseX * 14).toFixed(2)}px, ${((mouseY * 10) - scrollProgress * 38).toFixed(2)}px, 80px)`;
    heroLayers.content.style.opacity = String(1 - scrollProgress * 1.05);

    if (heroLayers.feature) {
      heroLayers.feature.style.transform = `translate3d(${(mouseX * -8).toFixed(2)}px, ${((mouseY * 8) - scrollProgress * 26).toFixed(2)}px, 180px) scale(${(1 - scrollProgress * 0.07).toFixed(3)})`;
      heroLayers.feature.style.opacity = String(1 - scrollProgress * 0.92);
    }

    heroLayers.accents.style.transform = `translate3d(${(mouseX * 20).toFixed(2)}px, ${((mouseY * 16) - scrollProgress * 20).toFixed(2)}px, 160px)`;
    heroLayers.accents.style.opacity = String(1 - scrollProgress * 0.9);

    body.classList.toggle("is-after-hero", scrollProgress > 0.11);
  }

  function updateGalleryMotion() {
    if (!gallerySection || !galleryTrack) {
      return;
    }

    const sectionRange = Math.max(1, state.gallery.end - state.gallery.start);
    const rawProgress = clamp((state.currentY - state.gallery.start) / sectionRange, 0, 1);
    const progress = easeInOutCubic(rawProgress);
    const offsetX = -state.gallery.travel * progress;

    galleryTrack.style.transform = `translate3d(${offsetX.toFixed(2)}px, 0, 0)`;

    if (state.reduceMotion) {
      return;
    }

    galleryItems.forEach((item, index) => {
      const depth = Number(item.dataset.depth || "0");
      const wave = Math.sin(progress * Math.PI + index * 0.55) * 9;
      item.style.transform = `translate3d(0, ${wave.toFixed(2)}px, ${depth}px)`;
    });
  }

  function updateTimelineProgress() {
    if (!timelineProgress) {
      return;
    }

    const timelineRange = Math.max(1, state.timeline.end - state.timeline.start);
    const progress = clamp((state.currentY - state.timeline.start) / timelineRange, 0, 1);
    const isMobile = window.innerWidth <= 900;

    timelineProgress.style.transform = isMobile ? `scaleX(${progress})` : `scaleY(${progress})`;

    timelineSteps.forEach((step, index) => {
      step.classList.toggle("is-active", state.currentY >= (state.timeline.stepPoints[index] || 0));
    });
  }

  function updateParallaxMedia() {
    if (state.reduceMotion) {
      return;
    }

    parallaxMedia.forEach((media) => {
      const rect = media.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > state.viewportH + 120) {
        return;
      }

      const speed = Number(media.dataset.parallax || "0.1");
      const distanceFromCenter = rect.top - state.viewportH * 0.5;
      const translateY = -distanceFromCenter * speed * 0.18;

      media.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(1.03)`;
    });
  }
})();
