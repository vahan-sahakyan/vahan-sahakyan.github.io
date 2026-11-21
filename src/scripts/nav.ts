// nav.ts - floating bar, always on screen: takes the color of the section under it, underlines the current section,
// and runs the mobile sheet

export function initNav() {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;
  const toggle = nav.querySelector<HTMLButtonElement>("[data-nav-toggle]")!;
  const sheet = nav.querySelector<HTMLElement>("[data-nav-sheet]")!;
  // the page-level block under a point: a section, the footer, or the page itself. its background, not whatever
  // card or image happens to sit there
  const blocks = "main > section, footer";
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const sectionAt = (x: number, y: number) => {
    const el = document
      .elementsFromPoint(x, y)
      .find((e) => !nav.contains(e))
      ?.closest<HTMLElement>(blocks);
    const c = el ? getComputedStyle(el).backgroundColor : pageBg;
    const m = c.match(/[\d.]+/g)!.map(Number);
    return { el, rgb: m.length > 3 && m[3] === 0 ? pageBg.match(/[\d.]+/g)!.map(Number) : m };
  };
  const links = [...nav.querySelectorAll<HTMLAnchorElement>(".nav-link")];

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      // sample just below the bar's middle
      const r = nav.querySelector(".nav-bar")!.getBoundingClientRect();
      const hit = sectionAt(r.left + r.width / 2, r.bottom + 2);
      const [R, G, B] = hit.rgb;
      nav.style.setProperty("--nav-under", `rgb(${R} ${G} ${B})`);
      const light = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255 > 0.5;
      const blue = !!hit.el?.classList.contains("blue");
      nav.classList.toggle("on-blue", !light && blue);
      nav.classList.toggle("on-dark", !light && !blue);
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
