import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "src");
const dataPath = path.join(rootDir, "data", "scorecards.json");
const distDir = path.join(rootDir, "dist");
const distAssetsDir = path.join(distDir, "assets");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateItem(item, itemPath, errors) {
  if (!isRecord(item)) {
    errors.push(`${itemPath} must be an object.`);
    return null;
  }

  const name = item.name;
  const value = item.value;

  if (typeof name !== "string" || name.trim() === "") {
    errors.push(`${itemPath}.name must be a non-empty string.`);
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${itemPath}.value must be a finite number greater than or equal to 0.`);
  }

  if (errors.length > 0 && (typeof name !== "string" || typeof value !== "number")) {
    return null;
  }

  return {
    name: typeof name === "string" ? name.trim() : "",
    value
  };
}

function validateItems(items, itemsPath, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${itemsPath} must be an array.`);
    return [];
  }

  return items
    .map((item, index) => validateItem(item, `${itemsPath}[${index}]`, errors))
    .filter(Boolean);
}

function validateScorecards(rawData) {
  const errors = [];

  if (!isRecord(rawData)) {
    return {
      errors: ["Root JSON value must be an object."],
      scorecards: []
    };
  }

  if (!Array.isArray(rawData.scorecards)) {
    return {
      errors: ["scorecards must be an array."],
      scorecards: []
    };
  }

  const seenSlugs = new Map();
  const scorecards = rawData.scorecards.map((scorecard, index) => {
    const scorecardPath = `scorecards[${index}]`;

    if (!isRecord(scorecard)) {
      errors.push(`${scorecardPath} must be an object.`);
      return null;
    }

    const year = scorecard.year;
    const name = scorecard.name;

    if (typeof year !== "string" || year.trim() === "") {
      errors.push(`${scorecardPath}.year must be a non-empty string.`);
    }

    if (typeof name !== "string" || name.trim() === "") {
      errors.push(`${scorecardPath}.name must be a non-empty string.`);
    }

    const label = `${typeof year === "string" ? year.trim() : ""} - ${typeof name === "string" ? name.trim() : ""}`;
    const slug = slugify(label);

    if (slug === "") {
      errors.push(`${scorecardPath} must produce a non-empty slug from year and name.`);
    } else if (seenSlugs.has(slug)) {
      errors.push(`${scorecardPath} duplicates the generated slug "${slug}" from ${seenSlugs.get(slug)}.`);
    } else {
      seenSlugs.set(slug, scorecardPath);
    }

    return {
      slug,
      year: typeof year === "string" ? year.trim() : "",
      name: typeof name === "string" ? name.trim() : "",
      label,
      positive: validateItems(scorecard.positive, `${scorecardPath}.positive`, errors),
      negative: validateItems(scorecard.negative, `${scorecardPath}.negative`, errors)
    };
  }).filter(Boolean);

  return { errors, scorecards };
}

async function build() {
  const rawJson = await readFile(dataPath, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.relative(rootDir, dataPath)}: ${error.message}`);
  }

  const { errors, scorecards } = validateScorecards(parsed);

  if (errors.length > 0) {
    throw new Error(`Invalid scorecard data:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distAssetsDir, { recursive: true });
  await cp(sourceDir, distDir, { recursive: true });

  const payload = JSON.stringify({ scorecards }, null, 2).replace(/</g, "\\u003c");
  await writeFile(
    path.join(distAssetsDir, "data.js"),
    `window.SCORECARD_DATA = ${payload};\n`,
    "utf8"
  );
  await writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

  console.log(`Built ${scorecards.length} scorecard${scorecards.length === 1 ? "" : "s"} into dist/.`);
}

build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
