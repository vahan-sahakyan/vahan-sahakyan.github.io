init();

function init() {
  updateTheme();
}
/// ////////////////////
// DARK MODE
onThemeChange(updateTheme);

// Updates the theme based on prefered color-scheme
function updateTheme() {
  const { matches: isLight } = themeMatchMedia();
  console.log(isLight);
  document.getElementById("light-css").disabled = !isLight;
}
function themeMatchMedia() {
  return window.matchMedia("(prefers-color-scheme: light)");
}

/** @param {() => void} handler */
function onThemeChange(handler) {
  themeMatchMedia().addEventListener("change", handler);
}
