type IdentityMetaPatch = {
  name: string;
  avatar: string;
};

const CONTROLLED_FIELDS = [
  ["name", "Name"],
  ["avatar", "Avatar"],
] as const;

const FIELD_LINE_PATTERN = /^\s*(?:[-*+]\s*)?(Name|Avatar)\s*:\s*(.*)$/i;
const GENERIC_FIELD_LINE_PATTERN = /^\s*(?:[-*+]\s*)?[A-Za-z][A-Za-z0-9 _-]*\s*:\s*.*$/;

function normalizeDocument(markdown: string) {
  return markdown.replace(/\r\n?/g, "\n");
}

function trimBlankEdges(lines: string[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function findInsertIndex(lines: string[]) {
  let start = 0;

  while (start < lines.length && lines[start].trim() === "") {
    start += 1;
  }

  let cursor = start;
  while (cursor < lines.length) {
    const line = lines[cursor].trim();
    if (!line || !GENERIC_FIELD_LINE_PATTERN.test(line)) {
      break;
    }
    cursor += 1;
  }

  return cursor > start ? cursor : start;
}

export function applyIdentityMetaToDocument(markdown: string, patch: IdentityMetaPatch) {
  const normalized = normalizeDocument(markdown || "");
  const sourceLines = normalized ? normalized.split("\n") : [];
  const nextValues = {
    name: patch.name.trim(),
    avatar: patch.avatar.trim(),
  };
  const seenFields = new Set<string>();
  const outputLines: string[] = [];

  for (const line of sourceLines) {
    const match = line.match(FIELD_LINE_PATTERN);
    if (!match) {
      outputLines.push(line);
      continue;
    }

    const key = match[1].toLowerCase() as keyof typeof nextValues;
    seenFields.add(key);

    const nextValue = nextValues[key];
    if (!nextValue) {
      continue;
    }

    const label = CONTROLLED_FIELDS.find(([fieldKey]) => fieldKey === key)?.[1] ?? match[1];
    outputLines.push(`- ${label}: ${nextValue}`);
  }

  const missingFieldLines = CONTROLLED_FIELDS.flatMap(([key, label]) =>
    nextValues[key]
      ? seenFields.has(key)
        ? []
        : [`- ${label}: ${nextValues[key]}`]
      : [],
  );

  const trimmedOutput = trimBlankEdges(outputLines);

  if (missingFieldLines.length === 0) {
    return trimmedOutput.join("\n");
  }

  const insertIndex = findInsertIndex(trimmedOutput);
  const nextDocumentLines = [...trimmedOutput];
  const nextLine = nextDocumentLines[insertIndex];
  const needsSpacer = Boolean(nextLine && nextLine.trim() !== "" && !GENERIC_FIELD_LINE_PATTERN.test(nextLine.trim()));

  nextDocumentLines.splice(insertIndex, 0, ...missingFieldLines, ...(needsSpacer ? [""] : []));

  return trimBlankEdges(nextDocumentLines).join("\n");
}
