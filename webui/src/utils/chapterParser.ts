/**
 * Chapter Parser Utility
 * Parses chapter information from blueprint text
 * Based on the Python implementation in chapter_directory_parser.py
 */

export interface ChapterInfo {
  chapterNumber: number;
  title: string;
  role: string;        // 本章定位
  purpose: string;     // 核心作用
  suspenseLevel: string;  // 悬念密度
  foreshadowing: string;  // 伏笔操作
  plotTwistLevel: string; // 认知颠覆
  summary: string;     // 本章简述
  // Additional fields for form auto-fill
  characters: string[];
  scenes: string[];
}

/**
 * Parse the entire blueprint text and return an array of chapter info
 */
export function parseChapterBlueprint(blueprintText: string): ChapterInfo[] {
  if (!blueprintText || typeof blueprintText !== "string") {
    return [];
  }

  // Split by empty lines to separate chapters
  const chunks = blueprintText.trim().split(/\n\s*\n/);
  const results: ChapterInfo[] = [];

  // Pattern to match chapter header: 第1章 - 标题 or 第1章 - [标题]
  const chapterNumberPattern = /^第\s*(\d+)\s*章\s*-\s*\[?(.*?)\]?$/;
  
  // Patterns for various fields
  const rolePattern = /^本章定位：\s*\[?(.*)\]?$/;
  const purposePattern = /^核心作用：\s*\[?(.*)\]?$/;
  const suspensePattern = /^悬念密度：\s*\[?(.*)\]?$/;
  const foreshadowPattern = /^伏笔操作：\s*\[?(.*)\]?$/;
  const twistPattern = /^认知颠覆：\s*\[?(.*)\]?$/;
  const summaryPattern = /^本章简述：\s*\[?(.*)\]?$/;
  
  // Additional patterns for characters and scenes
  const charactersPattern = /^(?:核心人物|主要人物|人物|角色)：\s*\[?(.*)\]?$/;
  const scenePattern = /^(?:场景|地点|场景地点)：\s*\[?(.*)\]?$/;

  for (const chunk of chunks) {
    const lines = chunk.trim().split("\n");
    if (lines.length === 0) {
      continue;
    }

    // Match chapter header
    const headerMatch = chapterNumberPattern.exec(lines[0].trim());
    if (!headerMatch) {
      continue;
    }

    const chapterNumber = parseInt(headerMatch[1], 10);
    const title = headerMatch[2].trim();

    const info: ChapterInfo = {
      chapterNumber,
      title,
      role: "",
      purpose: "",
      suspenseLevel: "",
      foreshadowing: "",
      plotTwistLevel: "",
      summary: "",
      characters: [],
      scenes: [],
    };

    // Parse remaining lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      let match: RegExpExecArray | null;

      if ((match = rolePattern.exec(line))) {
        info.role = match[1].trim();
      } else if ((match = purposePattern.exec(line))) {
        info.purpose = match[1].trim();
      } else if ((match = suspensePattern.exec(line))) {
        info.suspenseLevel = match[1].trim();
      } else if ((match = foreshadowPattern.exec(line))) {
        info.foreshadowing = match[1].trim();
      } else if ((match = twistPattern.exec(line))) {
        info.plotTwistLevel = match[1].trim();
      } else if ((match = summaryPattern.exec(line))) {
        info.summary = match[1].trim();
      } else if ((match = charactersPattern.exec(line))) {
        info.characters = parseListField(match[1]);
      } else if ((match = scenePattern.exec(line))) {
        info.scenes = parseListField(match[1]);
      }
    }

    // Try to extract characters from summary if not explicitly listed
    if (info.characters.length === 0 && info.summary) {
      info.characters = extractCharactersFromText(info.summary);
    }

    // Try to extract scenes from summary if not explicitly listed
    if (info.scenes.length === 0 && info.summary) {
      info.scenes = extractScenesFromText(info.summary);
    }

    results.push(info);
  }

  // Sort by chapter number
  results.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return results;
}

/**
 * Get chapter info for a specific chapter number
 */
export function getChapterInfoFromBlueprint(
  blueprintText: string,
  targetChapterNumber: number
): ChapterInfo | null {
  const allChapters = parseChapterBlueprint(blueprintText);
  return allChapters.find((ch) => ch.chapterNumber === targetChapterNumber) ?? null;
}

/**
 * Parse a comma/、-separated list field into an array
 */
function parseListField(value: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[,，、;；]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Extract character names from text using common patterns
 * This is a heuristic approach for Chinese text
 */
function extractCharactersFromText(text: string): string[] {
  const characters: string[] = [];
  
  // Common patterns for character mentions in Chinese
  // Look for quoted names or names followed by action verbs
  const patterns = [
    /「([^」]{2,6})」/g,  // Names in 「」
    /『([^』]{2,6})』/g,  // Names in 『』
    /"([^"]{2,6})"/g,     // Names in ""
    /'([^']{2,6})'/g,     // Names in ''
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name && !characters.includes(name)) {
        characters.push(name);
      }
    }
  }

  return characters;
}

/**
 * Extract scene/location information from text
 */
function extractScenesFromText(text: string): string[] {
  const scenes: string[] = [];
  
  // Common location indicators in Chinese
  const locationPatterns = [
    /在([^，。、]{2,10})[，。]/g,  // 在...
    /到([^，。、]{2,10})[，。]/g,  // 到...
    /于([^，。、]{2,10})[，。]/g,  // 于...
  ];

  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = match[1].trim();
      if (location && !scenes.includes(location)) {
        scenes.push(location);
      }
    }
  }

  return scenes;
}

/**
 * Create a default chapter info object
 */
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
