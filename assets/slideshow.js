if (!customElements.get("m-slideshow")) {
  class MSlideshow extends HTMLElement {
    constructor() {
      super();

      this.slider = null;
      this.lastVideo = null;
      this.sliderContainer = null;
      this.evaraAnimation = null;
      this.evaraRafOne = null;
      this.evaraRafTwo = null;
      this.lastEvaraIndex = null;
      this._blockSelectHandler = this.onBlockSelect.bind(this);
    }

    connectedCallback() {
      if (this.slider) return;

      this.autoplay = this.dataset.autoplay === "true";
      this.autoplaySpeed = parseInt(this.dataset.autoplaySpeed, 10) || 5;
      this.showArrows = this.dataset.enableArrows === "true";
      this.showDots = this.dataset.enableDots === "true";
      this.adaptHeight = this.dataset.slideHeight === "adapt";
      this.id = this.dataset.id;
      this.paginationStyle = this.dataset.paginationStyle || "circle";
      this.sliderContainer = this.querySelector(".swiper-container");

      if (!this.sliderContainer || !window.MinimogLibs || !MinimogLibs.Swiper) return;

      this.initSlider();
      this.bindHoverAutoplay();

      if (typeof Shopify !== "undefined" && Shopify.designMode) {
        document.addEventListener("shopify:block:select", this._blockSelectHandler);
      }
    }


    disconnectedCallback() {
      if (typeof Shopify !== "undefined" && Shopify.designMode) {
        document.removeEventListener("shopify:block:select", this._blockSelectHandler);
      }

      this.pauseAllVideos();

      if (this.slider && typeof this.slider.destroy === "function") {
        this.slider.destroy(true, true);
      }

      this.slider = null;
    }

    getPaginationConfig() {
      const paginationEl = this.querySelector(".swiper-pagination");

      if (!this.showDots || !paginationEl) return false;

      const style = this.paginationStyle;

      if (style === "fraction-bar") {
        return {
          el: paginationEl,
          type: "custom",
          renderCustom(swiper, current, total) {
            const activeIndex =
              typeof swiper.realIndex === "number" ? swiper.realIndex + 1 : current;

            const safeTotal = total || 1;
            const progress = Math.max(0, Math.min(100, (activeIndex / safeTotal) * 100));
            const currentText = String(activeIndex).padStart(2, "0");
            const totalText = String(safeTotal).padStart(2, "0");

            return `
              <span class="m-pagination__fraction-current">${currentText}</span>
              <span class="m-pagination__progress" aria-hidden="true">
                <span class="m-pagination__progress-fill" style="width: ${progress}%"></span>
              </span>
              <span class="m-pagination__fraction-total">${totalText}</span>
            `;
          }
        };
      }

      return {
        el: paginationEl,
        clickable: true,
        type: "bullets",
        renderBullet: (index, className) => {
          const slideNumber = String(index + 1).padStart(2, "0");

          if (style === "number" || style === "floating-number") {
            return `<span class="${className}" aria-label="Go to slide ${index + 1}">${slideNumber}</span>`;
          }

          if (style === "dots-ring") {
            return `<span class="${className}" aria-label="Go to slide ${index + 1}"><span class="m-pagination__inner"></span></span>`;
          }

          if (style === "evara-progress") {
            return `
              <span class="${className}" aria-label="Go to slide ${index + 1}">
                <svg class="m-pagination__svg" viewBox="0 0 18 18" aria-hidden="true">
                  <circle class="m-pagination__track" cx="9" cy="9" r="7"></circle>
                  <circle class="m-pagination__progress-ring" cx="9" cy="9" r="7"></circle>
                </svg>
                <span class="m-pagination__inner" aria-hidden="true"></span>
              </span>
            `;
          }

          return `<span class="${className}" aria-label="Go to slide ${index + 1}"></span>`;
        }
      };
    }

    initSlider() {
      const slideCount = this.querySelectorAll(".swiper-slide").length;
      const canLoop = slideCount > 1;

      this.slider = new MinimogLibs.Swiper(this.sliderContainer, {
        init: false,
        slidesPerView: 1,
        slidesPerGroup: 1,
        loop: canLoop,
        effect: "fade",
        fadeEffect: {
          crossFade: true
        },
        speed: 1000,
        observer: true,
        observeParents: true,
        allowTouchMove: canLoop,

        autoplay:
          this.autoplay && canLoop
            ? {
                delay: this.autoplaySpeed * 1000,
                disableOnInteraction: false
              }
            : false,

        navigation:
          this.showArrows && canLoop
            ? {
                nextEl: this.querySelector(".m-slider-controls__button-next"),
                prevEl: this.querySelector(".m-slider-controls__button-prev")
              }
            : false,

        pagination: this.getPaginationConfig(),

        breakpoints: {
          992: {
            threshold: 2
          }
        },

        on: {
          init: (swiper) => {
            this.handleChange(swiper);

            if (this.paginationStyle === "evara-progress") {
              this.lastEvaraIndex = null;
              this.restartEvaraProgress();
            }

            setTimeout(() => {
              window.dispatchEvent(new Event("resize"));
            }, 100);
          }
        }
      });

      this.slider.on("slideChange", this.handleChange.bind(this));
      this.slider.init();
      const nextBtn = this.querySelector(".m-slider-controls__button-next");
      const prevBtn = this.querySelector(".m-slider-controls__button-prev");
      const paginationEl = this.querySelector(".swiper-pagination");

      [nextBtn, prevBtn, paginationEl].forEach((el) => {
        if (!el) return;

        el.addEventListener("click", () => {
          this.classList.remove("m-slideshow--paused");

          if (this.slider && this.slider.autoplay && typeof this.slider.autoplay.start === "function") {
            this.slider.autoplay.start();
          }
        });
      });
    }

    pauseAllVideos(exceptVideo = null) {
      this.querySelectorAll("video").forEach((video) => {
        if (video !== exceptVideo && !video.paused) {
          video.pause();
        }
      });
    }

    handleChange(swiper = this.slider) {
      if (!swiper || !swiper.slides || typeof swiper.activeIndex === "undefined") return;

      const activeSlide = swiper.slides[swiper.activeIndex];
      if (!activeSlide) return;

      const slideType = activeSlide.dataset.slideType;
      const activeVideo = activeSlide.querySelector("video");

      this.pauseAllVideos(activeVideo);

      if (slideType === "video_slide" && activeVideo) {
        activeVideo.muted = true;
        activeVideo.playsInline = true;

        const playPromise = activeVideo.play();

        if (playPromise && typeof playPromise.then === "function") {
          playPromise
            .then(() => {
              this.lastVideo = activeVideo;
            })
            .catch(() => {
              this.lastVideo = null;
            });
        }
      } else {
        this.lastVideo = null;
      }
      const realIndex =
        typeof swiper.realIndex === "number" ? swiper.realIndex : swiper.activeIndex;

      if (
        this.paginationStyle === "evara-progress" &&
        this.lastEvaraIndex !== realIndex
      ) {
        this.lastEvaraIndex = realIndex;
        this.restartEvaraProgress();
      }
    }

    onBlockSelect(event) {
      if (!this.slider || !event.target) return;

      const block = event.target.closest("[data-slide]");
      if (!block || !this.contains(block)) return;

      const index = Number(block.dataset.slide);
      if (Number.isNaN(index)) return;

      if (this.slider.autoplay && typeof this.slider.autoplay.stop === "function") {
        this.slider.autoplay.stop();
      }

      if (typeof this.slider.slideToLoop === "function") {
        this.slider.slideToLoop(index, 600, true);
      } else {
        this.slider.slideTo(index, 600, true);
      }
    }
    restartEvaraProgress() {
      if (this.paginationStyle !== "evara-progress") return;

      const pagination = this.querySelector(".m-pagination--evara-progress");
      if (!pagination) return;

      if (this.evaraAnimation) {
        this.evaraAnimation.cancel();
        this.evaraAnimation = null;
      }

      if (this.evaraRafOne) cancelAnimationFrame(this.evaraRafOne);
      if (this.evaraRafTwo) cancelAnimationFrame(this.evaraRafTwo);

      const allRings = pagination.querySelectorAll(".m-pagination__progress-ring");

      allRings.forEach((ring) => {
        ring.getAnimations().forEach((animation) => animation.cancel());
        ring.style.strokeDasharray = "44";
        ring.style.strokeDashoffset = "44";
      });

      this.evaraRafOne = requestAnimationFrame(() => {
        this.evaraRafTwo = requestAnimationFrame(() => {
          const activeRing = pagination.querySelector(
            ".swiper-pagination-bullet-active .m-pagination__progress-ring"
          );

          if (!activeRing) return;

          const duration = Math.max(1, this.autoplaySpeed || 5) * 1000;

          activeRing.getAnimations().forEach((animation) => animation.cancel());
          activeRing.style.strokeDasharray = "44";
          activeRing.style.strokeDashoffset = "44";

          activeRing.getBoundingClientRect();

          this.evaraAnimation = activeRing.animate(
            [
              { strokeDashoffset: "44" },
              { strokeDashoffset: "0" }
            ],
            {
              duration,
              easing: "linear",
              fill: "forwards"
            }
          );
        });
      });
    }

    pauseEvaraProgress() {
      if (this.evaraAnimation && typeof this.evaraAnimation.pause === "function") {
        this.evaraAnimation.pause();
      }
    }

    resumeEvaraProgress() {
      if (this.evaraAnimation && typeof this.evaraAnimation.play === "function") {
        this.evaraAnimation.play();
      }
    }
    bindHoverAutoplay() {
      if (!this.sliderContainer) return;

      this.sliderContainer.addEventListener("mouseenter", () => {
        this.classList.add("m-slideshow--paused");
        this.pauseEvaraProgress();

        if (this.slider && this.slider.autoplay) {
          if (typeof this.slider.autoplay.pause === "function") {
            this.slider.autoplay.pause();
          } else if (typeof this.slider.autoplay.stop === "function") {
            this.slider.autoplay.stop();
          }
        }
      });

      this.sliderContainer.addEventListener("mouseleave", () => {
        this.classList.remove("m-slideshow--paused");
        this.resumeEvaraProgress();

        if (this.slider && this.slider.autoplay) {
          if (typeof this.slider.autoplay.resume === "function") {
            this.slider.autoplay.resume();
          } else if (typeof this.slider.autoplay.start === "function") {
            this.slider.autoplay.start();
          }
        }
      });
    }
  }

  customElements.define("m-slideshow", MSlideshow);
}