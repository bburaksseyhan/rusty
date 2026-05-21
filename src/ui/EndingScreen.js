// ============================================================
//  EndingScreen — Chapter One feedback survey overlay.
//
//  Triggered by Game.js once Bolt's full dialogue finishes.
//  A single compact panel: short "Bölüm 1 Sonu" header above a
//  five-question feedback form. After submit (or skip), shows a
//  "Teşekkürler" beat and reloads the page back to the title.
//
//  Pure DOM. No game-loop coupling. Survey answers are passed to
//  the optional onSubmit callback — wire to a backend if needed.
// ============================================================

const SURVEY_QUESTIONS = [
  {
    id: "enjoyment",
    label: "Beğeni",
    type: "rating",
    max: 5,
  },
  {
    id: "continue",
    label: "2. Bölüm gelsin mi?",
    type: "yesno",
  },
  {
    id: "favourite",
    label: "En sevdiğin an",
    type: "choice",
    wide: true,
    options: [
      "USB kablo köprü",
      "Kupaya tırmanmak",
      "CRT bulmacası",
      "Pil atölyesi",
      "Bolt ile buluşma",
      "Etrafta dolaşmak",
    ],
  },
  {
    id: "feel",
    label: "Rusty'nin hikâyesi nasıl hissettirdi?",
    type: "choice",
    wide: true,
    options: ["Meraklı", "Nostaljik", "Umutlu", "Yalnız", "Huzurlu"],
  },
  {
    id: "comment",
    label: "Eklemek istediğin bir şey?",
    type: "text",
    wide: true,
    placeholder: "İsteğe bağlı — kısa bir not…",
  },
];

export class EndingScreen {
  constructor() {
    this._root      = null;
    this._onSubmit  = null;
    this._dismissed = false;
  }

  /**
   * Begin the closing sequence: fade in overlay + single survey
   * panel. There is intentionally only one panel — no separate
   * credits screen — to keep the closing flow short.
   * @param {(answers: Record<string, string|number>) => void} [onSubmit]
   *   Optional callback when the survey is submitted (or skipped).
   */
  show(onSubmit) {
    if (this._root) return; // idempotent
    this._onSubmit  = onSubmit ?? (() => {});
    this._dismissed = false;

    this._root = document.createElement("div");
    this._root.className = "ending-overlay";
    document.body.appendChild(this._root);

    this._renderSurvey();
  }

  /** Tear down the overlay (used after the survey is submitted). */
  dismiss() {
    if (!this._root || this._dismissed) return;
    this._dismissed = true;
    this._root.classList.add("ending-out");
    setTimeout(() => {
      this._root?.remove();
      this._root = null;
    }, 700);
  }

  // -----------------------------------------------------------
  //  Survey
  // -----------------------------------------------------------
  _renderSurvey() {
    if (!this._root || this._card) return;

    const card = document.createElement("div");
    card.className = "ending-survey-card";
    this._card = card;

    // Small cinematic eyebrow keeps the "End of Chapter" feel
    // without spawning a separate credits screen first.
    const eyebrow = document.createElement("div");
    eyebrow.className = "ending-survey-eyebrow";
    eyebrow.textContent = "Bölüm 1 Sonu";
    card.appendChild(eyebrow);

    const heading = document.createElement("div");
    heading.className = "ending-survey-heading";
    heading.textContent = "Geri bildirim";
    card.appendChild(heading);

    const lead = document.createElement("div");
    lead.className = "ending-survey-lead";
    lead.textContent = "Kısa bir form — sadece birkaç saniye.";
    card.appendChild(lead);

    const form = document.createElement("form");
    form.className = "ending-survey-form";

    const answers = {};

    SURVEY_QUESTIONS.forEach((q) => {
      const row = document.createElement("div");
      row.className = "survey-row" + (q.wide ? " survey-row-wide" : "");

      const label = document.createElement("label");
      label.className = "survey-label";
      label.textContent = q.label;
      row.appendChild(label);

      if (q.type === "rating")  this._buildRating(row, q, answers);
      if (q.type === "choice")  this._buildChoice(row, q, answers);
      if (q.type === "yesno")   this._buildYesNo(row, q, answers);
      if (q.type === "text")    this._buildText(row, q, answers);

      form.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "survey-actions";

    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "survey-btn survey-skip";
    skip.textContent = "Geç";
    skip.addEventListener("click", () => {
      this._onSubmit({ skipped: true });
      this._showThanks(true);
    });

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "survey-btn survey-submit";
    submit.textContent = "Gönder";

    actions.appendChild(skip);
    actions.appendChild(submit);
    form.appendChild(actions);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._onSubmit(answers);
      this._showThanks(false);
    });

    card.appendChild(form);
    this._root.appendChild(card);

    // Fade-in animation
    requestAnimationFrame(() => card.classList.add("visible"));
  }

  /**
   * Swap the survey card's contents for a short "Thank you" beat,
   * then return the user to the game's main page (title screen).
   * A full reload is the safest reset — it tears down audio,
   * Three.js resources, and replays the intro cleanly.
   */
  _showThanks(skipped) {
    if (!this._card || this._thanked) return;
    this._thanked = true;

    const card = this._card;
    card.classList.add("thanks-mode");
    card.innerHTML = "";

    const heading = document.createElement("div");
    heading.className = "ending-thanks-title";
    heading.textContent = "Teşekkürler";
    card.appendChild(heading);

    const sub = document.createElement("div");
    sub.className = "ending-thanks-sub";
    sub.textContent = skipped
      ? "Yine de geldiğin için. Ana sayfaya dönülüyor…"
      : "Geri bildirimin Kai'nin masasına ulaştı. Ana sayfaya dönülüyor…";
    card.appendChild(sub);

    const dots = document.createElement("div");
    dots.className = "ending-thanks-dots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    card.appendChild(dots);

    // Brief moment to let the user read, then back to title screen.
    setTimeout(() => {
      try { window.location.reload(); }
      catch { this.dismiss(); }
    }, 2200);
  }

  _buildRating(row, q, answers) {
    answers[q.id] = 0;
    const stars = document.createElement("div");
    stars.className = "survey-stars";
    for (let i = 1; i <= q.max; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.className = "survey-star";
      star.dataset.value = String(i);
      star.textContent = "★";
      star.addEventListener("click", () => {
        answers[q.id] = i;
        stars.querySelectorAll(".survey-star").forEach((s, idx) => {
          s.classList.toggle("active", idx < i);
        });
      });
      stars.appendChild(star);
    }
    row.appendChild(stars);
  }

  _buildChoice(row, q, answers) {
    const choices = document.createElement("div");
    choices.className = "survey-choices";
    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "survey-choice";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        answers[q.id] = opt;
        choices.querySelectorAll(".survey-choice").forEach((c) => {
          c.classList.toggle("active", c === btn);
        });
      });
      choices.appendChild(btn);
    });
    row.appendChild(choices);
  }

  _buildYesNo(row, q, answers) {
    const wrap = document.createElement("div");
    wrap.className = "survey-yesno";
    ["Yes, please", "Not for me"].forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "survey-choice";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        answers[q.id] = opt;
        wrap.querySelectorAll(".survey-choice").forEach((c) => {
          c.classList.toggle("active", c === btn);
        });
      });
      wrap.appendChild(btn);
    });
    row.appendChild(wrap);
  }

  _buildText(row, q, answers) {
    const input = document.createElement("textarea");
    input.className = "survey-text";
    input.placeholder = q.placeholder || "";
    input.rows = 3;
    input.addEventListener("input", () => {
      answers[q.id] = input.value;
    });
    row.appendChild(input);
  }
}
