(() => {
  const $ = (id) => document.getElementById(id);

  // ============================================================
  // CONFIG
  // ============================================================
  const CONFIG = {
    experimentID: "QgzXmzXwxYHB",
    nTrials: 1,
    bankSize: 100,
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
    _trialIndex: 0
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

    const oneStepPairs = [
      [3,5,1,4,"+"], [5,6,1,3,"-"], [2,3,4,5,"*"], [3,4,2,3,"/"],
      [7,8,1,4,"-"], [3,5,10,9,"*"], [5,6,2,3,"/"], [11,12,1,6,"+"],
      [4,7,2,3,"+"], [9,10,3,5,"-"], [5,8,4,15,"*"], [7,9,14,27,"/"],
      [1,2,3,8,"+"], [13,15,2,5,"-"], [6,11,22,9,"*"], [8,9,4,3,"/"],
      [5,12,7,18,"+"], [7,10,1,5,"-"], [9,14,7,18,"*"], [15,16,5,8,"/"],
      [2,9,5,6,"+"], [17,20,3,10,"-"], [11,12,6,7,"*"], [10,21,5,14,"/"],
      [3,16,5,12,"+"], [19,24,7,12,"-"], [8,15,25,16,"*"], [9,20,3,10,"/"],
      [5,18,7,9,"+"], [14,15,2,3,"-"], [3,11,22,15,"*"], [7,12,14,9,"/"],
      [1,6,5,8,"+"], [5,9,1,6,"-"], [4,13,26,21,"*"], [6,7,9,14,"/"],
      [7,15,2,9,"+"], [11,18,1,3,"-"], [5,6,9,10,"*"], [4,5,2,15,"/"]
    ];

    for (const [a,b,c,d,op] of oneStepPairs) {
      const x = F(a,b);
      const y = F(c,d);

      let ans;
      let symbol;

      if (op === "+") {
        ans = add(x.f, y.f);
        symbol = "+";
      }

      if (op === "-") {
        ans = sub(x.f, y.f);
        symbol = "−";
      }

      if (op === "*") {
        ans = mul(x.f, y.f);
        symbol = "×";
      }

      if (op === "/") {
        ans = div(x.f, y.f);
        symbol = "÷";
      }

      id += 1;

      bank.push(P({
        id: `F${String(id).padStart(3, "0")}`,
        difficulty: op === "+" || op === "-" ? "easy" : "easy-medium",
        steps: 1,
        expressionText: `${x.text} ${symbol} ${y.text}`,
        expressionHTML: `${x.html} ${symbol} ${y.html}`,
        answer: ans
      }));
    }

    const twoStep = [
      [[2,3],[1,4],"+",[3,5],"*"], [[5,6],[1,3],"-",[2,5],"/"],
      [[3,4],[2,5],"+",[4,7],"*"], [[7,8],[1,2],"-",[5,6],"*"],
      [[3,4],[2,3],"+",[6,7],"*"], [[7,9],[1,3],"-",[2,5],"/"],
      [[5,8],[1,4],"+",[4,9],"*"], [[11,12],[1,6],"-",[3,5],"/"],
      [[4,7],[1,2],"+",[7,10],"*"], [[9,10],[1,5],"-",[5,7],"/"],
      [[2,9],[5,6],"+",[3,8],"*"], [[17,20],[3,10],"-",[2,11],"/"],
      [[1,2],[3,8],"+",[4,5],"/"], [[13,15],[2,5],"-",[9,11],"*"],
      [[5,12],[7,18],"+",[6,13],"*"], [[7,10],[1,5],"-",[4,9],"/"],
      [[3,16],[5,12],"+",[8,15],"/"], [[19,24],[7,12],"-",[3,4],"*"],
      [[5,18],[7,9],"+",[9,14],"*"], [[14,15],[2,3],"-",[3,8],"/"],
      [[1,6],[5,8],"+",[9,10],"*"], [[5,9],[1,6],"-",[7,12],"/"],
      [[7,15],[2,9],"+",[5,11],"/"], [[11,18],[1,3],"-",[6,7],"*"],
      [[4,5],[2,15],"+",[3,7],"/"], [[8,9],[1,6],"-",[2,3],"*"],
      [[5,7],[3,14],"+",[7,9],"*"], [[9,11],[2,3],"-",[11,15],"/"],
      [[3,10],[7,12],"+",[5,8],"*"], [[11,16],[1,8],"-",[4,5],"/"]
    ];

    for (const [A, B, op1, C, op2] of twoStep) {
      const a = F(A[0], A[1]);
      const b = F(B[0], B[1]);
      const c = F(C[0], C[1]);

      const mid = op1 === "+" ? add(a.f, b.f) : sub(a.f, b.f);
      const ans = op2 === "*" ? mul(mid, c.f) : div(mid, c.f);

      const s1 = op1 === "+" ? "+" : "−";
      const s2 = op2 === "*" ? "×" : "÷";

      id += 1;

      bank.push(P({
        id: `F${String(id).padStart(3, "0")}`,
        difficulty: "medium",
        steps: 2,
        expressionText: `(${a.text} ${s1} ${b.text}) ${s2} ${c.text}`,
        expressionHTML: `(${a.html} ${s1} ${b.html}) ${s2} ${c.html}`,
        answer: ans
      }));
    }

    const threeStep = [
      [[1,2],[1,3],"+",[3,4],"*",[2,5],"/"],
      [[3,4],[1,2],"-",[1,3],[1,6],"+","*"],
      [[2,3],[1,4],"+",[6,7],"*",[3,5],"/"],
      [[1,2],[3,5],"*",[2,3],[3,4],"*","+"],
      [[5,6],[1,4],"-",[2,3],[1,6],"+","*"],
      [[3,4],[2,5],"/",[1,3],[3,2],"*","-"],
      [[7,8],[1,2],"-",[5,6],"*",[3,10],"+"],
      [[2,9],[5,6],"+",[3,8],"*",[1,4],"/"],
      [[17,20],[3,10],"-",[2,11],"/",[1,5],"-"],
      [[13,15],[2,5],"-",[9,11],"*",[3,10],"+"],
      [[5,12],[7,18],"+",[6,13],"*",[2,9],"/"],
      [[7,10],[1,5],"-",[4,9],"/",[1,8],"+"],
      [[3,16],[5,12],"+",[8,15],"/",[3,5],"-"],
      [[19,24],[7,12],"-",[3,4],"*",[1,6],"+"],
      [[5,18],[7,9],"+",[9,14],"*",[1,3],"/"],
      [[14,15],[2,3],"-",[3,8],"/",[2,9],"+"],
      [[1,6],[5,8],"+",[9,10],"*",[1,7],"/"],
      [[5,9],[1,6],"-",[7,12],"/",[1,4],"+"],
      [[7,15],[2,9],"+",[5,11],"/",[3,10],"-"],
      [[11,18],[1,3],"-",[6,7],"*",[5,12],"+"],
      [[4,5],[2,15],"+",[3,7],"/",[2,9],"-"],
      [[8,9],[1,6],"-",[2,3],"*",[5,18],"+"],
      [[5,7],[3,14],"+",[7,9],"*",[1,2],"/"],
      [[9,11],[2,3],"-",[11,15],"/",[1,6],"+"],
      [[3,10],[7,12],"+",[5,8],"*",[1,9],"/"],
      [[11,16],[1,8],"-",[4,5],"/",[2,7],"+"],
      [[2,5],[3,10],"+",[5,6],"/",[1,4],"-"],
      [[7,12],[1,8],"+",[9,10],"*",[3,5],"/"],
      [[5,9],[2,15],"-",[6,7],"/",[1,10],"+"],
      [[3,7],[1,14],"+",[7,8],"*",[2,3],"/"]
    ];

    for (const row of threeStep) {
      const A = row[0];
      const B = row[1];
      const op1 = row[2];

      const a = F(A[0], A[1]);
      const b = F(B[0], B[1]);

      const first = op1 === "+" ? add(a.f, b.f) : sub(a.f, b.f);
      const s1 = op1 === "+" ? "+" : "−";

      let expressionText;
      let expressionHTML;
      let ans;

      // Form 1: ((a +/- b) * c) / d, or similar left chain
      if (typeof row[4] === "string") {
        const C = row[3];
        const op2 = row[4];
        const D = row[5];
        const op3 = row[6];

        const c = F(C[0], C[1]);
        const d = F(D[0], D[1]);

        const second = op2 === "*" ? mul(first, c.f) : div(first, c.f);

        ans =
          op3 === "+"
            ? add(second, d.f)
            : op3 === "-"
              ? sub(second, d.f)
              : op3 === "*"
                ? mul(second, d.f)
                : div(second, d.f);

        const s2 = op2 === "*" ? "×" : "÷";
        const s3 = op3 === "+" ? "+" : op3 === "-" ? "−" : op3 === "*" ? "×" : "÷";

        expressionText = `((${a.text} ${s1} ${b.text}) ${s2} ${c.text}) ${s3} ${d.text}`;
        expressionHTML = `((${a.html} ${s1} ${b.html}) ${s2} ${c.html}) ${s3} ${d.html}`;
      } else {
        // Form 2: (a +/- b) * (c +/- d)
        const C = row[3];
        const D = row[4];
        const op2 = row[5];
        const op3 = row[6];

        const c = F(C[0], C[1]);
        const d = F(D[0], D[1]);

        const second = op2 === "+" ? add(c.f, d.f) : sub(c.f, d.f);
        ans = op3 === "*" ? mul(first, second) : div(first, second);

        const s2 = op2 === "+" ? "+" : "−";
        const s3 = op3 === "*" ? "×" : "÷";

        expressionText = `(${a.text} ${s1} ${b.text}) ${s3} (${c.text} ${s2} ${d.text})`;
        expressionHTML = `(${a.html} ${s1} ${b.html}) ${s3} (${c.html} ${s2} ${d.html})`;
      }

      id += 1;

      bank.push(P({
        id: `F${String(id).padStart(3, "0")}`,
        difficulty: "hard",
        steps: 3,
        expressionText,
        expressionHTML,
        answer: ans
      }));
    }

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
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .trim();

  // Only allow numbers, operators, parentheses, decimal points, and spaces.
  // This prevents arbitrary JS execution.
  if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) {
    return { ok: false, error: "Use only numbers and + − × ÷." };
  }

  if (!cleaned) {
    return { ok: false, error: "Enter a calculation." };
  }

  try {
    const result = Function(`"use strict"; return (${cleaned});`)();

    if (!Number.isFinite(result)) {
      return { ok: false, error: "Invalid calculation." };
    }

    return { ok: true, result };
  } catch {
    return { ok: false, error: "Invalid calculation." };
  }
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

    <input id="calcInput" class="input calc-input" autocomplete="off" placeholder="e.g., 3/4 + 1/2" />

    <div class="calc-grid">
      <button type="button" class="calc-key" data-calc-key="7">7</button>
      <button type="button" class="calc-key" data-calc-key="8">8</button>
      <button type="button" class="calc-key" data-calc-key="9">9</button>
      <button type="button" class="calc-key" data-calc-key="/">÷</button>

      <button type="button" class="calc-key" data-calc-key="4">4</button>
      <button type="button" class="calc-key" data-calc-key="5">5</button>
      <button type="button" class="calc-key" data-calc-key="6">6</button>
      <button type="button" class="calc-key" data-calc-key="*">×</button>

      <button type="button" class="calc-key" data-calc-key="1">1</button>
      <button type="button" class="calc-key" data-calc-key="2">2</button>
      <button type="button" class="calc-key" data-calc-key="3">3</button>
      <button type="button" class="calc-key" data-calc-key="-">−</button>

      <button type="button" class="calc-key" data-calc-key="0">0</button>
      <button type="button" class="calc-key" data-calc-key=".">.</button>
      <button type="button" class="calc-key" data-calc-key="(">(</button>
      <button type="button" class="calc-key" data-calc-key=")">)</button>

      <button type="button" class="calc-key" data-calc-key="+">+</button>
      <button type="button" class="calc-key" data-calc-key=" ">space</button>
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
      expressionText: problem.expressionText,
      correctText: problem.correctText,
      correctNumerator: problem.correctNumerator,
      correctDenominator: problem.correctDenominator,
      responseRaw: String(answerRaw || "").trim(),
      responseNormalized: parsed.normalized,
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
      "eventIndex",
      "type",
      "trialIndex",
      "trialNumber",
      "problemId",
      "difficulty",
      "steps",
      "expressionText",
      "correctText",
      "correctNumerator",
      "correctDenominator",
      "responseRaw",
      "responseNormalized",
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

    return [
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

      window.location.href =
      `https://utscpsych.sona-systems.com/webstudy_credit.aspx?experiment_id=1317&credit_token=d4d36918ef934798be0bf69a79e33722&survey_code=${state.participantId}`;
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

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    initStudy();
    await instructionsScreen();
    await runTask();
    await endScreen();
  }

  boot();
})();