import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const rainMarkup = Array.from({ length: 16 }, (_, index) => {
  const offset = (index * 7) % 100;
  const delay = (index * 0.2).toFixed(1);
  const duration = (1.8 + (index % 5) * 0.2).toFixed(1);
  return `<span class="rain" style="--offset:${offset}%;--delay:${delay}s;--duration:${duration}s"></span>`;
}).join("");

const emberMarkup = Array.from({ length: 10 }, (_, index) => {
  const offset = 8 + (index * 9) % 84;
  const delay = (index * 0.55).toFixed(2);
  const drift = index % 2 === 0 ? -18 : 18;
  return `<span class="ember" style="--offset:${offset}%;--delay:${delay}s;--drift:${drift}px"></span>`;
}).join("");

app.innerHTML = `
  <main class="shell">
    <section class="hero">
        <div class="hero__atmosphere" aria-hidden="true">
        <div class="sun-wash"></div>
        <div class="moon"></div>
        <div class="moon-halo"></div>
        <div class="mist mist--back"></div>
        <div class="skyline skyline--far"></div>
        <div class="torii torii--left"></div>
        <div class="torii torii--right"></div>
        <div class="mist mist--front"></div>
        <div class="rainfield">${rainMarkup}</div>
        <div class="embers">${emberMarkup}</div>
        <div class="grain"></div>
      </div>

      <div class="hero__copy">
        <p class="eyebrow">Ink Counterplay</p>
        <h1 class="title">
          <span class="title__jp">月下ノ刃</span>
          <span class="title__en">GEKKA NO YAIBA</span>
        </h1>
        <p class="tagline">赤く灯った瞬間だけ、斬る。</p>

        <div class="hero__actions">
          <button class="button button--primary" type="button" data-action="trigger-demo">
            Draw
          </button>
        </div>
        <p class="microcopy">Tap / Click</p>
      </div>

      <div class="hero__stage">
        <div class="duel-stage" data-stage>
          <div class="duel-stage__hud">
            <span>INK / STEEL / TORII</span>
            <span>一太刀</span>
          </div>

          <div class="duel-stage__scene">
            <div class="platform"></div>
            <div class="fighter fighter--player">
              <div class="fighter__head"></div>
              <div class="fighter__body"></div>
              <div class="fighter__blade"></div>
            </div>
            <div class="fighter fighter--enemy">
              <div class="fighter__head"></div>
              <div class="fighter__body"></div>
              <div class="fighter__blade"></div>
            </div>
            <div class="warning-ring"></div>
            <div class="slash"></div>
            <div class="impact-kanji">一閃</div>
          </div>

          <div class="duel-stage__footer">
            <span class="status status--live">Live Demo Loop</span>
            <span class="status">赤で斬る</span>
          </div>
        </div>
      </div>
    </section>
  </main>
`;

const stage = document.querySelector<HTMLElement>("[data-stage]");
const triggerButton = document.querySelector<HTMLButtonElement>("[data-action='trigger-demo']");

if (!stage || !triggerButton) {
  throw new Error("Interactive demo elements were not found.");
}

let stageResetTimer = 0;

const runDemo = () => {
  stage.classList.remove("is-dueling");
  window.clearTimeout(stageResetTimer);
  void stage.offsetWidth;
  stage.classList.add("is-dueling");
  stageResetTimer = window.setTimeout(() => {
    stage.classList.remove("is-dueling");
  }, 2200);
};

runDemo();
window.setInterval(runDemo, 3600);

triggerButton.addEventListener("click", () => {
  runDemo();
  stage.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});
