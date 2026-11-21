// nav.ts - glass bar after scrolling, hides on the way down, shows the name once the hero's id scrolls under it,
// tracks the current section with a sliding pill, and runs the mobile sheet

export function initNav() {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;
  const navId = nav.querySelector<HTMLElement>("[data-nav-id]")!;
  const heroId = document.querySelector<HTMLElement>("[data-hero-id]");
  const toggle = nav.querySelector<HTMLButtonElement>("[data-nav-toggle]")!;
  const sheet = nav.querySelector<HTMLElement>("[data-nav-sheet]")!;
  const pill = nav.querySelector<HTMLElement>("[data-nav-pill]");
  const links = [...nav.querySelectorAll<HTMLAnchorElement>(".nav-link")];

  let lastY = scrollY;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      nav.classList.toggle("is-scrolled", y > 8);
      // hide after scrolling down past the hero fold, show on any scroll up
      if (Math.abs(y - lastY) > 6) {
        nav.classList.toggle("is-hidden", y > lastY && y > innerHeight * 0.9);
        lastY = y;
      }
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

  if (heroId) {
    new IntersectionObserver(
      ([e]) => {
        const line = e.rootBounds?.top ?? 0;
        navId.classList.toggle("is-visible", !e.isIntersecting && e.boundingClientRect.top < line);
      },
      { rootMargin: "-70px 0px 0px 0px" }
    ).observe(heroId);
  }

  // current section: the last one whose top has passed 40% of the viewport
  const sections = links.map((a) => document.querySelector<HTMLElement>(a.hash)).filter(Boolean) as HTMLElement[];
  const movePill = (a: HTMLAnchorElement | null) => {
    if (!pill) return;
    pill.classList.toggle("is-on", !!a);
    if (!a) return;
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
    pill.style.width = `${a.offsetWidth}px`;
  };
  let current: HTMLAnchorElement | null = null;
  const spy = () => {
    const mark = innerHeight * 0.4;
    let active: HTMLAnchorElement | null = null;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= mark) active = links[i];
    });
    const contact = document.getElementById("contact");
    if (contact && contact.getBoundingClientRect().top <= mark) active = null;
    if (active === current) return;
    current = active;
    links.forEach((l) => l.setAttribute("aria-current", String(l === active)));
    movePill(active);
  };
  addEventListener("scroll", () => requestAnimationFrame(spy), { passive: true });
  addEventListener("resize", () => movePill(current));
  spy();

  const setOpen = (open: boolean) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    sheet.hidden = !open;
    document.documentElement.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  sheet.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia("(min-width: 961px)").addEventListener("change", (e) => e.matches && setOpen(false));
}
