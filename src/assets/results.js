(function () {
  const data = window.SCORECARD_DATA || { scorecards: [] };
  const elements = {
    title: document.getElementById("resultTitle"),
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
    errorPanel: document.getElementById("errorPanel"),
    resultContent: document.getElementById("resultContent"),
    editLink: document.getElementById("editLink")
  };

  function decodeUrlSafeBase64(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validateIndexes(indexes, maxLength, label) {
    if (!Array.isArray(indexes)) {
      throw new Error(`${label} must be an array.`);
    }

    const seen = new Set();

    indexes.forEach((index) => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= maxLength) {
        throw new Error(`${label} contains an invalid item reference.`);
      }

      if (seen.has(index)) {
        throw new Error(`${label} contains a duplicate item reference.`);
      }

      seen.add(index);
    });

    return indexes;
  }

  function parsePayload() {
    const encoded = new URLSearchParams(window.location.search).get("r");

    if (!encoded) {
      throw new Error("Missing result payload.");
    }

    const payload = decodeUrlSafeBase64(encoded);

    if (!isRecord(payload) || typeof payload.card !== "string") {
      throw new Error("Invalid result payload.");
    }

    const scorecard = data.scorecards.find((candidate) => candidate.slug === payload.card);

    if (!scorecard) {
      throw new Error("Scorecard not found.");
    }

    return {
      scorecard,
      positive: validateIndexes(payload.positive, scorecard.positive.length, "positive"),
      deductions: validateIndexes(payload.deductions, scorecard.negative.length, "deductions")
    };
  }

  function sumSelected(items, indexes) {
    return indexes.reduce((total, index) => total + items[index].value, 0);
  }

  function setText(element, value) {
    element.textContent = String(value);
  }

  function renderSelectedList(container, items, indexes, group) {
    if (indexes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = group === "positive" ? "No positive items selected." : "No deductions selected.";
      container.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    indexes.forEach((index) => {
      const item = items[index];
      const row = document.createElement("div");
      row.className = "point-row point-row-static";

      const marker = document.createElement("span");
      marker.className = "checked-marker";
      marker.textContent = "Checked";

      const name = document.createElement("span");
      name.className = "point-name";
      name.textContent = item.name;

      const value = document.createElement("span");
      value.className = group === "positive" ? "point-value positive-value" : "point-value deduction-value";
      value.textContent = `${group === "positive" ? "+" : "-"}${item.value}`;

      row.append(marker, name, value);
      fragment.append(row);
    });

    container.replaceChildren(fragment);
  }

  function renderResult(result) {
    const positiveTotal = sumSelected(result.scorecard.positive, result.positive);
    const deductionTotal = sumSelected(result.scorecard.negative, result.deductions);
    const finalScore = Math.max(0, positiveTotal - deductionTotal);

    elements.title.textContent = result.scorecard.label;
    elements.editLink.href = `./index.html?card=${encodeURIComponent(result.scorecard.slug)}`;
    setText(elements.scoreValue, finalScore);
    setText(elements.positiveTotal, positiveTotal);
    setText(elements.deductionTotal, deductionTotal);
    setText(elements.summaryPositive, positiveTotal);
    setText(elements.summaryDeductions, deductionTotal);
    setText(elements.summaryScore, finalScore);
    setText(elements.positiveCount, `${result.positive.length} selected`);
    setText(elements.deductionCount, `${result.deductions.length} selected`);
    renderSelectedList(elements.positiveList, result.scorecard.positive, result.positive, "positive");
    renderSelectedList(elements.deductionList, result.scorecard.negative, result.deductions, "deductions");
  }

  function renderError(error) {
    elements.errorPanel.hidden = false;
    elements.errorPanel.textContent = error.message;
    elements.resultContent.hidden = true;
    elements.editLink.href = "./index.html";
  }

  try {
    renderResult(parsePayload());
  } catch (error) {
    renderError(error);
  }
})();
