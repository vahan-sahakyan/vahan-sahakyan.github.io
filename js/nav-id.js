// nav-id.js

// shows the name in the nav once the hero's name label scrolls under it
document.addEventListener("DOMContentLoaded", function () {
  const heroId = document.querySelector(".hs-id");
  const navId = document.querySelector(".nav-id");
  if (!heroId || !navId || !("IntersectionObserver" in window)) {
    return;
  }
  // "above the nav line" rather than "above 0", since the callback fires as the label crosses that line
  const observer = new IntersectionObserver(
    ([entry]) => {
      const navLine = entry.rootBounds ? entry.rootBounds.top : 0;
      navId.classList.toggle("is-visible", !entry.isIntersecting && entry.boundingClientRect.top < navLine);
    },
    { rootMargin: "-70px 0px 0px 0px" }
  );
  observer.observe(heroId);
});
