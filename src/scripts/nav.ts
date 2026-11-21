// nav.ts - floating bar that hides on the way down, turns dark over dark sections, shows the name once the hero's
// id scrolls under it, underlines the current section, and runs the mobile sheet

export function initNav() {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;
  const navId = nav.querySelector<HTMLElement>("[data-nav-id]")!;
  const heroId = document.querySelector<HTMLElement>("[data-hero-id]");
  const toggle = nav.querySelector<HTMLButtonElement>("[data-nav-toggle]")!;
  const sheet = nav.querySelector<HTMLElement>("[data-nav-sheet]")!;
  const darks = [...document.querySelectorAll<HTMLElement>("[data-nav-dark]")];
  const links = [...nav.querySelectorAll<HTMLAnchorElement>(".nav-link")];

  let lastY = scrollY;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      // dark when the bar's middle line is over a dark section
      const line = nav.getBoundingClientRect().top + 38;
      nav.classList.toggle("on-dark", darks.some((d) => {
        const r = d.getBoundingClientRect();
        return r.top <= line && r.bottom >= line;
      }));
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
  };
  addEventListener("scroll", () => requestAnimationFrame(spy), { passive: true });
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
