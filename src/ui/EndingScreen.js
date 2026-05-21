// ============================================================
//  EndingScreen — Chapter One closing cinematic + feedback survey.
//
//  Triggered by Game.js once Bolt's full dialogue finishes:
//    1. Fade-to-black overlay + trailer-style credits roll.
//    2. Survey card (credits fade out first).
//    3. Thank-you beat → reload to title screen.
// ============================================================

const CREDITS_HOLD_MS = 6200;

const CREDIT_LINES = [
  { role: "YÖNETMEN",        name: "Masa Lambası"           },
  { role: "YAPIM",           name: "Kai (17, sevgili)"      },
  { role: "BAŞROL",          name: "RUSTY — anahtarlık robot" },
  { role: "OYUNCULAR",       name: "BOLT — ikinci ışık"     },
  { role: "DÜNYA",           name: "Three.js · WebGL"       },
  { role: "MÜZİK",           name: "Tek sıcak hücre"        },
  { role: "BEKLEME SÜRESİ",  name: "1.047 gece"             },
];

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
    this._credits   = null;
    this._card      = null;
    this._onSubmit  = null;
    this._dismissed = false;
    this._surveyTimer = null;
  }

  /**
   * @param {(answers: Record<string, string|number|boolean>) => void} [onSubmit]
   */
  show(onSubmit) {
    if (this._root) return;
    this._onSubmit  = onSubmit ?? (() => {});
    this._dismissed = false;
    this._thanked   = false;

    this._root = document.createElement("div");
    this._root.className = "ending-overlay";
    document.body.appendChild(this._root);

    this._renderCredits();
    this._surveyTimer = setTimeout(() => this._renderSurvey(), CREDITS_HOLD_MS);
  }

  dismiss() {
    if (this._surveyTimer) {
      clearTimeout(this._surveyTimer);
      this._surveyTimer = null;
    }
    if (!this._root || this._dismissed) return;
    this._dismissed = true;
    this._root.classList.add("ending-out");
    setTimeout(() => {
      this._root?.remove();
      this._root = null;
      this._card = null;
      this._credits = null;
    }, 700);
  }

  // -----------------------------------------------------------
  //  Credits (trailer-style roll)
  // -----------------------------------------------------------
  _renderCredits() {
    if (!this._root || this._credits) return;

    const credits = document.createElement("div");
    credits.className = "ending-credits";
    this._credits = credits;

    const title = document.createElement("div");
    title.className = "ending-title";
    title.textContent = "Bölüm 1 Sonu";
    credits.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "ending-subtitle";
    sub.textContent = "Masa";
    credits.appendChild(sub);

    const list = document.createElement("div");
    list.className = "ending-roll";
    CREDIT_LINES.forEach((line) => {
      const row = document.createElement("div");
      row.className = "ending-row";

      const role = document.createElement("span");
      role.className = "ending-role";
      role.textContent = line.role;

      const name = document.createElement("span");
      name.className = "ending-name";
      name.textContent = line.name;

      row.appendChild(role);
      row.appendChild(name);
      list.appendChild(row);
    });
    credits.appendChild(list);

    const thanks = document.createElement("div");
    thanks.className = "ending-thanks";
    thanks.textContent = "Kai'nin masasında bir gece daha geçti. Teşekkürler.";
    credits.appendChild(thanks);

    this._root.appendChild(credits);
  }

  // -----------------------------------------------------------
  //  Survey
  // -----------------------------------------------------------
  _renderSurvey() {
    if (!this._root || this._card) return;

    if (this._credits) {
      this._credits.classList.add("ending-credits-out");
      const el = this._credits;
      setTimeout(() => el.remove(), 700);
      this._credits = null;
    }

    const card = document.createElement("div");
    card.className = "ending-survey-card";
    this._card = card;

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

    requestAnimationFrame(() => card.classList.add("visible"));
  }

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
    ["Evet", "Hayır"].forEach((opt) => {
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
