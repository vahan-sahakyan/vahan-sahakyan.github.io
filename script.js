'use strict';

const copyToClipboard = element => {
  let range = document.createRange();
  range.selectNode(document.querySelector(element));
  window.getSelection().removeAllRanges(); // clear current selection
  window.getSelection().addRange(range); // to select text
  document.execCommand('copy');
  window.getSelection().removeAllRanges(); // to deselect
};
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
    copyToClipboard(el);

    message.textContent = `${el[1].toUpperCase() + el.slice(2)} Copied Successfully`;
    message.classList.remove('hidden');

    clearTimeout(clipboardTimer);
    clipboardTimer = setTimeout(function () {
      message.classList.add('hidden');
    }, 1600);
  });
});

// DARK MODE
const setTheme = () => {
  const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  document.getElementById('dark-css').disabled = isLight;
};

setTheme();

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', setTheme);

///////////////////////
