/* Visible page numbers start at Motivation, excluding the title slide. */
(function () {
  function initialize() {
    const counter = document.createElement('div');
    counter.className = 'deck-page-number';
    counter.setAttribute('aria-label', 'Slide number');
    document.querySelector('.reveal').appendChild(counter);
    function update() {
      const slides = Reveal.getSlides();
      const first = slides.findIndex((slide) => slide.id === 'why-hard');
      const current = slides.indexOf(Reveal.getCurrentSlide());
      counter.hidden = first < 0 || current < first;
      counter.textContent = counter.hidden ? '' : String(current - first + 1);
    }
    Reveal.on('slidechanged', update);
    update();
  }
  function start() {
    if (!window.Reveal) return;
    if (Reveal.isReady()) initialize();
    else Reveal.on('ready', initialize);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
