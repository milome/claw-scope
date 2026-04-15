import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { I18N_RUNTIME_DICT, I18N_SLOT_COUNT } from "../src/app/contexts/I18nContext";

const APP_ROOT = path.resolve(process.cwd(), "src/app");
const COMPONENT_ROOT = path.resolve(process.cwd(), "src/app/components");
const EXTENSIONS = new Set([".ts", ".tsx"]);
const UI_ATTRIBUTE_NAMES = new Set([
  "title",
  "placeholder",
  "aria-label",
  "ariaLabel",
  "label",
  "alt",
]);
const UI_OBJECT_FIELDS = new Set([
  "label",
  "description",
  "title",
  "subtitle",
  "meta",
]);
const UI_VARIABLE_NAMES = new Set(["primaryIssue"]);
const SKIP_FILES = [
  /I18nContext\.tsx$/,
  /evolutionI18n\.ts$/,
  /\.test\./,
  /RichContentRenderer\.tsx$/,
];
const ALLOWED_UI_LITERALS = [
  /^ClawScope$/,
  /^OpenClaw$/,
  /^IDENTITY\.md$/,
  /^SOUL\.md$/,
  /^MEMORY\.md$/,
  /^code$/i,
  /^plain$/i,
  /^Beta$/i,
  /^LIVE$/i,
  /^SANDBOXED$/i,
  /^http:\/\//i,
  /^https:\/\//i,
  /^custom:\/\//i,
  /^openclaw\s+/i,
  /^bytes$/i,
  /^ms$/i,
  /^document$/i,
  /^custom,\s*safe$/i,
];

type Finding = {
  file: string;
  line: number;
  kind: string;
  text: string;
};

function walk(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isHumanText(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (/^[\d\s:.,+\-_/()[\]{}#*&|<>=%]+$/.test(normalized)) {
    return false;
  }
  return /[A-Za-z\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0900-\u097f]/.test(
    normalized,
  );
}

function isAllowedUiLiteral(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }
  return ALLOWED_UI_LITERALS.some((pattern) => pattern.test(normalized));
}

function shouldSkipFile(file: string) {
  const normalized = file.replace(/\\/g, "/");
  return SKIP_FILES.some((pattern) => pattern.test(normalized));
}

function createSourceFile(file: string) {
  const sourceText = fs.readFileSync(file, "utf8");
  return ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectMissingI18nKeys() {
  const findings: Finding[] = [];
  for (const file of walk(APP_ROOT)) {
    if (shouldSkipFile(file)) {
      continue;
    }
    const sourceFile = createSourceFile(file);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(sourceFile) === "t" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        if (!(key in I18N_RUNTIME_DICT)) {
          findings.push({
            file,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.arguments[0].getStart(sourceFile))
                .line + 1,
            kind: "missing-key",
            text: key,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return findings;
}

function collectHardcodedUiLiterals() {
  const findings: Finding[] = [];

  for (const file of walk(COMPONENT_ROOT)) {
    if (shouldSkipFile(file) || !file.endsWith(".tsx")) {
      continue;
    }
    const sourceFile = createSourceFile(file);
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = normalizeText(node.getText(sourceFile));
        if (isHumanText(text) && !isAllowedUiLiteral(text)) {
          findings.push({
            file,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            kind: "jsx-text",
            text,
          });
        }
      }

      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile);
        if (
          UI_ATTRIBUTE_NAMES.has(name) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
        ) {
          const text = normalizeText(node.initializer.text);
          if (isHumanText(text) && !isAllowedUiLiteral(text)) {
            findings.push({
              file,
              line:
                sourceFile.getLineAndCharacterOfPosition(node.initializer.getStart(sourceFile))
                  .line + 1,
              kind: `prop:${name}`,
              text,
            });
          }
        }
      }

      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name.getText(sourceFile).replace(/['"]/g, "");
        if (
          UI_OBJECT_FIELDS.has(propertyName) &&
          (ts.isStringLiteral(node.initializer) ||
            ts.isNoSubstitutionTemplateLiteral(node.initializer))
        ) {
          const text = normalizeText(node.initializer.text);
          if (isHumanText(text) && !isAllowedUiLiteral(text)) {
            findings.push({
              file,
              line:
                sourceFile.getLineAndCharacterOfPosition(node.initializer.getStart(sourceFile))
                  .line + 1,
              kind: `object:${propertyName}`,
              text,
            });
          }
        }
      }

      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        UI_VARIABLE_NAMES.has(node.name.text) &&
        node.initializer &&
        (ts.isStringLiteral(node.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(node.initializer))
      ) {
        const text = normalizeText(node.initializer.text);
        if (isHumanText(text) && !isAllowedUiLiteral(text)) {
          findings.push({
            file,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.initializer.getStart(sourceFile))
                .line + 1,
            kind: `variable:${node.name.text}`,
            text,
          });
        }
      }

      if (
        ts.isCallExpression(node) &&
        ["toast.success", "toast.error", "toast", "confirm"].includes(
          node.expression.getText(sourceFile),
        ) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const text = normalizeText(node.arguments[0].text);
        if (isHumanText(text) && !isAllowedUiLiteral(text)) {
          findings.push({
            file,
            line:
              sourceFile.getLineAndCharacterOfPosition(node.arguments[0].getStart(sourceFile))
                .line + 1,
            kind: `call:${node.expression.getText(sourceFile)}`,
            text,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return findings;
}

describe("i18n governance", () => {
  it("keeps every runtime dictionary entry at 13 slots", () => {
    const mismatches = Object.entries(I18N_RUNTIME_DICT)
      .filter(([, values]) => values.length !== I18N_SLOT_COUNT)
      .map(([key, values]) => `${key}:${values.length}`);

    expect(mismatches).toEqual([]);
  });

  it("keeps all literal t() keys backed by the runtime dictionary", () => {
    const findings = collectMissingI18nKeys().map(
      (item) => `${path.relative(process.cwd(), item.file)}:${item.line} -> ${item.text}`,
    );

    expect(findings).toEqual([]);
  });

  it("rejects hardcoded user-facing UI literals outside the i18n allowlist", () => {
    const findings = collectHardcodedUiLiterals().map(
      (item) =>
        `${path.relative(process.cwd(), item.file)}:${item.line} [${item.kind}] ${item.text}`,
    );

    expect(findings).toEqual([]);
  });
});
