(function () {
  const data = window.SCORECARD_DATA || { scorecards: [] };
  const elements = {
    select: document.getElementById("scorecardSelect"),
    title: document.getElementById("scorecardTitle"),
    recipientName: document.getElementById("recipientName"),
    scoreValue: document.getElementById("scoreValue"),
    positiveTotal: document.getElementById("positiveTotal"),
    deductionTotal: document.getElementById("deductionTotal"),
    summaryPositive: document.getElementById("summaryPositive"),
    summaryDeductions: document.getElementById("summaryDeductions"),
    summaryScore: document.getElementById("summaryScore"),
    positiveCount: document.getElementById("positiveCount"),
    deductionCount: document.getElementById("deductionCount"),
    positiveList: document.getElementById("positiveList"),
    deductionList: document.getElementById("deductionList"),
    generateResult: document.getElementById("generateResult"),
    resultLinkPanel: document.getElementById("resultLinkPanel"),
    resultUrl: document.getElementById("resultUrl"),
    copyResult: document.getElementById("copyResult")
  };

  const selected = {
    slug: getInitialSlug(),
    positive: new Set(),
    deductions: new Set()
  };

  function normalizeRecipientName(value) {
    return value.trim().replace(/\s+/g, " ").slice(0, 120);
  }

  function getInitialSlug() {
    const requested = new URLSearchParams(window.location.search).get("card");
    if (requested && data.scorecards.some((scorecard) => scorecard.slug === requested)) {
      return requested;
    }

    return data.scorecards[0] ? data.scorecards[0].slug : "";
  }

  function getInitialRecipientName() {
    const requested = new URLSearchParams(window.location.search).get("recipient");
    return requested ? normalizeRecipientName(requested) : "";
  }

  function getCurrentScorecard() {
    return data.scorecards.find((scorecard) => scorecard.slug === selected.slug) || null;
  }

  function formatItemCount(count) {
    return `${count} item${count === 1 ? "" : "s"}`;
  }

  function sumItems(items, indexes) {
    return Array.from(indexes).reduce((total, index) => total + items[index].value, 0);
  }

  function calculateTotals(scorecard) {
    const positive = sumItems(scorecard.positive, selected.positive);
    const deductions = sumItems(scorecard.negative, selected.deductions);
    return {
      positive,
      deductions,
      score: Math.max(0, positive - deductions)
    };
  }

  function setText(element, value) {
    element.textContent = String(value);
  }

  function renderScorecardOptions() {
    elements.select.replaceChildren();

    data.scorecards.forEach((scorecard) => {
      const option = document.createElement("option");
      option.value = scorecard.slug;
      option.textContent = scorecard.label;
      elements.select.append(option);
    });

    elements.select.value = selected.slug;
    elements.select.disabled = data.scorecards.length === 0;
  }

  function renderEmptyState(container, text) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = text;
    container.replaceChildren(empty);
  }

  function renderPointList(container, items, group, selectedIndexes) {
    if (items.length === 0) {
      renderEmptyState(container, group === "positive" ? "No achievements." : "No deductions.");
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
      const label = document.createElement("label");
      label.className = "point-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.group = group;
      checkbox.dataset.index = String(index);
      checkbox.checked = selectedIndexes.has(index);

      const name = document.createElement("span");
      name.className = "point-name";
      name.textContent = item.name;

      const value = document.createElement("span");
      value.className = group === "positive" ? "point-value positive-value" : "point-value deduction-value";
      value.textContent = `${group === "positive" ? "+" : "-"}${item.value}`;

      label.append(checkbox, name, value);
      fragment.append(label);
    });

    container.replaceChildren(fragment);
  }

  function resetSelections() {
    selected.positive.clear();
    selected.deductions.clear();
    elements.resultLinkPanel.hidden = true;
    elements.resultUrl.value = "";
  }

  function render() {
    const scorecard = getCurrentScorecard();

    if (!scorecard) {
      elements.title.textContent = "No scorecards";
      elements.generateResult.disabled = true;
      renderEmptyState(elements.positiveList, "No scorecards found.");
      renderEmptyState(elements.deductionList, "No deductions found.");
      return;
    }

    elements.generateResult.disabled = false;
    elements.title.textContent = scorecard.label;
    setText(elements.positiveCount, formatItemCount(scorecard.positive.length));
    setText(elements.deductionCount, formatItemCount(scorecard.negative.length));
    renderPointList(elements.positiveList, scorecard.positive, "positive", selected.positive);
    renderPointList(elements.deductionList, scorecard.negative, "deductions", selected.deductions);

    const totals = calculateTotals(scorecard);
    setText(elements.scoreValue, totals.score);
    setText(elements.positiveTotal, totals.positive);
    setText(elements.deductionTotal, totals.deductions);
    setText(elements.summaryPositive, totals.positive);
    setText(elements.summaryDeductions, totals.deductions);
    setText(elements.summaryScore, totals.score);
  }

  function encodeUrlSafeBase64(value) {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function sortedIndexes(indexes) {
    return Array.from(indexes).sort((left, right) => left - right);
  }

  function generateResultUrl() {
    const scorecard = getCurrentScorecard();

    if (!scorecard) {
      return "";
    }

    const payload = {
      card: scorecard.slug,
      positive: sortedIndexes(selected.positive),
      deductions: sortedIndexes(selected.deductions)
    };
    const recipientName = normalizeRecipientName(elements.recipientName.value);

    if (recipientName !== "") {
      payload.recipientName = recipientName;
    }

    const url = new URL("./results/", window.location.href);
    url.search = "";
    url.searchParams.set("r", encodeUrlSafeBase64(payload));
    return url.href;
  }

  elements.select.addEventListener("change", () => {
    selected.slug = elements.select.value;
    resetSelections();
    render();
  });

  elements.positiveList.addEventListener("change", handleCheckboxChange);
  elements.deductionList.addEventListener("change", handleCheckboxChange);
  elements.recipientName.addEventListener("input", () => {
    elements.resultLinkPanel.hidden = true;
    elements.resultUrl.value = "";
  });

  function handleCheckboxChange(event) {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    const index = Number(target.dataset.index);
    const targetSet = target.dataset.group === "positive" ? selected.positive : selected.deductions;

    if (target.checked) {
      targetSet.add(index);
    } else {
      targetSet.delete(index);
    }

    elements.resultLinkPanel.hidden = true;
    elements.resultUrl.value = "";
    render();
  }

  elements.generateResult.addEventListener("click", () => {
    const resultUrl = generateResultUrl();

    if (resultUrl === "") {
      return;
    }

    elements.resultUrl.value = resultUrl;
    elements.resultLinkPanel.hidden = false;
    elements.resultUrl.focus();
    elements.resultUrl.select();
  });

  elements.copyResult.addEventListener("click", async () => {
    if (elements.resultUrl.value === "") {
      return;
    }

    try {
      await navigator.clipboard.writeText(elements.resultUrl.value);
      elements.copyResult.textContent = "Copied";
      window.setTimeout(() => {
        elements.copyResult.textContent = "Copy";
      }, 1400);
    } catch {
      elements.resultUrl.focus();
      elements.resultUrl.select();
    }
  });

  renderScorecardOptions();
  elements.recipientName.value = getInitialRecipientName();
  render();
})();
