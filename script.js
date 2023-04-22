'use strict';

const LINKS = {
  '.gh-svg': 'https://github.com/vahan-sahakyan',
  '.ln-svg': 'https://www.linkedin.com/in/vahan-sahakyan/',
};
Object.entries(LINKS).forEach(([element, url]) => {
  document.querySelector(element).addEventListener('click', event => {
    event.preventDefault();
    window.open(url);
  });
});

let clipboardTimer;
const message = document.querySelector('.clipboard-message');
['.email', '.phone'].forEach(el => {
  document.querySelector(el).addEventListener('click', function () {
    //

    navigator.clipboard.writeText(this.textContent.trim());

    message.textContent = `${
      el[1].toUpperCase() + el.slice(2)
    } Copied Successfully`;
    message.classList.remove('hidden');

    clearTimeout(clipboardTimer);
    clipboardTimer = setTimeout(function () {
      message.classList.add('hidden');
    }, 1600);
  });
});

///////////////////////
// DARK MODE
const setTheme = () => {
  const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  document.getElementById('dark-css').disabled = isLight;
};

setTheme();

window
  .matchMedia('(prefers-color-scheme: light)')
  .addEventListener('change', setTheme);

///////////////////////
// PDF MODE

let pdfMode = false;
function togglePdfMode() {
  document.getElementById('pdf-mode-css').disabled = pdfMode;
  pdfMode = !pdfMode;
}
let degree = 0;
function rotate(times = 1) {
  document.querySelector('.a4').style.transform = `rotate(${(degree +=
    90 * times)}deg)`;
}
///////////////////////

// togglePdfMode();
// rotate(3);
