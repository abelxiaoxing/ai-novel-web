/**
 * Chapter Parser Utility
 * Parses chapter information from blueprint text
 * Based on the Python implementation in chapter_directory_parser.py
 */

export interface ChapterInfo {
  chapterNumber: number;
  title: string;
  role: string;
  purpose: string;
  suspenseLevel: string;
  foreshadowing: string;
  plotTwistLevel: string;
  summary: string;
  characters: string[];
  scenes: string[];
}

type ChapterFieldParser = {
  pattern: RegExp;
  apply: (info: ChapterInfo, value: string) => void;
};

const CHAPTER_HEADER_PATTERN = /^第\s*(\d+)\s*章\s*-\s*\[?(.*?)\]?$/;

const CHAPTER_FIELD_PARSERS: ChapterFieldParser[] = [
  { pattern: /^本章定位：\s*(.*)$/, apply: (info, value) => (info.role = normalizeFieldValue(value)) },
  { pattern: /^核心作用：\s*(.*)$/, apply: (info, value) => (info.purpose = normalizeFieldValue(value)) },
  {
    pattern: /^悬念密度：\s*(.*)$/,
    apply: (info, value) => (info.suspenseLevel = normalizeFieldValue(value)),
  },
  {
    pattern: /^伏笔操作：\s*(.*)$/,
    apply: (info, value) => (info.foreshadowing = normalizeFieldValue(value)),
  },
  {
    pattern: /^认知颠覆：\s*(.*)$/,
    apply: (info, value) => (info.plotTwistLevel = normalizeFieldValue(value)),
  },
  { pattern: /^本章简述：\s*(.*)$/, apply: (info, value) => (info.summary = normalizeFieldValue(value)) },
  {
    pattern: /^(?:核心人物|主要人物|人物|角色)：\s*(.*)$/,
    apply: (info, value) => (info.characters = parseListField(normalizeFieldValue(value))),
  },
  {
    pattern: /^(?:场景|地点|场景地点)：\s*(.*)$/,
    apply: (info, value) => (info.scenes = parseListField(normalizeFieldValue(value))),
  },
];

export function parseChapterBlueprint(blueprintText: string): ChapterInfo[] {
  if (!blueprintText || typeof blueprintText !== "string") {
    return [];
  }

  const chunks = blueprintText.trim().split(/\n\s*\n/);
  const results: ChapterInfo[] = [];

  for (const chunk of chunks) {
    const lines = chunk.trim().split("\n");
    if (lines.length === 0) {
      continue;
    }

    const headerMatch = CHAPTER_HEADER_PATTERN.exec(lines[0].trim());
    if (!headerMatch) {
      continue;
    }

    const info = createDefaultChapterInfo(parseInt(headerMatch[1], 10));
    info.title = headerMatch[2].trim();

    parseChapterLines(info, lines);
    fillMissingSummaryDerivedFields(info);
    results.push(info);
  }

  results.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return results;
}

export function getChapterInfoFromBlueprint(
  blueprintText: string,
  targetChapterNumber: number
): ChapterInfo | null {
  const allChapters = parseChapterBlueprint(blueprintText);
  return allChapters.find((ch) => ch.chapterNumber === targetChapterNumber) ?? null;
}

function parseChapterLines(info: ChapterInfo, lines: string[]): void {
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    applyFirstMatchingFieldParser(info, line);
  }
}

function applyFirstMatchingFieldParser(info: ChapterInfo, line: string): void {
  for (const parser of CHAPTER_FIELD_PARSERS) {
    const match = parser.pattern.exec(line);
    if (!match) {
      continue;
    }
    parser.apply(info, match[1].trim());
    return;
  }
}

function fillMissingSummaryDerivedFields(info: ChapterInfo): void {
  if (!info.summary) {
    return;
  }
  if (info.characters.length === 0) {
    info.characters = extractCharactersFromText(info.summary);
  }
  if (info.scenes.length === 0) {
    info.scenes = extractScenesFromText(info.summary);
  }
}

function normalizeFieldValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseListField(value: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/、/)
    .filter((item) => item.length > 0);
}

function extractCharactersFromText(text: string): string[] {
  const patterns = [/「([^」]{2,6})」/g, /『([^』]{2,6})』/g, /"([^"]{2,6})"/g, /'([^']{2,6})'/g];
  return extractUniqueMatches(text, patterns);
}

function extractScenesFromText(text: string): string[] {
  const locationPatterns = [/在([^，。、]{2,10})[，。]/g, /到([^，。、]{2,10})[，。]/g, /于([^，。、]{2,10})[，。]/g];
  return extractUniqueMatches(text, locationPatterns);
}

function extractUniqueMatches(text: string, patterns: RegExp[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1].trim();
      if (value) {
        results.push(value);
      }
    }
  }
  return uniqueItems(results);
}

function uniqueItems(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function createDefaultChapterInfo(chapterNumber: number): ChapterInfo {
  return {
    chapterNumber,
    title: `第${chapterNumber}章`,
    role: "",
    purpose: "",
    suspenseLevel: "",
    foreshadowing: "",
    plotTwistLevel: "",
    summary: "",
    characters: [],
    scenes: [],
  };
}
