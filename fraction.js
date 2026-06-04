(() => {
  const $ = (id) => document.getElementById(id);

  // ============================================================
  // CONFIG
  // ============================================================
  const CONFIG = {
    experimentID: "QgzXmzXwxYHB",
    nTrials: 10,
    bankSize: 50,
    allowMixedNumbers: true,
    feedbackMs: 1200,
    sonaRedirectURL: "", // optional; leave blank if not using SONA redirect
  };

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    participantId: null,
    startedAtISO: null,
    selectedProblems: [],
    trials: [],
    ratings: [],
    events: [],
    _eventIndex: 0,
    _trialIndex: 0,
    consent: null
  };

  // ============================================================
  // BASIC HELPERS
  // ============================================================
  function getURLParams() {
    const sp = new URLSearchParams(window.location.search);
    return {
      participantId: sp.get("id") || sp.get("PROLIFIC_PID") || crypto.randomUUID()
    };
  }

  function initStudy() {
    const { participantId } = getURLParams();
    state.participantId = participantId;
    state.startedAtISO = new Date().toISOString();
    logEvent("study_start", { participantId });
  }

  function logEvent(type, payload = {}) {
    state._eventIndex += 1;
    state.events.push({
      kind: "event",
      eventIndex: state._eventIndex,
      participantId: state.participantId,
      timestampISO: new Date().toISOString(),
      type,
      ...payload
    });
  }

  function now() {
    return performance.now();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function html(s) {
    const d = document.createElement("div");
    d.innerHTML = s;
    return d;
  }

  function clearContent() {
    $("content").innerHTML = "";
  }

  function render(node) {
    clearContent();
    $("content").appendChild(node);
  }

  function setHeader(text) {
    const el = $("subheader");
    if (el) el.textContent = text || "";
  }

  function setFooter(left = "", right = "") {
    const l = $("leftFooter");
    const r = $("rightFooter");
    if (l) l.textContent = left || "";
    if (r) r.textContent = right || "";
  }

  function waitForKey(allowedKeys) {
    return new Promise(resolve => {
      function onKey(e) {
        const key = String(e.key).toLowerCase();
        if (!allowedKeys.includes(key)) return;
        window.removeEventListener("keydown", onKey);
        resolve(key);
      }
      window.addEventListener("keydown", onKey);
    });
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================
  // EXACT FRACTION ARITHMETIC
  // ============================================================
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }
function rawFracHTML(n, d, forceFraction = false) {
  if (d === 1 && !forceFraction) return String(n);
  return `<span class="frac"><sup>${n}</sup>&frasl;<sub>${d}</sub></span>`;
}
  function frac(n, d = 1) {
    if (d === 0) throw new Error("Zero denominator");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function add(a, b) {
    return frac(a.n * b.d + b.n * a.d, a.d * b.d);
  }

  function sub(a, b) {
    return frac(a.n * b.d - b.n * a.d, a.d * b.d);
  }

  function mul(a, b) {
    return frac(a.n * b.n, a.d * b.d);
  }

  function div(a, b) {
    return frac(a.n * b.d, a.d * b.n);
  }

  function sameFrac(a, b) {
    return a && b && a.n === b.n && a.d === b.d;
  }

  function fracText(f) {
    if (!f) return "";
    if (f.d === 1) return String(f.n);
    return `${f.n}/${f.d}`;
  }

  function fracHTML(f) {
    if (!f) return "";
    if (f.d === 1) return String(f.n);
    return `<span class="frac"><sup>${f.n}</sup>&frasl;<sub>${f.d}</sub></span>`;
  }

  function parseFractionInput(raw) {
    const s = String(raw || "").trim();

    if (!s) {
      return { ok: false, error: "Please enter an answer." };
    }

    if (s.includes(".")) {
      return { ok: false, error: "Decimals are not allowed. Enter a whole number or fraction." };
    }

    // Whole number: 2, -3
    if (/^-?\d+$/.test(s)) {
      return {
        ok: true,
        value: frac(Number(s), 1),
        normalized: String(Number(s))
      };
    }

    // Fraction: 3/4, -3/4
    let m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
    if (m) {
      const n = Number(m[1]);
      const d = Number(m[2]);

      if (d === 0) {
        return { ok: false, error: "The denominator cannot be 0." };
      }

      const f = frac(n, d);
      return {
        ok: true,
        value: f,
        normalized: fracText(f)
      };
    }

    // Optional mixed number: 1 1/2, -1 1/2
    if (CONFIG.allowMixedNumbers) {
      m = s.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
      if (m) {
        const whole = Number(m[1]);
        const n = Number(m[2]);
        const d = Number(m[3]);

        if (d === 0) {
          return { ok: false, error: "The denominator cannot be 0." };
        }

        const sign = whole < 0 ? -1 : 1;
        const improper = frac(sign * (Math.abs(whole) * d + n), d);

        return {
          ok: true,
          value: improper,
          normalized: fracText(improper)
        };
      }
    }

    return {
      ok: false,
      error: CONFIG.allowMixedNumbers
        ? "Use a whole number, fraction, or mixed number, such as 2, 3/4, or 1 1/2."
        : "Use a whole number or fraction, such as 2 or 3/4."
    };
  }

  // ============================================================
  // PROBLEM BANK: 100 PROBLEMS ACROSS DIFFICULTY
  // ============================================================
  function F(n, d) {
    const f = frac(n, d);
    return { f, text: fracText(f), html: fracHTML(f) };
  }

  function P({ id, difficulty, steps, expressionText, expressionHTML, answer }) {
    return {
      id,
      difficulty,
      steps,
      expressionText,
      expressionHTML,
      correctNumerator: answer.n,
      correctDenominator: answer.d,
      correctText: fracText(answer)
    };
  }

  function generateProblemBank() {
  let id = 0;
  const bank = [];

  function opFunc(op) {
    if (op === "+") return add;
    if (op === "-") return sub;
    if (op === "*") return mul;
    if (op === "/") return div;
    throw new Error(`Unknown operator: ${op}`);
  }

  function opHTML(op) {
    if (op === "+") return "+";
    if (op === "-") return "−";
    if (op === "*") return "×";
    if (op === "/") return "÷";
    throw new Error(`Unknown operator: ${op}`);
  }

  function nextId() {
    id += 1;
    return `P${String(id).padStart(3, "0")}`;
  }

  function makeOne(difficulty, A, op, B) {
    const a = F(A[0], A[1]);
    const b = F(B[0], B[1]);
    const ans = opFunc(op)(a.f, b.f);

    bank.push(P({
      id: nextId(),
      difficulty,
      steps: 1,
      expressionText: `${a.text} ${op} ${b.text}`,
      expressionHTML: `${a.html} ${opHTML(op)} ${b.html}`,
      answer: ans
    }));
  }

  function makeTwo(difficulty, A, op1, B, op2, C) {
    const a = F(A[0], A[1]);
    const b = F(B[0], B[1]);
    const c = F(C[0], C[1]);

    const mid = opFunc(op1)(a.f, b.f);
    const ans = opFunc(op2)(mid, c.f);

    bank.push(P({
      id: nextId(),
      difficulty,
      steps: 2,
      expressionText: `(${a.text} ${op1} ${b.text}) ${op2} ${c.text}`,
      expressionHTML: `(${a.html} ${opHTML(op1)} ${b.html}) ${opHTML(op2)} ${c.html}`,
      answer: ans
    }));
  }

  function makeThreeChain(difficulty, A, op1, B, op2, C, op3, D) {
    const a = F(A[0], A[1]);
    const b = F(B[0], B[1]);
    const c = F(C[0], C[1]);
    const d = F(D[0], D[1]);

    const mid1 = opFunc(op1)(a.f, b.f);
    const mid2 = opFunc(op2)(mid1, c.f);
    const ans = opFunc(op3)(mid2, d.f);

    bank.push(P({
      id: nextId(),
      difficulty,
      steps: 3,
      expressionText: `((${a.text} ${op1} ${b.text}) ${op2} ${c.text}) ${op3} ${d.text}`,
      expressionHTML: `((${a.html} ${opHTML(op1)} ${b.html}) ${opHTML(op2)} ${c.html}) ${opHTML(op3)} ${d.html}`,
      answer: ans
    }));
  }

  function makeThreePair(difficulty, A, op1, B, opFinal, C, op2, D) {
    const a = F(A[0], A[1]);
    const b = F(B[0], B[1]);
    const c = F(C[0], C[1]);
    const d = F(D[0], D[1]);

    const left = opFunc(op1)(a.f, b.f);
    const right = opFunc(op2)(c.f, d.f);
    const ans = opFunc(opFinal)(left, right);

    bank.push(P({
      id: nextId(),
      difficulty,
      steps: 3,
      expressionText: `(${a.text} ${op1} ${b.text}) ${opFinal} (${c.text} ${op2} ${d.text})`,
      expressionHTML: `(${a.html} ${opHTML(op1)} ${b.html}) ${opHTML(opFinal)} (${c.html} ${opHTML(op2)} ${d.html})`,
      answer: ans
    }));
  }

  // ============================================================
  // EASY: 15 one-step problems
  // ============================================================
  makeOne("easy", [1, 2], "+", [1, 4]);
  makeOne("easy", [3, 5], "+", [1, 5]);
  makeOne("easy", [2, 3], "+", [1, 6]);
  makeOne("easy", [5, 6], "-", [1, 3]);
  makeOne("easy", [7, 8], "-", [1, 4]);
  makeOne("easy", [3, 4], "-", [1, 2]);
  makeOne("easy", [2, 3], "*", [3, 4]);
  makeOne("easy", [3, 5], "*", [5, 6]);
  makeOne("easy", [4, 7], "*", [7, 8]);
  makeOne("easy", [1, 2], "/", [1, 4]);
  makeOne("easy", [3, 4], "/", [1, 2]);
  makeOne("easy", [2, 3], "/", [1, 3]);
  makeOne("easy", [5, 6], "+", [1, 12]);
  makeOne("easy", [9, 10], "-", [2, 5]);
  makeOne("easy", [5, 8], "+", [1, 4]);

  // ============================================================
  // MEDIUM: 20 two-step problems
  // ============================================================
  makeTwo("medium", [2, 3], "+", [1, 4], "*", [3, 5]);
  makeTwo("medium", [5, 6], "-", [1, 3], "/", [2, 5]);
  makeTwo("medium", [3, 4], "+", [2, 5], "*", [4, 7]);
  makeTwo("medium", [7, 8], "-", [1, 2], "*", [5, 6]);
  makeTwo("medium", [1, 2], "+", [3, 8], "/", [4, 5]);
  makeTwo("medium", [4, 7], "+", [1, 2], "*", [7, 10]);
  makeTwo("medium", [9, 10], "-", [1, 5], "/", [5, 7]);
  makeTwo("medium", [5, 8], "+", [1, 4], "*", [4, 9]);
  makeTwo("medium", [11, 12], "-", [1, 6], "/", [3, 5]);
  makeTwo("medium", [2, 9], "+", [5, 6], "*", [3, 8]);
  makeTwo("medium", [13, 15], "-", [2, 5], "*", [9, 11]);
  makeTwo("medium", [5, 12], "+", [7, 18], "*", [6, 13]);
  makeTwo("medium", [7, 10], "-", [1, 5], "/", [4, 9]);
  makeTwo("medium", [3, 16], "+", [5, 12], "/", [8, 15]);
  makeTwo("medium", [19, 24], "-", [7, 12], "*", [3, 4]);
  makeTwo("medium", [5, 18], "+", [7, 9], "*", [9, 14]);
  makeTwo("medium", [14, 15], "-", [2, 3], "/", [3, 8]);
  makeTwo("medium", [1, 6], "+", [5, 8], "*", [9, 10]);
  makeTwo("medium", [5, 9], "-", [1, 6], "/", [7, 12]);
  makeTwo("medium", [7, 15], "+", [2, 9], "/", [5, 11]);

  // ============================================================
  // HARD: 15 three-step problems
  // ============================================================
  makeThreeChain("hard", [1, 2], "+", [1, 3], "*", [3, 4], "/", [2, 5]);
  makeThreePair("hard", [3, 4], "-", [1, 2], "*", [1, 3], "+", [1, 6]);
  makeThreeChain("hard", [2, 3], "+", [1, 4], "*", [6, 7], "/", [3, 5]);
  makeThreePair("hard", [5, 6], "-", [1, 4], "*", [2, 3], "+", [1, 6]);
  makeThreeChain("hard", [3, 4], "/", [2, 5], "-", [1, 3], "*", [3, 2]);
  makeThreeChain("hard", [7, 8], "-", [1, 2], "*", [5, 6], "+", [3, 10]);
  makeThreeChain("hard", [2, 9], "+", [5, 6], "*", [3, 8], "/", [1, 4]);
  makeThreeChain("hard", [17, 20], "-", [3, 10], "/", [2, 11], "-", [1, 5]);
  makeThreeChain("hard", [13, 15], "-", [2, 5], "*", [9, 11], "+", [3, 10]);
  makeThreeChain("hard", [5, 12], "+", [7, 18], "*", [6, 13], "/", [2, 9]);
  makeThreeChain("hard", [7, 10], "-", [1, 5], "/", [4, 9], "+", [1, 8]);
  makeThreeChain("hard", [3, 16], "+", [5, 12], "/", [8, 15], "-", [3, 5]);
  makeThreePair("hard", [19, 24], "-", [7, 12], "*", [3, 4], "+", [1, 6]);
  makeThreeChain("hard", [5, 18], "+", [7, 9], "*", [9, 14], "/", [1, 3]);
  makeThreeChain("hard", [14, 15], "-", [2, 3], "/", [3, 8], "+", [2, 9]);

  if (bank.length !== CONFIG.bankSize) {
    throw new Error(`Problem bank should contain ${CONFIG.bankSize} problems but contains ${bank.length}.`);
  }

  for (const p of bank) {
    if (p.correctDenominator <= 0) {
      throw new Error(`Bad denominator in ${p.id}`);
    }

    const g = gcd(p.correctNumerator, p.correctDenominator);

    if (g !== 1) {
      throw new Error(`Unreduced answer in ${p.id}`);
    }
  }

  return bank;
}

  // ============================================================
  // SCREENS
  // ============================================================
  async function consentScreen() {
  state.phase = "consent";
  setHeader("Consent Form");
  setFooter("", "");
  logEvent("consent_screen");

  render(html(`
    <div class="notice">
      <div><b>Welcome!</b></div>
      <div class="small">
        This study is conducted by the Department of Psychology at the University of Toronto Scarborough (UTSC).
        We are interested in how people solve fraction problems and evaluate their own performance.
      </div>

      <div class="hr"></div>

      <div><b>UNIVERSITY OF TORONTO SCARBOROUGH: INFORMED CONSENT STATEMENT</b></div>
      <div class="small">
        <b>Principal Investigator:</b> Dr. Michael Inzlicht, Professor<br>
        <b>Researcher:</b> Emily Zohar<br>
        <b>Project:</b> Fraction Problem Solving and Judgment
      </div>

      <div class="hr"></div>

      <div><b>Information</b></div>
      <div class="small">
        You are invited to participate in a research study. The purpose of this study is to understand how people solve fraction problems and how they judge the difficulty and achievability of those problems.
        In this study, you will complete a set of fraction problems. After each problem, you will be asked to rate how difficult and achievable the problem felt.
        The study will take approximately 30 minutes. You will receive <b>0.5 course credit</b> for your participation.
      </div>

      <div class="hr"></div>

      <div><b>Risks</b></div>
      <div class="small">
        There are no foreseeable risks involved in participating in this study beyond those encountered in everyday computer-based tasks. Some fraction problems may feel difficult or frustrating, but you may stop participating at any time.
      </div>

      <div class="hr"></div>

      <div><b>Benefits</b></div>
      <div class="small">
        There are no direct benefits to participation beyond compensation. The results may help researchers better understand mathematical problem solving and people’s judgments about their own performance.
      </div>

      <div class="hr"></div>

      <div><b>Confidentiality</b></div>
      <div class="small">
        Your responses will be kept confidential. Your research records will be assigned a code number rather than your name.
        The results of this study may be reported in conference presentations, journal articles, or other scientific reports.
        Individual participants will not be identified in any reports; only aggregated data will be reported.
        Data will be stored securely and accessed only by the research supervisor and authorized researchers.
      </div>

      <div class="hr"></div>

      <div><b>Compensation</b></div>
      <div class="small">
        You will receive <b>0.5 course credit</b> for participating. If you begin the study but choose to withdraw before completing it, you will still receive the available course credit.
        Once your anonymous responses have been submitted, they may not be withdrawable because they are not linked to identifying information.
      </div>

      <div class="hr"></div>

      <div><b>Contact</b></div>
      <div class="small">
        If you have questions about the study or procedures, you may contact Emily Zohar, the lead researcher,
        at <b>emily.zohar@mail.utoronto.ca</b>.
        <br><br>
        This project has been reviewed and approved by the University of Toronto Research Ethics Board.
        If you feel you have not been treated according to the descriptions in this form, or your rights as a participant in research have been violated, you may contact the University of Toronto Research Ethics Board at
        <b>ethics.review@utoronto.ca</b>.
      </div>

      <div class="hr"></div>

      <div><b>Participation</b></div>
      <div class="small">
        Your participation is completely voluntary. You may withdraw from the study at any time without penalty or loss of benefits to which you are entitled.
        You are also free to omit the answer to any question where possible.
      </div>

      <div class="hr"></div>

      <div><b>Feedback &amp; Publication</b></div>
      <div class="small">
        If you are interested in viewing the results of this study, please contact Emily Zohar at <b>
        <b>emily.zohar@mail.utoronto.ca</b>.
      </div>

      <div class="hr"></div>

      <div><b>Consent</b></div>
      <div class="small">
        By clicking “I agree,” you confirm that you have read and understood the above information and agree to participate in this study.
      </div>

      <div class="hr"></div>

      <div><b>Consent to Have Data Uploaded to a Research Database</b></div>
      <div class="small">
        By clicking “I agree,” you also agree to have your de-identified data made available in a research database that may be accessed by members of the scientific and psychological academic community.
        The shared data will not include personally identifiable information.
      </div>
    </div>

    <div class="row">
      <button id="btnConsentAgree" class="btn">I agree</button>
      <button id="btnConsentDisagree" class="btn">I disagree</button>
    </div>
  `));

  const agreed = await new Promise(resolve => {
    $("btnConsentAgree").onclick = () => resolve(true);
    $("btnConsentDisagree").onclick = () => resolve(false);
  });

  state.consent = {
    kind: "consent",
    participantId: state.participantId,
    timestampISO: new Date().toISOString(),
    agreed: agreed ? 1 : 0
  };

  logEvent("consent_response", { agreed: agreed ? 1 : 0 });

  return agreed;
}
  async function instructionsScreen() {
    state.phase = "instructions";
    setHeader("Instructions");
    setFooter("", "");
    logEvent("instructions_screen");

    render(html(`
      <div class="notice">
        <div><b>Fraction task</b></div>
        <div class="small">
          You will complete <b>${CONFIG.nTrials} fraction problems</b>. Type your answer as a fraction or whole number.
          <br><br>
          <b>Do not enter decimals.</b> For example, enter <b>1/2</b>, not <b>0.5</b>.
        </div>
        <div class="hr"></div>

        <div><b>Addition &amp; Subtraction</b></div>
        <div class="small">
          To add or subtract fractions, first find a common denominator. Convert each fraction so they have
          the same denominator, then add or subtract the numerators.
          <br>
          Example: ${fracHTML(frac(3,5))} + ${fracHTML(frac(1,4))} = ${rawFracHTML(12,20)} + ${rawFracHTML(5,20)} = ${rawFracHTML(17,20)}
        </div>
        <div class="hr"></div>

        <div><b>Multiplication</b></div>
<div class="small">
  Multiply the numerators together and multiply the denominators together.
  <br>
  Example: ${fracHTML(frac(2,3))} × ${fracHTML(frac(1,2))} = ${rawFracHTML(2,6)} = ${fracHTML(frac(1,3))}
</div>
<div class="hr"></div>

<div><b>Division</b></div>
<div class="small">
  To divide fractions, multiply by the reciprocal: flip the second fraction.
  <br>
  Example: ${fracHTML(frac(1,2))} ÷ ${fracHTML(frac(1,4))} = ${fracHTML(frac(1,2))} × ${rawFracHTML(4,1,true)} = ${rawFracHTML(4,2)} = 2
</div>
</div>
      <div class="row"><button id="btnStart" class="btn">Start</button></div>
    `));

    await new Promise(resolve => {
      $("btnStart").onclick = resolve;
    });
  }
function safeCalculatorEval(expr) {
  const cleaned = String(expr || "")
    .replace(/\s/g, "")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .trim();

  if (!cleaned) {
    return { ok: false, error: "Enter one calculation." };
  }

  // Whole-number-only, single-operation calculator.
  // Allows: 7+4, 10-3, 6*8, 20÷5
  // Rejects: fractions, decimals, brackets, and multiple operations.
  const m = cleaned.match(/^(\d+)([+\-*÷])(\d+)$/);

  if (!m) {
    return {
      ok: false,
      error: "Enter one whole-number calculation only, e.g., 7+4 or 20÷5."
    };
  }

  const left = Number(m[1]);
  const op = m[2];
  const right = Number(m[3]);

  let result;

  if (op === "+") result = left + right;
  if (op === "-") result = left - right;
  if (op === "*") result = left * right;
  if (op === "÷") {
    if (right === 0) {
      return { ok: false, error: "Cannot divide by 0." };
    }
    result = left / right;
  }

  if (!Number.isFinite(result)) {
    return { ok: false, error: "Invalid calculation." };
  }

  return { ok: true, result };
}

function attachCalculatorHandlers() {
  const calcInput = $("calcInput");
  const calcResult = $("calcResult");
  const calcBtn = $("btnCalc");
  const calcClear = $("btnCalcClear");

  if (!calcInput || !calcResult || !calcBtn || !calcClear) return;

  function calculate() {
    const out = safeCalculatorEval(calcInput.value);

    if (!out.ok) {
      calcResult.innerHTML = `<span class="bad">${escapeHTML(out.error)}</span>`;
      return;
    }

    calcResult.innerHTML = `<b>${escapeHTML(String(out.result))}</b>`;
  }

  calcBtn.onclick = calculate;

  calcClear.onclick = () => {
    calcInput.value = "";
    calcResult.textContent = "";
    calcInput.focus();
  };

  calcInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      calculate();
    }
  });

  const calcKeys = Array.from(document.querySelectorAll("[data-calc-key]"));

  calcKeys.forEach(btn => {
    btn.onclick = () => {
      calcInput.value += btn.getAttribute("data-calc-key");
      calcInput.focus();
    };
  });
}
function showCalculatorPanel() {
  let panel = document.getElementById("calculatorPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "calculatorPanel";
    panel.className = "calculator-panel-fixed";
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="calc-title"><b>Calculator</b></div>
    <div class="small subtle calc-instructions">
      Scratch calculations. Final answers must be fractions or whole numbers.
    </div>

<input id="calcInput" class="input calc-input" autocomplete="off" placeholder="e.g., 7+4" />
  <div class="calc-grid">
  <button type="button" class="calc-key" data-calc-key="7">7</button>
  <button type="button" class="calc-key" data-calc-key="8">8</button>
  <button type="button" class="calc-key" data-calc-key="9">9</button>
  <button type="button" class="calc-key" data-calc-key="÷">÷</button>

  <button type="button" class="calc-key" data-calc-key="4">4</button>
  <button type="button" class="calc-key" data-calc-key="5">5</button>
  <button type="button" class="calc-key" data-calc-key="6">6</button>
  <button type="button" class="calc-key" data-calc-key="*">×</button>

  <button type="button" class="calc-key" data-calc-key="1">1</button>
  <button type="button" class="calc-key" data-calc-key="2">2</button>
  <button type="button" class="calc-key" data-calc-key="3">3</button>
  <button type="button" class="calc-key" data-calc-key="-">−</button>

  <button type="button" class="calc-key" data-calc-key="0">0</button>
  <button type="button" class="calc-key" data-calc-key="+">+</button>
  <button type="button" id="btnCalcClear" class="calc-key">clear</button>
  <button type="button" id="btnCalc" class="calc-key">=</button>
</div>

    <div class="calc-output">
      <div class="small subtle">Result</div>
      <div id="calcResult" class="calc-result"></div>
    </div>
  `;
}

function hideCalculatorPanel() {
  const panel = document.getElementById("calculatorPanel");
  if (panel) panel.remove();
}
  async function runFractionTrial(problem, trialNumber) {
    state.phase = "fraction_task";
    state._trialIndex += 1;

    setHeader(`Problem ${trialNumber} of ${CONFIG.nTrials}`);
    setFooter("Fractions or whole numbers only", "No decimals");

    const t0 = now();

    logEvent("trial_start", {
      trialIndex: state._trialIndex,
      problemId: problem.id,
      difficulty: problem.difficulty,
      steps: problem.steps
    });

  render(html(`
  <div class="fraction-main">
    <div class="row">
      <div class="pill">Problem ${trialNumber} / ${CONFIG.nTrials}</div>
      <div class="pill">${escapeHTML(problem.difficulty)}</div>
    </div>

    <div class="notice">
      <div class="small subtle">Calculate:</div>
      <div class="math problem-text">${problem.expressionHTML}</div>
    </div>

    <div class="notice">
      <div class="small"><b>Your answer</b></div>
      <input id="answerBox" class="input" autocomplete="off" placeholder="e.g., 3/4 or 2" />
      <div id="answerErr" class="small bad" style="display:none;margin-top:8px"></div>
    </div>

    <div class="row">
      <button id="btnSubmitAnswer" class="btn">Submit answer</button>
    </div>
  </div>
`));

showCalculatorPanel();
attachCalculatorHandlers();

    const answerBox = $("answerBox");
    const answerErr = $("answerErr");

    answerBox.focus();

    answerBox.addEventListener("keydown", (e) => {
      if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", " ", "/", "-"].includes(e.key)) {
        return;
      }

      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
    });

    const answerRaw = await new Promise(resolve => {
      function submit() {
        const parsed = parseFractionInput(answerBox.value);

        if (!parsed.ok) {
          answerErr.style.display = "block";
          answerErr.textContent = parsed.error;
          return;
        }

        resolve(answerBox.value);
      }

      $("btnSubmitAnswer").onclick = submit;

      answerBox.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          submit();
        }
      });
    });

    const rtMs = Math.round(now() - t0);
    const parsed = parseFractionInput(answerRaw);
    const correctFrac = frac(problem.correctNumerator, problem.correctDenominator);
    const correct = sameFrac(parsed.value, correctFrac);

    const trialRow = {
  kind: "fraction_trial",
  participantId: state.participantId,
  trialIndex: state._trialIndex,
  timestampISO: new Date().toISOString(),

  problemId: problem.id,
  trialNumber,
  difficulty: problem.difficulty,
  steps: problem.steps,

  // Use plain ASCII math for CSV so Excel does not mangle symbols like −, ×, ÷
  expressionText: asciiMathText(problem.expressionText),

  // Raw fraction text for analysis / R
  correctTextRaw: problem.correctText,

  // Excel-safe display version so 3/10 does not become 10-Mar
  correctTextExcel: excelText(problem.correctText),

  // Best columns for analysis
  correctNumerator: problem.correctNumerator,
  correctDenominator: problem.correctDenominator,

  // Participant response
  responseRaw: String(answerRaw || "").trim(),
  responseRawExcel: excelText(String(answerRaw || "").trim()),

  responseNormalizedRaw: parsed.normalized,
  responseNormalizedExcel: excelText(parsed.normalized),

  responseNumerator: parsed.value.n,
  responseDenominator: parsed.value.d,

  correct: correct ? 1 : 0,
  responseRTms: rtMs
};

    state.trials.push(trialRow);

    logEvent("answer_submitted", {
      trialIndex: state._trialIndex,
      problemId: problem.id,
      correct: correct ? 1 : 0,
      responseRTms: rtMs
    });

    await showFeedback(problem, correct, parsed.normalized);
    await runLikertRatings(problem, trialNumber, state._trialIndex);

    return trialRow;
  }

  async function runLikertRatings(problem, trialNumber, trialIndex) {
    hideCalculatorPanel();
    const difficultyRating = await likertScreen({
      construct: "subjective_difficulty",
      question: "How difficult was that problem?",
      left: "1 = Not at all difficult",
      right: "7 = Extremely difficult",
      problem,
      trialNumber
    });

    const achievabilityRating = await likertScreen({
      construct: "achievability",
      question: "How achievable did that problem feel?",
      left: "1 = Not at all achievable",
      right: "7 = Extremely achievable",
      problem,
      trialNumber
    });

    const rec = {
      kind: "fraction_rating",
      participantId: state.participantId,
      timestampISO: new Date().toISOString(),
      trialIndex,
      trialNumber,
      problemId: problem.id,
      difficulty: problem.difficulty,
      steps: problem.steps,
      subjectiveDifficulty: difficultyRating,
      achievability: achievabilityRating
    };

    state.ratings.push(rec);

    logEvent("ratings_complete", {
      trialIndex,
      problemId: problem.id,
      subjectiveDifficulty: difficultyRating,
      achievability: achievabilityRating
    });

    return rec;
  }

  function redirectToSONA() {
  window.location.href =
    `https://utscpsych.sona-systems.com/webstudy_credit.aspx?experiment_id=1317&credit_token=d4d36918ef934798be0bf69a79e33722&survey_code=${state.participantId}`;
}
  async function likertScreen({ construct, question, left, right, problem, trialNumber }) {
    setHeader(`Rating ${trialNumber} of ${CONFIG.nTrials}`);
    setFooter("Use number keys 1–7", "");

    render(html(`
      <div class="notice">
        <div><b>${escapeHTML(question)}</b></div>
        <div class="small subtle">Press a number key from 1 to 7.</div>
        <div class="hr"></div>
        <div class="small subtle">Previous problem:</div>
        <div class="math">${problem.expressionHTML}</div>
      </div>
      <div class="row" style="justify-content:space-between;gap:6px;">
        <div class="pill">1</div>
        <div class="pill">2</div>
        <div class="pill">3</div>
        <div class="pill">4</div>
        <div class="pill">5</div>
        <div class="pill">6</div>
        <div class="pill">7</div>
      </div>
      <div class="row" style="justify-content:space-between;">
        <div class="small subtle">${escapeHTML(left)}</div>
        <div class="small subtle">${escapeHTML(right)}</div>
      </div>
    `));

    const key = await waitForKey(["1", "2", "3", "4", "5", "6", "7"]);
    const rating = parseInt(key, 10);

    logEvent("likert_response", {
      construct,
      problemId: problem.id,
      trialNumber,
      rating
    });

    return rating;
  }

  async function showFeedback(problem, correct, responseText) {
    hideCalculatorPanel();
    setHeader("Feedback");
    setFooter("", "");

    render(html(`
      <div class="notice">
        ${correct ? `<div class="good"><b>Correct</b></div>` : `<div class="bad"><b>Incorrect</b></div>`}
        <div class="small">
          Your answer: <b>${escapeHTML(responseText)}</b><br>
          Correct answer: <b>${escapeHTML(problem.correctText)}</b>
        </div>
      </div>
    `));

    await wait(CONFIG.feedbackMs);
  }

  async function runTask() {
    const bank = generateProblemBank();

    state.problemBankSize = bank.length;
    state.selectedProblems = shuffledCopy(bank).slice(0, CONFIG.nTrials);

    logEvent("problem_sampled", {
      nTrials: CONFIG.nTrials,
      bankSize: bank.length,
      problemIds: state.selectedProblems.map(p => p.id).join(";")
    });

    for (let i = 0; i < state.selectedProblems.length; i++) {
      await runFractionTrial(state.selectedProblems[i], i + 1);
    }
  }
function asciiMathText(s) {
  return String(s ?? "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\u00A0/g, " ");
}

// For fields that Excel might interpret as dates, e.g., 3/10.
// This makes Excel display the fraction as text.
function excelText(s) {
  const v = String(s ?? "");
  if (v === "") return "";
  return `="${v.replace(/"/g, '""')}"`;
}
  // ============================================================
  // CSV + DATAPIPE
  // ============================================================
  function flattenForCSV() {
    const rows = [];

    rows.push({
      kind: "meta",
      participantId: state.participantId,
      startedAtISO: state.startedAtISO,
      exportedAtISO: new Date().toISOString(),
      nTrials: CONFIG.nTrials,
      bankSize: CONFIG.bankSize,
      selectedProblemIds: state.selectedProblems.map(p => p.id).join(";")
    });

     if (state.consent) {
    rows.push(state.consent);
  }

    for (const e of state.events) {
      rows.push(e);
    }

    for (const t of state.trials) {
      rows.push(t);
    }

    for (const r of state.ratings) {
      rows.push(r);
    }

    return rows;
  }

  function toCSV(rows) {
    if (!rows || rows.length === 0) return "";

    const headerSet = new Set();

    rows.forEach(r => {
      Object.keys(r).forEach(k => headerSet.add(k));
    });

    const preferred = [
      "kind",
      "participantId",
      "timestampISO",
      "agreed",
      "eventIndex",
      "type",
      "trialIndex",
      "trialNumber",
      "problemId",
      "difficulty",
      "steps",
      "expressionText",
      "correctTextRaw",
"correctTextExcel",
"correctNumerator",
"correctDenominator",
"responseRaw",
"responseRawExcel",
"responseNormalizedRaw",
"responseNormalizedExcel",
"responseNumerator",
"responseDenominator",
      "correct",
      "responseRTms",
      "subjectiveDifficulty",
      "achievability",
      "nTrials",
      "bankSize",
      "selectedProblemIds",
      "startedAtISO",
      "exportedAtISO"
    ];

    const headers = [
      ...preferred.filter(h => headerSet.has(h)),
      ...Array.from(headerSet).filter(h => !preferred.includes(h))
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s)
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    return "\uFEFF" + [
  headers.join(","),
  ...rows.map(r => headers.map(h => esc(r[h])).join(","))
].join("\n");
  }

  async function saveCSVToPipe({ experimentID, filename, csvString }) {
    const res = await fetch("https://pipe.jspsych.org/api/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experimentID,
        filename,
        data: csvString
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Pipe save failed: ${res.status} ${res.statusText} ${txt}`);
    }

    return res.json().catch(() => ({}));
  }

  function downloadText(filename, text, mime = "text/csv") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  async function endScreen() {
    state.phase = "end";
    setHeader("Finished");
    setFooter("", "");

    const filename = `fraction-task-sub-${state.participantId}-${Date.now()}.csv`;
    const csvString = toCSV(flattenForCSV());

    render(html(`
      <div class="notice">
        <div><b>Saving your data…</b></div>
        <div class="small">Please do not close this window.</div>
      </div>
    `));

    try {
      await saveCSVToPipe({
        experimentID: CONFIG.experimentID,
        filename,
        csvString
      });

      render(html(`
        <div class="notice">
          <div class="good"><b>Saved.</b></div>
          <div class="small subtle">${escapeHTML(filename)}</div>
        </div>
      `));

      await wait(600);

     redirectToSONA();
    } catch (e) {
      console.error(e);

      const errorMessage = e instanceof Error ? e.message : String(e);
      const rows = flattenForCSV();

      rows.push({
        kind: "save_error",
        participantId: state.participantId,
        timestampISO: new Date().toISOString(),
        errorMessage
      });

      const csvWithError = toCSV(rows);

      render(html(`
        <div class="notice">
          <div class="bad"><b>Upload failed.</b></div>
          <div class="small">The task is complete, but the data upload did not work.</div>
          <div class="hr"></div>
          <div class="small"><b>Error:</b> ${escapeHTML(errorMessage)}</div>
          <div class="hr"></div>
          <div class="small">Please download the CSV and send it to the researcher.</div>
        </div>
        <div class="row"><button id="btnCsv" class="btn">Download CSV</button></div>
      `));

      $("btnCsv").onclick = () => {
        downloadText(filename, csvWithError, "text/csv");
      };
    }
  }

  async function endNoConsentScreen() {
  state.phase = "end_no_consent";
  setHeader("Finished");
  setFooter("", "");

  render(html(`
    <div class="notice">
      <div><b>You did not consent to participate.</b></div>
      <div class="small">
        You will now be redirected for course credit.
      </div>
    </div>
  `));

  await wait(800);
  redirectToSONA();
}
  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
  initStudy();

  const agreed = await consentScreen();

  if (!agreed) {
    await endNoConsentScreen();
    return;
  }

  await instructionsScreen();
  await runTask();
  await endScreen();
}

  boot();
})();