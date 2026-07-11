(() => {
  "use strict";

  const STORE_SCHEMA = "priority_foregrounds.workspace/v1";
  const REQUEST_SCHEMA = "priority_foregrounds.rescore_request/v1";
  const RESULT_SCHEMA = "priority_foregrounds.rescore_result/v1";
  const names = ["customer", "leverage", "confidence", "learning", "cost"];
  const presets = {
    balanced: [30, 25, 20, 15, 10],
    customer: [55, 18, 12, 10, 5],
    leverage: [15, 50, 15, 15, 5],
    margin: [20, 15, 15, 10, 40],
  };
  const principles = {
    customer: {
      name: "Customer value",
      prompt: "Score how directly the initiative solves an urgent, specific customer problem that a real buyer is likely to pay to resolve. A 5 has a short, credible path to observable customer value; a 1 is remote, speculative, or mainly internal convenience.",
    },
    leverage: {
      name: "Strategic leverage",
      prompt: "Score how much completing the initiative makes future products, releases, or decisions easier, faster, or safer. A 5 creates a reusable capability or removes a recurring constraint; a 1 is isolated work with little compounding value.",
    },
    confidence: {
      name: "Execution confidence",
      prompt: "Score how much the initiative reduces a material delivery, reliability, security, compliance, or operating risk. A 5 closes a demonstrated high-impact failure mode with verifiable proof; a 1 does not materially improve confidence.",
    },
    learning: {
      name: "Learning velocity",
      prompt: "Score how quickly the initiative creates trustworthy feedback, reusable automation, or evidence that improves later decisions. A 5 shortens repeated learning loops with objective signals; a 1 produces little new information or depends on unverified assumptions.",
    },
    cost: {
      name: "Cost discipline",
      prompt: "Score how much the initiative makes recurring cost attributable, bounded, or lower while protecting value. A 5 directly measures or materially reduces ongoing spend or improves margin; a 1 adds cost or offers no meaningful cost control.",
    },
  };

  const initiatives = [
    {
      id: "customer_discovery",
      name: "Interview five active buyers",
      category: "Discovery",
      horizon: "now",
      summary: "Test the top problem, buying trigger, current workaround, and willingness to pay with five people who control or influence budget.",
      customer_value: "Replaces internal assumptions with direct buyer evidence.",
      leverage: "Clarifies positioning and the first narrow offer.",
      risk: "Reduces the risk of building for a weak or imaginary demand signal.",
      ai_fit: "AI can cluster notes, but source recordings and quotes remain authoritative.",
      cost: "Low-cost discovery before larger engineering spend.",
      dependency: "Access to qualified interview candidates.",
      proof: "Five completed interviews with linked evidence and a clear repeated problem pattern.",
      effort: 2,
      scores: [5, 4, 4, 5, 4],
    },
    {
      id: "onboarding_path",
      name: "Close the first-use onboarding path",
      category: "Product",
      horizon: "now",
      summary: "Remove the highest-frequency blockers between account creation and the first successful customer outcome.",
      customer_value: "Turns interest into a useful first experience.",
      leverage: "Creates the reference path for demos, tests, and support.",
      risk: "Eliminates known abandonment points.",
      ai_fit: "AI can generate test variants and summarize failures.",
      cost: "Reduces repeated manual setup and support.",
      dependency: "A literal definition of the first successful outcome.",
      proof: "A new user completes the path unaided in a recorded usability run.",
      effort: 3,
      scores: [5, 5, 5, 4, 4],
    },
    {
      id: "reliability_harness",
      name: "Replay-to-regression reliability harness",
      category: "Engineering system",
      horizon: "now",
      summary: "Capture failures, replay them deterministically, promote each fix into a regression, and preserve evidence from observed defect to release proof.",
      customer_value: "Reduces repeat failures in customer-critical workflows.",
      leverage: "Makes every later feature safer and faster to change.",
      risk: "Closes the gap between a reported defect and a durable proof.",
      ai_fit: "AI can navigate evidence and draft tests without inventing outcomes.",
      cost: "Lowers repeated debugging and incident review effort.",
      dependency: "Stable event and artifact contracts.",
      proof: "One real defect fails before the fix, passes after it, and replays from retained evidence.",
      effort: 4,
      scores: [4, 5, 5, 5, 4],
    },
    {
      id: "cost_ledger",
      name: "Usage and cost ledger",
      category: "Economics",
      horizon: "now",
      summary: "Attribute variable and fixed spend to products, providers, customers, and outcomes while rendering missing prices as unknown.",
      customer_value: "Supports a defensible price and sustainable service.",
      leverage: "Makes model, provider, and architecture choices comparable.",
      risk: "Prevents silent margin loss and misleading zero-cost reports.",
      ai_fit: "AI can explain anomalies; deterministic records own totals.",
      cost: "Directly establishes cost truth and guardrails.",
      dependency: "Normalized usage events and current provider prices.",
      proof: "Daily totals reconcile to provider statements within a stated tolerance.",
      effort: 3,
      scores: [4, 5, 5, 4, 5],
    },
    {
      id: "paid_pilot",
      name: "Sell and operate one paid pilot",
      category: "Go to market",
      horizon: "now",
      summary: "Package one narrow outcome, provision manually where appropriate, agree on success criteria, and collect the first payment.",
      customer_value: "Delivers a concrete outcome rather than a broad platform promise.",
      leverage: "Creates the reference account and exposes real operating work.",
      risk: "Tests pricing and delivery assumptions with an actual buyer.",
      ai_fit: "AI can draft collateral and summarize usage; a human owns the agreement.",
      cost: "Manual operations avoid premature platform automation.",
      dependency: "A reliable first-use path and explicit pilot scope.",
      proof: "Signed pilot scope, payment received, and first customer outcome completed.",
      effort: 3,
      scores: [5, 4, 4, 5, 4],
    },
    {
      id: "billing_automation",
      name: "Automate billing and entitlements",
      category: "Operations",
      horizon: "next",
      summary: "Automate plans, usage statements, invoices, entitlement enforcement, and teardown after the first offer and price are proven.",
      customer_value: "Makes account operation predictable at higher volume.",
      leverage: "Removes repeated manual commercial operations.",
      risk: "Improves money and access control after contracts stabilize.",
      ai_fit: "AI may explain invoices but never owns the ledger.",
      cost: "Reduces manual work only after recurring volume exists.",
      dependency: "A validated plan, price, and usage contract.",
      proof: "A test account completes invoice, payment, entitlement, and cancellation lifecycles.",
      effort: 4,
      scores: [3, 4, 4, 2, 4],
    },
    {
      id: "customer_dashboard",
      name: "Customer outcome dashboard",
      category: "Product",
      horizon: "next",
      summary: "Show customer outcomes, evidence completeness, usage, and costs without masking missing data.",
      customer_value: "Makes delivered value and exceptions visible.",
      leverage: "Creates one shared operating view for support and reviews.",
      risk: "Surfaces missing evidence instead of implying success.",
      ai_fit: "AI can summarize evidence with links to source records.",
      cost: "Can reduce manual reporting after measurements are reliable.",
      dependency: "Outcome and cost ledgers with stable identities.",
      proof: "Every displayed metric reconciles to its source record or explicitly says unavailable.",
      effort: 4,
      scores: [4, 4, 4, 4, 3],
    },
    {
      id: "knowledge_assistant",
      name: "Source-backed knowledge assistant",
      category: "AI product",
      horizon: "later",
      summary: "Answer repeated customer questions from an authorized, current corpus with citations and deterministic escalation.",
      customer_value: "Can answer high-frequency questions when a real corpus and demand exist.",
      leverage: "Creates reusable retrieval and evaluation infrastructure.",
      risk: "Requires authorization, freshness, citation, and escape controls.",
      ai_fit: "The model synthesizes only retrieved authorized material.",
      cost: "Adds retrieval and inference cost before demand is proven.",
      dependency: "A customer-owned corpus and repeated question set.",
      proof: "An evaluation set demonstrates source-grounded answers and correct escalation.",
      effort: 5,
      scores: [3, 4, 2, 4, 2],
    },
    {
      id: "partner_integration",
      name: "Second system integration",
      category: "Platform",
      horizon: "later",
      summary: "Add another external system only after the first integration contract is stable and a customer requires it.",
      customer_value: "Expands fit for a specific customer environment.",
      leverage: "Tests whether the provider boundary is genuinely reusable.",
      risk: "Adds support surface and provider failure modes.",
      ai_fit: "AI can scaffold adapters; deterministic contracts own writes.",
      cost: "Adds recurring maintenance and provider costs.",
      dependency: "Demand from a qualified account and a stable first adapter.",
      proof: "A contract test suite passes against both providers with identical domain behavior.",
      effort: 5,
      scores: [2, 4, 2, 3, 2],
    },
    {
      id: "second_segment",
      name: "Launch a second customer segment",
      category: "Go to market",
      horizon: "parked",
      summary: "Clone the acquisition and delivery pattern for another segment only after the first segment converts and operates predictably.",
      customer_value: "May open additional demand after the initial offer is proven.",
      leverage: "Validates whether the operating model transfers.",
      risk: "Multiplies context, copy, support, and reliability surface.",
      ai_fit: "AI can draft variants, but cannot prove segment demand.",
      cost: "Disperses current acquisition and product effort.",
      dependency: "Measured conversion, retention, and margin in the first segment.",
      proof: "A qualified buyer in the second segment commits to a bounded pilot.",
      effort: 4,
      scores: [2, 2, 2, 3, 1],
    },
  ];

  names.forEach((name) => {
    const principle = principles[name];
    principle.scoredPrompt = principle.prompt;
    principle.provenance = { kind: "seed" };
    principle.error = "";
    principle.running = false;
  });
  initiatives.forEach((item) => { item.scoreReasons = {}; });

  const inputs = names.map((name) => document.querySelector(`[data-weight="${name}"]`));
  let selected = initiatives[0].id;
  let activePrinciple = "";

  const validScores = (scores) => Array.isArray(scores)
    && scores.length === names.length
    && scores.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);

  const loadWorkspace = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_SCHEMA) || "null");
      if (!saved || saved.schema !== STORE_SCHEMA) return;
      names.forEach((name, index) => {
        const row = saved.principles && saved.principles[name];
        if (row && typeof row.prompt === "string" && row.prompt.trim().length >= 10) {
          principles[name].prompt = row.prompt.trim();
          principles[name].scoredPrompt = typeof row.scoredPrompt === "string" ? row.scoredPrompt : "";
          principles[name].provenance = row.provenance && typeof row.provenance === "object" ? row.provenance : { kind: "seed" };
        }
        const weight = saved.weights && Number(saved.weights[index]);
        if (Number.isFinite(weight) && weight >= 0.1 && weight <= 99.6) inputs[index].value = String(weight);
      });
      const total = inputs.reduce((sum, input) => sum + Number(input.value), 0);
      if (Math.abs(total - 100) > 0.001) presets.balanced.forEach((value, index) => { inputs[index].value = String(value); });
      initiatives.forEach((item) => {
        const scores = saved.scores && saved.scores[item.id];
        const reasons = saved.reasons && saved.reasons[item.id];
        if (validScores(scores)) item.scores = [...scores];
        if (reasons && typeof reasons === "object") {
          names.forEach((name) => {
            if (typeof reasons[name] === "string" && reasons[name].length <= 600) item.scoreReasons[name] = reasons[name];
          });
        }
      });
    } catch (_error) {
      localStorage.removeItem(STORE_SCHEMA);
    }
  };

  const persistWorkspace = () => {
    try {
      localStorage.setItem(STORE_SCHEMA, JSON.stringify({
        schema: STORE_SCHEMA,
        weights: inputs.map((input) => Number(input.value)),
        principles: Object.fromEntries(names.map((name) => [name, {
          prompt: principles[name].prompt,
          scoredPrompt: principles[name].scoredPrompt,
          provenance: principles[name].provenance,
        }])),
        scores: Object.fromEntries(initiatives.map((item) => [item.id, item.scores])),
        reasons: Object.fromEntries(initiatives.map((item) => [item.id, item.scoreReasons])),
      }));
    } catch (_error) {
      // Browser storage is optional; the current view remains authoritative.
    }
  };

  const weightedScore = (item) => {
    const weights = inputs.map((input) => Number(input.value));
    const sum = weights.reduce((total, value) => total + value, 0) || 1;
    const raw = item.scores.reduce((total, value, index) => total + value * weights[index], 0) / sum * 20;
    return Math.max(0, raw - item.effort * 1.5);
  };

  const redistribute = (changed) => {
    const floor = 0.1;
    const changedIndex = inputs.indexOf(changed);
    const target = Math.max(floor, Math.min(100 - floor * (inputs.length - 1), Number(changed.value) || floor));
    const others = inputs
      .map((input, index) => ({ input, index, value: Number(input.value) || floor }))
      .filter((row) => row.index !== changedIndex);
    const available = 100 - target - floor * others.length;
    const discretionary = others.reduce((sum, row) => sum + Math.max(0, row.value - floor), 0);
    changed.value = String(target);
    others.forEach((row) => {
      const share = discretionary > 1e-9 ? Math.max(0, row.value - floor) / discretionary : 1 / others.length;
      row.input.value = String(floor + share * available);
    });
  };

  const weightLabel = (value) => {
    const number = Number(value) || 0;
    if (Math.abs(number - Math.round(number)) < 0.005) return String(Math.round(number));
    if (number < 1) return number.toFixed(2);
    return number.toFixed(1);
  };

  const principleStatus = (name) => {
    const principle = principles[name];
    const provenance = principle.provenance || {};
    if (principle.running) return { kind: "running", text: "Re-scoring complete queue..." };
    if (principle.error) return { kind: "error", text: principle.error };
    if (principle.prompt !== principle.scoredPrompt) return { kind: "stale", text: "Prompt changed - scores stale" };
    if (provenance.kind === "model") {
      const tokens = Number(provenance.total_tokens) || Number(provenance.input_tokens || 0) + Number(provenance.output_tokens || 0);
      const cache = provenance.cache_hit ? "cached" : "uncached";
      return { kind: "model", text: `${String(provenance.model || "model")} - ${tokens.toLocaleString()} tokens - ${cache} - cost unknown` };
    }
    return { kind: "seed", text: "Seed scores" };
  };

  const renderPrincipleStatuses = () => {
    names.forEach((name) => {
      const state = principleStatus(name);
      const row = document.querySelector(`[data-principle="${name}"]`);
      row.dataset.scoreStatus = state.kind;
      row.querySelector(".principle-status").textContent = state.text;
      row.querySelector(".rescore-principle").disabled = Boolean(principles[name].running);
    });
    if (activePrinciple) document.querySelector("#principle-prompt-meta").textContent = principleStatus(activePrinciple).text;
  };

  const rankPrinciples = () => {
    const container = document.querySelector("#principle-controls");
    const ranked = names
      .map((name, index) => ({ name, index, value: Number(inputs[index].value) }))
      .sort((a, b) => b.value - a.value || a.index - b.index);
    ranked.forEach((item, index) => {
      const rank = index + 1;
      const row = container.querySelector(`[data-principle="${item.name}"]`);
      const badge = row.querySelector(".principle-rank");
      row.dataset.rank = String(rank);
      badge.textContent = `#${rank}`;
      badge.setAttribute("aria-label", `Principle rank ${rank}`);
      container.appendChild(row);
    });
  };

  const cell = (text, className = "") => {
    const element = document.createElement("td");
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  const renderQueue = () => {
    const body = document.querySelector("#portfolio-body");
    body.replaceChildren();
    const ranked = [...initiatives].sort((a, b) => weightedScore(b) - weightedScore(a) || a.name.localeCompare(b.name));
    ranked.forEach((item, index) => {
      const row = document.createElement("tr");
      row.dataset.id = item.id;
      if (item.id === selected) row.className = "selected";
      row.appendChild(cell(String(index + 1), "rank"));
      const identity = document.createElement("td");
      identity.className = "initiative";
      const title = document.createElement("b");
      const category = document.createElement("small");
      title.textContent = item.name;
      category.textContent = item.category;
      identity.append(title, category);
      row.appendChild(identity);
      row.appendChild(cell(item.horizon, `horizon ${item.horizon}`));
      item.scores.forEach((value) => row.appendChild(cell(`${value}/5`)));
      row.appendChild(cell(`${item.effort}/5`));
      row.appendChild(cell(weightedScore(item).toFixed(1), "score"));
      row.addEventListener("click", () => {
        selected = item.id;
        renderQueue();
        renderDetail(item);
      });
      body.appendChild(row);
    });
  };

  const addDefinition = (list, termText, definitionText) => {
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = termText;
    definition.textContent = definitionText;
    list.append(term, definition);
  };

  const renderDetail = (item) => {
    const root = document.querySelector("#initiative-detail");
    root.replaceChildren();
    const main = document.createElement("div");
    main.className = "detail-main";
    const eyebrow = document.createElement("div");
    eyebrow.className = "label";
    eyebrow.textContent = `${item.category} / ${item.horizon}`;
    const title = document.createElement("h3");
    title.textContent = item.name;
    const summary = document.createElement("p");
    summary.textContent = item.summary;
    const list = document.createElement("dl");
    addDefinition(list, "Customer value", item.customer_value);
    addDefinition(list, "Leverage", item.leverage);
    addDefinition(list, "Risk", item.risk);
    addDefinition(list, "AI fit", item.ai_fit);
    addDefinition(list, "Cost", item.cost);
    main.append(eyebrow, title, summary, list);

    const side = document.createElement("div");
    side.className = "detail-side";
    const dependencyLabel = document.createElement("div");
    dependencyLabel.className = "label";
    dependencyLabel.textContent = "Dependency";
    const dependency = document.createElement("p");
    dependency.textContent = item.dependency;
    const proofLabel = document.createElement("div");
    proofLabel.className = "label";
    proofLabel.textContent = "Proof before promotion";
    const proof = document.createElement("p");
    proof.className = "proof";
    proof.textContent = item.proof;
    side.append(dependencyLabel, dependency, proofLabel, proof);

    const reasonNames = names.filter((name) => item.scoreReasons[name]);
    if (reasonNames.length) {
      const evidence = document.createElement("div");
      evidence.className = "score-evidence";
      const evidenceLabel = document.createElement("div");
      evidenceLabel.className = "label";
      evidenceLabel.textContent = "Re-score evidence";
      evidence.appendChild(evidenceLabel);
      reasonNames.forEach((name) => {
        const row = document.createElement("div");
        row.className = "score-evidence-row";
        const head = document.createElement("div");
        head.className = "score-evidence-head";
        const principle = document.createElement("span");
        const value = document.createElement("span");
        const reason = document.createElement("p");
        const status = principleStatus(name);
        principle.textContent = `${principles[name].name}${status.kind === "stale" ? " - stale" : ""}`;
        value.textContent = `${item.scores[names.indexOf(name)]}/5`;
        reason.className = "score-evidence-reason";
        reason.textContent = item.scoreReasons[name];
        const provenance = principles[name].provenance || {};
        if (provenance.result_hash) row.title = `Result ${provenance.result_hash}; request ${provenance.request_hash || "unavailable"}`;
        head.append(principle, value);
        row.append(head, reason);
        evidence.appendChild(row);
      });
      side.appendChild(evidence);
    }
    root.append(main, side);
  };

  const render = ({ reorderPrinciples = false } = {}) => {
    inputs.forEach((input, index) => { document.querySelector(`#o-${names[index]}`).value = weightLabel(input.value); });
    const allocated = inputs.reduce((sum, input) => sum + Number(input.value), 0);
    document.querySelector("#allocation").textContent = `Priority budget: ${weightLabel(allocated)} / 100 allocated`;
    if (reorderPrinciples) rankPrinciples();
    renderPrincipleStatuses();
    renderQueue();
  };

  const setPreset = (name) => {
    inputs.forEach((input, index) => { input.value = String(presets[name][index]); });
    document.querySelectorAll(".preset").forEach((button) => button.classList.toggle("active", button.dataset.preset === name));
    persistWorkspace();
    render({ reorderPrinciples: true });
  };

  const editor = document.querySelector("#principle-editor");
  const promptInput = document.querySelector("#principle-prompt");
  const promptError = document.querySelector("#principle-prompt-error");

  const openPrincipleEditor = (name) => {
    activePrinciple = name;
    document.querySelector("#principle-editor-title").textContent = principles[name].name;
    promptInput.value = principles[name].prompt;
    promptError.hidden = true;
    promptError.textContent = "";
    renderPrincipleStatuses();
    editor.showModal();
    promptInput.focus();
  };

  const savePromptFromEditor = () => {
    const prompt = promptInput.value.trim();
    if (prompt.length < 10) {
      promptError.textContent = "Prompt must contain at least 10 characters.";
      promptError.hidden = false;
      return false;
    }
    principles[activePrinciple].prompt = prompt;
    principles[activePrinciple].error = "";
    promptError.hidden = true;
    persistWorkspace();
    render();
    return true;
  };

  const queueRequest = (name) => ({
    schema: REQUEST_SCHEMA,
    principle: { id: name, name: principles[name].name, prompt: principles[name].prompt },
    initiatives: initiatives.map(({ id, name: itemName, category, horizon, summary, customer_value, leverage, risk, ai_fit, cost, dependency, proof }) => ({
      id, name: itemName, category, horizon, summary, customer_value, leverage, risk, ai_fit, cost, dependency, proof,
    })),
  });

  const validateResult = (name, result) => {
    if (!result || result.schema !== RESULT_SCHEMA || result.principle_id !== name || !Array.isArray(result.scores) || result.scores.length !== initiatives.length) {
      throw new Error("The evaluator returned an incomplete score set.");
    }
    const seen = new Set();
    const byId = new Map();
    result.scores.forEach((row) => {
      if (!row || typeof row.initiative_id !== "string" || seen.has(row.initiative_id) || !Number.isInteger(row.score) || row.score < 1 || row.score > 5 || typeof row.reason !== "string" || !row.reason.trim()) {
        throw new Error("The evaluator returned an invalid score set.");
      }
      seen.add(row.initiative_id);
      byId.set(row.initiative_id, row);
    });
    if (initiatives.some((item) => !byId.has(item.id))) throw new Error("The evaluator omitted a queue item.");
    return byId;
  };

  const rescorePrinciple = async (name) => {
    const principle = principles[name];
    if (principle.running) return false;
    principle.running = true;
    principle.error = "";
    render();
    let succeeded = false;
    try {
      const response = await fetch("/api/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueRequest(name)),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !result.ok) {
        throw new Error(result && result.error && result.error.message ? result.error.message : `Re-score failed (${response.status}).`);
      }
      const byId = validateResult(name, result);
      const column = names.indexOf(name);
      initiatives.forEach((item) => {
        const scored = byId.get(item.id);
        item.scores[column] = scored.score;
        item.scoreReasons[name] = scored.reason.trim();
      });
      principle.scoredPrompt = principle.prompt;
      principle.provenance = {
        ...(result.provenance && typeof result.provenance === "object" ? result.provenance : { kind: "model", model: "unknown" }),
        prompt_hash: result.prompt_hash,
        queue_hash: result.queue_hash,
        request_hash: result.request_hash,
        result_hash: result.result_hash,
      };
      persistWorkspace();
      succeeded = true;
    } catch (error) {
      principle.error = String(error && error.message ? error.message : error).slice(0, 180);
    } finally {
      principle.running = false;
      render();
      renderDetail(initiatives.find((item) => item.id === selected));
      if (activePrinciple === name) {
        promptError.textContent = principle.error;
        promptError.hidden = !principle.error;
      }
    }
    return succeeded;
  };

  const money = (value) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);

  const renderCost = () => {
    const get = (id) => Math.max(0, Number(document.querySelector(`#${id}`).value) || 0);
    const units = get("units-day");
    const variable = get("variable-unit");
    const fixed = get("fixed-month");
    const customers = Math.max(1, get("customers"));
    const margin = Math.min(0.95, get("margin") / 100);
    const daily = units * variable;
    const monthly = daily * 30 + fixed;
    const costUnit = units ? monthly / (units * 30) : 0;
    const priceFloor = monthly / customers / (1 - margin);
    document.querySelector("#daily-variable").textContent = money(daily);
    document.querySelector("#monthly-total").textContent = money(monthly);
    document.querySelector("#cost-unit").textContent = money(costUnit);
    document.querySelector("#price-floor").textContent = money(priceFloor);
    document.querySelector("#cost-guardrail").textContent = `Daily review threshold: ${money(daily * 1.2 + fixed / 30)}. This is 120% of modeled daily operating spend, not an automatic provider shutoff.`;
  };

  loadWorkspace();
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      redistribute(input);
      document.querySelectorAll(".preset").forEach((button) => button.classList.remove("active"));
      render();
    });
    input.addEventListener("change", () => {
      persistWorkspace();
      render({ reorderPrinciples: true });
    });
  });
  document.querySelectorAll(".preset").forEach((button) => button.addEventListener("click", () => setPreset(button.dataset.preset)));
  document.querySelector("#reset").addEventListener("click", () => setPreset("balanced"));
  document.querySelectorAll("[data-edit-principle]").forEach((button) => button.addEventListener("click", () => openPrincipleEditor(button.dataset.editPrinciple)));
  document.querySelectorAll("[data-rescore-principle]").forEach((button) => button.addEventListener("click", () => rescorePrinciple(button.dataset.rescorePrinciple)));
  document.querySelector("#save-principle-prompt").addEventListener("click", () => { if (savePromptFromEditor()) editor.close(); });
  document.querySelector("#save-and-rescore").addEventListener("click", async () => { if (savePromptFromEditor() && await rescorePrinciple(activePrinciple)) editor.close(); });
  editor.addEventListener("close", () => { activePrinciple = ""; promptError.hidden = true; });
  document.querySelectorAll(".cost-inputs input").forEach((input) => input.addEventListener("input", renderCost));

  render({ reorderPrinciples: true });
  renderDetail(initiatives.find((item) => item.id === selected));
  renderCost();
})();
