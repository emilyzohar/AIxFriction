(() => {
  const $ = (id) => document.getElementById(id);

  // ==============================
  // State
  // ==============================
  const state = {
    participantId: null,
    startedAtISO: null,
    meta: {},

    // task params
    addDigitMs: 700,
    addGapMs: 200,
    addDigits: [1, 2, 5],
    diffLengths: Array.from({ length: 20 }, (_, i) => i + 1),

    effortRatings: [],                   // {len, rating, trialLabel, timestampISO}
    successRatings: [],

    difficultyCounters: {},
practiceCorrectCounts: {},

    demographics: {},                   // free-form object to store any demographic info you want to collect

    // unified event / trial logs for export
    _globalEventIndex: 0,
    _globalTrialIndex: 0,
    eventLog: [],                        // screen-level events
    trials: [],                          // every add-trial (practice/training/bdm/etc.)
    bdmBids: [],                         // every bid
    notes: {}
  };

  const READY_MS = 400;

  // ==============================
  // Helpers
  // ==============================
  function getURLParams() {
    const sp = new URLSearchParams(window.location.search);
    const participantId = sp.get("id") || crypto.randomUUID();
    return {participantId };
  }

  function initMeta() {
    const {participantId } = getURLParams();
    state.participantId = participantId;
    state.startedAtISO = new Date().toISOString();
    logEvent("study_start", {participantId });
  }

  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function now() {
    return performance.now();
  }

  function genAddSequence(length) {
    const seq = [];
    for (let i = 0; i < length; i++) {
      seq.push(state.addDigits[Math.floor(Math.random() * state.addDigits.length)]);
    }
    return seq;
  }

  function sum(seq) {
    return seq.reduce((a, b) => a + b, 0);
  }

  function logEvent(type, payload = {}) {
    state._globalEventIndex += 1;
    state.eventLog.push({
      kind: "event",
      eventIndex: state._globalEventIndex,
      type,
      timestampISO: new Date().toISOString(),
      participantId: state.participantId,
      ...payload
    });
  }

  // ==============================
  // DOM Helpers
  // ==============================
  function setHeader(text) { $("subheader").textContent = text || ""; }
  function setFooter(left, right = "") {
    $("leftFooter").textContent = left || "";
    $("rightFooter").textContent = right || "";
  }
  function html(s) { const d = document.createElement("div"); d.innerHTML = s; return d; }
  function clearContent() { $("content").innerHTML = ""; }
  function render(node) { clearContent(); $("content").appendChild(node); }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function waitForKey(allowedKeys, timeoutMs = null) {
    return new Promise((resolve) => {
      let timeoutId = null;

      function onKey(e) {
        const k = (e.key === " ") ? " " : String(e.key).toLowerCase();
        if (!allowedKeys.includes(k)) return;
        cleanup();
        resolve(k);
      }

      function cleanup() {
        window.removeEventListener("keydown", onKey);
        if (timeoutId !== null) clearTimeout(timeoutId);
      }

      window.addEventListener("keydown", onKey);

      if (timeoutMs !== null) {
        timeoutId = setTimeout(() => {
          cleanup();
          resolve(null);
        }, timeoutMs);
      }
    });
  }
async function runDemographicsBlock() {
  state.phase = "demographics";
  setHeader("Demographics");
  setFooter("", "");

  render(html(`
    <div class="notice">
      <div><b>Demographics</b></div>
      <div class="small subtle">Please answer the following questions.</div>
    </div>

    <div class="notice" style="margin-top:12px">
      <div class="small"><b>Gender</b></div>
      <select id="demo_gender" class="input">
        <option value="" selected disabled>Select</option>
        <option value="Woman">Woman</option>
        <option value="Man">Man</option>
        <option value="Non-binary">Non-binary</option>
        <option value="Another identity">Another identity</option>
        <option value="Prefer not to say">Prefer not to say</option>
      </select>
      <input id="demo_gender_other" class="input" placeholder="If another identity, specify (optional)" style="margin-top:8px; display:none" />
    </div>

    <div class="notice">
      <div class="small"><b>Age</b></div>
      <input id="demo_age" class="input" inputmode="numeric" pattern="[0-9]*" placeholder="Enter age in years" />
      <div id="demo_age_err" class="small bad" style="display:none;margin-top:8px"></div>
    </div>

    <div class="notice">
      <div class="small"><b>Most educated parent/guardian</b></div>
      <select id="demo_parentedu" class="input">
        <option value="" selected disabled>Select</option>
        <option value="Less than high school">Less than high school</option>
        <option value="High school diploma or equivalent">High school diploma or equivalent</option>
        <option value="Some college/university (no degree)">Some college/university (no degree)</option>
        <option value="College diploma / Associate degree">College diploma / Associate degree</option>
        <option value="Bachelor's degree">Bachelor's degree</option>
        <option value="Master's degree">Master's degree</option>
        <option value="Doctoral or professional degree">Doctoral or professional degree</option>
        <option value="Don't know">Don't know</option>
        <option value="Prefer not to say">Prefer not to say</option>
      </select>
    </div>

    <div class="notice">
      <div class="small"><b>Household income (annual)</b></div>
      <select id="demo_income" class="input">
        <option value="" selected disabled>Select</option>
        <option value="Less than $25,000">Less than $25,000</option>
        <option value="$25,000–$49,999">$25,000–$49,999</option>
        <option value="$50,000–$74,999">$50,000–$74,999</option>
        <option value="$75,000–$99,999">$75,000–$99,999</option>
        <option value="$100,000–$149,999">$100,000–$149,999</option>
        <option value="$150,000–$199,999">$150,000–$199,999</option>
        <option value="$200,000 or more">$200,000 or more</option>
        <option value="Don't know">Don't know</option>
        <option value="Prefer not to say">Prefer not to say</option>
      </select>
    </div>

    <div class="notice">
      <div class="small"><b>Race/ethnicity</b></div>
      <div class="small subtle">Select all that apply.</div>

      <label class="small"><input type="checkbox" name="demo_race" value="Black"> Black</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="East Asian"> East Asian</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="South Asian"> South Asian</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Southeast Asian"> Southeast Asian</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Middle Eastern / North African"> Middle Eastern / North African</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Indigenous"> Indigenous</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Latino/a/x"> Latino/a/x</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="White"> White</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Another race/ethnicity"> Another race/ethnicity</label><br/>
      <label class="small"><input type="checkbox" name="demo_race" value="Prefer not to say"> Prefer not to say</label><br/>

      <input id="demo_race_other" class="input" placeholder="If another, specify (optional)" style="margin-top:8px; display:none" />
      <div id="demo_race_err" class="small bad" style="display:none;margin-top:8px"></div>
    </div>

       <div class="notice">
      <div class="small"><b>Feedback / problems encountered (optional)</b></div>
      <div class="small subtle">If anything was confusing or didn’t work properly, please describe it.</div>
      <textarea id="demo_feedback" class="input" rows="4" placeholder="Type your feedback here (optional)"></textarea>
    </div>

    <div class="row">
      <button id="btnDemoSubmit" class="btn">Continue</button>
    </div>
  `));

  const genderSel = $("demo_gender");
  const genderOther = $("demo_gender_other");

  genderSel.addEventListener("change", () => {
    genderOther.style.display = (genderSel.value === "Another identity") ? "block" : "none";
  });

  const raceOther = $("demo_race_other");
  const raceCheckboxes = Array.from(document.querySelectorAll('input[name="demo_race"]'));

  function raceHas(value) {
    return raceCheckboxes.some(cb => cb.checked && cb.value === value);
  }

  function updateRaceOtherVisibility() {
    raceOther.style.display = raceHas("Another race/ethnicity") ? "block" : "none";
  }
  raceCheckboxes.forEach(cb => cb.addEventListener("change", updateRaceOtherVisibility));

  function getSelectedRaces() {
    return raceCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
  }

  function validateAge(v) {
    const n = Number(String(v).trim());
    if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, msg: "Enter a whole number age." };
    if (n < 13 || n > 120) return { ok: false, msg: "Enter an age between 13 and 120." };
    return { ok: true, n };
  }

  await new Promise((resolve) => {
    $("btnDemoSubmit").onclick = () => {
      const gender = genderSel.value || "";
      const genderOtherText = (genderOther.value || "").trim();

      const ageRaw = ($("demo_age").value || "").trim();
      const ageCheck = validateAge(ageRaw);
      const ageErr = $("demo_age_err");

      const parentEdu = ($("demo_parentedu").value || "");
      const income = ($("demo_income").value || "");

      const races = getSelectedRaces();
      const raceOtherText = (raceOther.value || "").trim();
      const raceErr = $("demo_race_err");

        const feedback = ($("demo_feedback").value || "").trim();


      ageErr.style.display = "none";
      raceErr.style.display = "none";

      if (!gender) {
        alert("Please select a gender option.");
        return;
      }
      if (!ageCheck.ok) {
        ageErr.style.display = "block";
        ageErr.textContent = ageCheck.msg;
        return;
      }
      if (!parentEdu) {
        alert("Please select the most educated parent/guardian option.");
        return;
      }
      if (!income) {
        alert("Please select a household income option.");
        return;
      }
      if (races.length === 0) {
        raceErr.style.display = "block";
        raceErr.textContent = "Please select at least one option.";
        return;
      }

      state.demographics = {
        kind: "demographics",
        participantId: state.participantId,
        timestampISO: new Date().toISOString(),
        gender,
                feedback,

        genderOther: (gender === "Another identity") ? genderOtherText : "",
        age: ageCheck.n,
        parentEdu,
        householdIncome: income,
        race: races, // array
        raceOther: raceHas("Another race/ethnicity") ? raceOtherText : ""
      };

      logEvent("demographics_complete", { age: state.demographics.age, gender: state.demographics.gender });
      resolve();
    };
  });

  setHeader("Done");
  setFooter("", "");
  render(html(`
    <div class="notice">
      <div class="good"><b>Saved.</b></div>
      <div class="small subtle">Press Continue.</div>
    </div>
    <div class="row"><button id="btnDemoDone" class="btn">Continue</button></div>
  `));
  await new Promise(r => { $("btnDemoDone").onclick = r; });

  return state.demographics;
}

  async function runReady() {
    render(html(`<div class="big">Ready?</div><div class="subtle">Watch the digits</div>`));
    await wait(READY_MS);
  }

  async function runAddTrial({
    phase,
    length,
    label,
    showEndFeedback = false,
    timeLimitMs = null,
    selfPacedDigits = false
  }) {
    const seq = genAddSequence(length);
    const correctSum = sum(seq);

    const start = now();
    const deadline = (timeLimitMs == null) ? null : (start + timeLimitMs);

    let perDigitAdvanceMs = [];

    if (selfPacedDigits) {
      render(html(`
        <div class="row">
          <div class="pill">Length: ${length}</div>
          <div class="pill" id="spProgress">Digit 1 / ${length}</div>
        </div>
        <div class="big" id="spDigit" style="min-height:1.2em;">&nbsp;</div>
        <div class="subtle">
          Remember and add the numbers.
          <br/><b>Press SPACE for next digit.</b>
        </div>
      `));

      const digitEl = $("spDigit");
      const progEl  = $("spProgress");

      for (let i = 0; i < seq.length; i++) {
        if (deadline != null && now() >= deadline) break;

        progEl.textContent = `Digit ${i + 1} / ${length}`;
        digitEl.textContent = String(seq[i]);

        const shownAt = now();
        await waitForKey([" "], null);
        const pressedAt = now();
        perDigitAdvanceMs.push(Math.round(pressedAt - shownAt));

        digitEl.innerHTML = "&nbsp;";
        await wait(200);
      }
    } else {
      const gapMs = state.addGapMs;
      const digitMs = Math.max(1, state.addDigitMs - gapMs);

      for (let i = 0; i < seq.length; i++) {
        if (deadline != null && now() >= deadline) break;

        render(html(`
          <div class="row"><div class="pill">Length: ${length}</div></div>
          <div class="big">${seq[i]}</div>
          <div class="subtle">Remember and add the numbers.</div>
        `));
        await wait(digitMs);

        if (deadline != null && now() >= deadline) break;

        render(html(`
          <div class="row"><div class="pill">Length: ${length}</div></div>
          <div class="big">&nbsp;</div>
          <div class="subtle">Remember and add the numbers.</div>
        `));
        await wait(gapMs);
      }
    }

    render(html(`
      <div class="row"><div class="pill">Length: ${length}</div></div>
      <div class="notice">
        <div><b>Enter the sum</b></div>
        <div class="small subtle">Type the total and press Enter.</div>
      </div>
      <input id="sumBox" class="input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" />
      <div id="sumErr" class="small bad" style="display:none;margin-top:8px"></div>
    `));

    const sumBox = $("sumBox");
    sumBox.focus();

    sumBox.addEventListener("keydown", (e) => {
      if (["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Enter"].includes(e.key)) return;
      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    });

    const tResp0 = now();
    const responseText = await new Promise((resolve) => {
      function onKey(e) {
        if (e.key === "Enter") {
          window.removeEventListener("keydown", onKey);
          resolve(sumBox.value);
        }
      }
      window.addEventListener("keydown", onKey);
    });
    const tResp1 = now();

    const respTrim = (responseText || "").trim();
    const responseNumber = (respTrim === "") ? null : Number(respTrim);
    const correct = (responseNumber === correctSum);

    const end = now();
    const trialTimeMs = Math.round(end - start);

    if (showEndFeedback) {
      render(html(`
        <div class="notice">
          ${correct ? `<div class="good"><b>Correct</b></div>` : `<div class="bad"><b>Incorrect</b></div>`}
          <div class="small">
            Your answer: <b>${respTrim === "" ? "(blank)" : respTrim}</b><br/>
            Correct sum: <b>${correctSum}</b>
          </div>
        </div>
      `));
      await wait(600);
    }

    return {
      phase,
      label,
      timestampISO: new Date().toISOString(),
      paradigm: "add",
      length,
      sequence: seq,
      correctSum,
      responseText: respTrim,
      responseNumber,
      correct,
      responseRTms: Math.round(tResp1 - tResp0),
      trialTimeMs,
      addDigitMs: state.addDigitMs,
      addGapMs: state.addGapMs,
      timeLimitMs: timeLimitMs ?? null,
      perDigitAdvanceMs: selfPacedDigits ? perDigitAdvanceMs : null
    };
  }

  async function runAddTrialLogged(params, ctx = {}) {
    state._globalTrialIndex += 1;
    const t = await runAddTrial(params);

    const row = {
      kind: "trial",
      participantId: state.participantId,
      trialIndex: state._globalTrialIndex,
      order: state.meta.order,
      blockLabel: ctx.blockLabel ?? "",
      blockType: ctx.blockType ?? "",
      mode: ctx.mode ?? "",
      ...t
    };

    state.trials.push(row);

    // convenience: also emit an event marker
    logEvent("trial_complete", {
      trialIndex: row.trialIndex,
      phase: row.phase,
      label: row.label,
      length: row.length,
      correct: row.correct ? 1 : 0,
      blockLabel: row.blockLabel,
      blockType: row.blockType,
      mode: row.mode
    });

    return t;
  }


async function probeDifficultyAndAchievability({ length, label }) {
  setHeader("Question");
  setFooter("1–7", "Keyboard");

  render(html(`
    <div class="notice">
      <div><b>How demanding did that last sequence feel?</b></div>
      <div class="small subtle">1 (very low) to 7 (very high)</div>
      <div class="small subtle">Length: ${length}</div>
    </div>
    <div class="row">
      <div class="pill">1</div><div class="pill">2</div><div class="pill">3</div><div class="pill">4</div>
      <div class="pill">5</div><div class="pill">6</div><div class="pill">7</div>
    </div>
  `));

  const demandKey = await waitForKey(["1", "2", "3", "4", "5", "6", "7"], null);
  const demandingRating = parseInt(demandKey, 10);

  setHeader("Question");
  setFooter("1–7", "Keyboard");

  render(html(`
    <div class="notice">
      <div><b>How successful did you feel in accomplishing the last sequence?</b></div>
      <div class="small subtle">1 (very low) to 7 (very high)</div>
      <div class="small subtle">Length: ${length}</div>
    </div>
    <div class="row">
      <div class="pill">1</div><div class="pill">2</div><div class="pill">3</div><div class="pill">4</div>
      <div class="pill">5</div><div class="pill">6</div><div class="pill">7</div>
    </div>
  `));

  const achievableKey = await waitForKey(["1", "2", "3", "4", "5", "6", "7"], null);
  const achievableRating = parseInt(achievableKey, 10);

  const rec = {
    kind: "level_rating",
    participantId: state.participantId,
    timestampISO: new Date().toISOString(),
    length,
    label,
    demandingRating,
    achievableRating,

    // Keep this alias so older code that expects r.rating still works.
    rating: demandingRating
  };

  state.effortRatings.push({
    length,
    demandingRating,
    achievableRating,
    rating: demandingRating,
    label,
    timestampISO: rec.timestampISO
  });

  logEvent("level_rating", {
    length,
    label,
    demandingRating,
    achievableRating,
    rating: demandingRating
  });

  return rec;
}

async function practiceTrialWithRating(label, length, feedback, skip) {
  state.difficultyCounters[length] = (state.difficultyCounters[length] || 0) + 1;

  const res = await runAddTrialLogged(
    {
      phase: label,
      length,
      label: `${label}_len${length}_n${state.difficultyCounters[length]}`,
      showEndFeedback: feedback
    },
    { blockLabel: label, blockType: label }
  );

  if (res.correct) {
    state.practiceCorrectCounts[length] = (state.practiceCorrectCounts[length] || 0) + 1;
  } else {
    state.practiceCorrectCounts[length] = (state.practiceCorrectCounts[length] || 0);
  }

  let levelRating = null;

  // In practice, only rate the 3rd encounter of each length.
  // In rating blocks, rate every trial.
  if (skip === false) {
    if (state.difficultyCounters[length] === 2) {
      levelRating = await probeDifficultyAndAchievability({
        length,
        label: res.label
      });
    }
  } else {
    levelRating = await probeDifficultyAndAchievability({
      length,
      label: res.label
    });
  }

  return { res, levelRating, length };
}



  async function runPracticeBlock() {
    logEvent(`practice_start`, { diffLengths: state.diffLengths.join(",") });

    const levels = shuffledCopy(state.diffLengths);
    for (let round = 1; round <= 2; round++) {
      for (let j = 0; j < levels.length; j++) {
        const len = levels[j];
        if (round === 1) {await practiceTrialWithRating('practice', len, true, false); }
        else {await practiceTrialWithRating('practice', len, false, false);}
        
      }
    }

    state.effortRatings.forEach(r => {
  logEvent(`demand_rating_practice`, {
    length: r.length,
    rating: r.rating,
    label: 'practice',
    timestampISO: r.timestampISO,
    correct_count: state.practiceCorrectCounts[r.length] || 0
  });
  
});
  }


async function runRating(label) {
  logEvent(`ratings_after_${label}`, {
    diffLengths: state.diffLengths.join(",")
  });

  const levels = shuffledCopy(state.diffLengths);

  for (let j = 0; j < levels.length; j++) {
    const len = levels[j];

    await practiceTrialWithRating(
      label,
      len,
      false, // no correctness feedback
      true   // ask ratings after every trial
    );
  }
}


  function escapeCSV(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }



  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function buildPayloadFromState() {
  return {
    meta: {
      paradigm: state.paradigm,
      participantId: state.participantId,
      startedAtISO: state.startedAtISO,
      exportedAtISO: new Date().toISOString(),
      urlParams: state.meta,

      // Task parameters actually used
      addDigitMs: state.addDigitMs,
      addGapMs: state.addGapMs,
      addDigits: state.addDigits,

      // Difficulty grid actually used
      diffLengths: state.diffLengths,
      diffLevels: state.diffLevels,
    },

    // Raw state, as recorded (no “invented” fields)
    practice: state.practice,                         // attempts + trial objects
    allDifficultyPractice: state.allDifficultyPractice, // {lvl,res}
    demandBlocks: state.demandBlocks,                 // {label,trials:[{lvl,res,demand}]}
  };
}

function flattenForCSVFromState() {
  const rows = [];

  // META
  rows.push({
    kind: "meta",
    participantId: state.participantId,
    startedAtISO: state.startedAtISO,
    exportedAtISO: new Date().toISOString(),
    addDigitMs: state.addDigitMs,
    addGapMs: state.addGapMs,
    addDigits: JSON.stringify(state.addDigits),
    diffLengths: JSON.stringify(state.diffLengths),
    practiceCorrectCounts: JSON.stringify(state.practiceCorrectCounts),
    effortRatings: JSON.stringify(state.effortRatings),
    successRatings: JSON.stringify(state.successRatings),
    highEffortCondition: JSON.stringify(state.highEffortCondition),
    totalTicketsAfter: state.bdmTickets?.total ?? 0
  });

  // DEMOGRAPHICS (optional)
  if (state.demographics && Object.keys(state.demographics).length) {
    rows.push({
      kind: "demographics",
      participantId: state.demographics.participantId,
      timestampISO: state.demographics.timestampISO,
      gender: state.demographics.gender,
      genderOther: state.demographics.genderOther,
      age: state.demographics.age,
      parentEdu: state.demographics.parentEdu,
      householdIncome: state.demographics.householdIncome,
      race: Array.isArray(state.demographics.race) ? state.demographics.race.join(";") : "",
      raceOther: state.demographics.raceOther,
            feedback: state.demographics.feedback || ""

    });
  }

    // LEVEL RATINGS: demand + achievability after each rated length
  for (const r of state.effortRatings) {
    rows.push({
      kind: "level_rating_summary",
      participantId: state.participantId,
      timestampISO: r.timestampISO,
      label: r.label,
      length: r.length,
      demandingRating: r.demandingRating ?? r.rating ?? "",
      achievableRating: r.achievableRating ?? "",
      rating: r.rating ?? r.demandingRating ?? "",
      correct_count: state.practiceCorrectCounts[r.length] || 0
    });
  }
  // EVENTS
  for (const e of state.eventLog) rows.push(e);

  // TRIALS
  for (const t of state.trials) {
    rows.push({
      kind: "add_trial",
      participantId: t.participantId,
      trialIndex: t.trialIndex,
      order: t.order,
      blockLabel: t.blockLabel,
      blockType: t.blockType,
      mode: t.mode,
      phase: t.phase,
      label: t.label,
      timestampISO: t.timestampISO,
      length: t.length,
      sequence: Array.isArray(t.sequence) ? t.sequence.join("") : "",
      correctSum: t.correctSum,
      responseText: t.responseText,
      responseNumber: t.responseNumber,
      correct: t.correct ? 1 : 0,
      responseRTms: t.responseRTms,
      trialTimeMs: t.trialTimeMs,
      addDigitMs: t.addDigitMs,
      addGapMs: t.addGapMs,
      timeLimitMs: t.timeLimitMs ?? "",
      perDigitAdvanceMs: Array.isArray(t.perDigitAdvanceMs) ? JSON.stringify(t.perDigitAdvanceMs) : ""
    });
  }



  return rows;
}


  function exportAllCSVs() {
    const rows = flattenForCSVFromState();
    const csv = toCSV(rows);
    downloadText(`data_${state.participantId}.csv`, csv);

    // optional: also export raw JSON for debugging
    // const jsonBlob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    // const url = URL.createObjectURL(jsonBlob);
    // const a = document.createElement("a");
    // a.href = url; a.download = `state_${state.participantId}.json`;
    // document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ==============================
  // End screen
  // ==============================
async function endScreen() {
  state.phase = "end";
  setHeader("Finished");
  setFooter("", "");

  const rows = flattenForCSVFromState();
  const csvString = toCSV(rows);


  render(html(`
    <div class="notice">
      <div class="small">
        You have completed the task.
      </div>
      <div class="hr"></div>
      <div><b>Saving your data…</b></div>
      <div class="small">Please do not close this window.</div>
    </div>
  `));

  await wait(400); // short pause only; not fake “saving”

  const filename = `sub-${state.participantId}-${Date.now()}.csv`;

  try {
    const rows = flattenForCSVFromState();
    const csvString = toCSV(rows);

    await saveCSVToPipe({
      experimentID: "sQGUX1f36BgA",
      filename,
      csvString
    });

    render(html(`
      <div class="notice">
        <div class="good"><b>Saved.</b></div>
        <div class="small subtle">${filename}</div>
      </div>
    `));

    await wait(400);
    window.location.href =
      `https://utscpsych.sona-systems.com/webstudy_credit.aspx?experiment_id=1265&credit_token=16053a2578fc45a28edd6d4ac7be7b07&survey_code=${state.participantId}`;
  } catch (e) {
    console.error(e);

    const errorMessage = e instanceof Error ? e.message : String(e);
    const rows = flattenForCSVFromState();
    rows.push({
      kind: "save_error",
      participantId: state.participantId,
      timestampISO: new Date().toISOString(),
      errorMessage: errorMessage
    });
    const csvWithError = toCSV(rows);

    render(html(`
      <div class="notice">
        <div class="bad"><b>Upload failed.</b></div>
        <div class="small">
          You still completed the task.
        </div>
        <div class="hr"></div>
        <div class="small"><b>Error:</b> ${errorMessage}</div>
        <div class="hr"></div>
        <div class="small">Download your CSV and send it to the researcher. email: emily.zohar@mail.utoronto.ca</div>
      </div>
      <div class="row"><button id="btnCsv" class="btn">Download CSV</button></div>
    `));
    $("btnCsv").onclick = () => download(filename, csvWithError, "text/csv");
  }
}


   async function instructionsScreen_Add() {
    state.phase = "instructions";
    setHeader("Instructions");
    setFooter("", "");

    render(html(`
      <div class="notice">
        <div><b>Task:</b> You will see a sequence of digits, one at a time. Add them up.</div>
        <div class="hr"></div>
        <div class="small">
          After the sequence ends, you will type the <b>sum</b> and press <b>Enter</b>.
        </div>
        <div class="hr"></div>

      </div>
      <div class="row"><button id="btnInstrGo" class="btn">Continue</button></div>
    `));

    await new Promise(r => { $("btnInstrGo").onclick = r; });
  }

  const payload = buildPayloadFromState();
const rows = flattenForCSVFromState();

  // ---------------- End screen + optional redirect ----------------

  function download(filename, text, mime = "application/json") {
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

function toCSV(rows) {
  if (!rows || !rows.length) return "";

  // union of keys across all rows
  const headerSet = new Set();
  rows.forEach(r => Object.keys(r).forEach(k => headerSet.add(k)));

  // keep readable ordering for common columns
    const preferred = [
    "kind",
    "participantId",
    "timestampISO",
    "eventIndex",
    "type",
    "trialIndex",
    "order",
    "blockLabel",
    "blockType",
    "mode",
    "phase",
    "label",
    "length",
    "sequence",
    "correctSum",
    "responseText",
    "responseNumber",
    "correct",
    "responseRTms",
    "trialTimeMs",
    "demandingRating",
    "achievableRating",
    "rating",
    "correct_count",
    "key",
    "construct",
    "prompt",
    "ratingReversed",
    "quizAttempt",
    "idx",
    "chosenIndex",
    "correctIndex",
    "isCorrect",
    "bidValue",
    "bidRTms",
    "urnDraw",
    "mustDoTask",
    "blockTickets",
    "totalAfter",
    "totalTicketsAfter"
  ];

  const headers = [
    ...preferred.filter(h => headerSet.has(h)),
    ...[...headerSet].filter(h => !preferred.includes(h))
  ];

  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [];
  lines.push(headers.join(","));
  for (const r of rows) {
    lines.push(headers.map(h => esc(r[h])).join(","));
  }
  return lines.join("\n");
}




async function saveCSVToPipe({ experimentID, filename, csvString }) {
  const res = await fetch("https://pipe.jspsych.org/api/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ experimentID, filename, data: csvString })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pipe save failed: ${res.status} ${res.statusText} ${txt}`);
  }
  return res.json().catch(() => ({}));
}


  // ==============================
  // Boot
  // ==============================
  async function boot() {
    initMeta();

    
    await instructionsScreen_Add();  // Present task instructions
     await runReady();   


    // PRACTICE must run, otherwise highEffortCondition is empty
    await runPracticeBlock();

    await runDemographicsBlock();
    await endScreen();
  }

  // run
  boot();

})();
