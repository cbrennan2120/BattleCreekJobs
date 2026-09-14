(() => {
  "use strict";

  const TOTAL_SLIDES = 54;
  const SLIDE_DIRECTORY = "slides/09142026";

  const slideImage = document.getElementById("slide-image");
  const backButton = document.getElementById("back-button");
  const forwardButton = document.getElementById("forward-button");
  const slideStatus = document.getElementById("slide-status");

  let currentSlide = 1;

  function slidePath(slideNumber) {
    return `${SLIDE_DIRECTORY}/slide-${String(slideNumber).padStart(2, "0")}.png`;
  }

  function preloadSlide(slideNumber) {
    if (slideNumber < 1 || slideNumber > TOTAL_SLIDES) return;
    const image = new Image();
    image.decoding = "async";
    image.src = slidePath(slideNumber);
  }

  function renderSlide() {
    slideImage.src = slidePath(currentSlide);
    slideImage.alt = `Orientation slide ${currentSlide} of ${TOTAL_SLIDES}`;
    backButton.disabled = currentSlide === 1;
    forwardButton.disabled = currentSlide === TOTAL_SLIDES;
    slideStatus.textContent = `Slide ${currentSlide} of ${TOTAL_SLIDES}`;

    preloadSlide(currentSlide - 1);
    preloadSlide(currentSlide + 1);
  }

  function goBack() {
    if (currentSlide === 1) return;
    currentSlide -= 1;
    renderSlide();
  }

  function goForward() {
    if (currentSlide === TOTAL_SLIDES) return;
    currentSlide += 1;
    renderSlide();
  }

  backButton.addEventListener("click", goBack);
  forwardButton.addEventListener("click", goForward);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goBack();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goForward();
    }
  });

  preloadSlide(2);
})();
