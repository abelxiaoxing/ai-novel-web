import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getChapterInfoFromBlueprint } from "./chapterParser";

describe("Chapter Parser Properties", () => {
  it("extracts characters and scenes for a chapter", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 5 }),
        (chapterNumber, characters, scenes) => {
          const blueprint = [
            `第${chapterNumber}章 - [标题]`,
            `核心人物：[${characters.join("、")}]`,
            `场景：[${scenes.join("、")}]`,
            "本章简述：[测试内容]",
          ].join("\n");
          const info = getChapterInfoFromBlueprint(blueprint, chapterNumber);
          expect(info).not.toBeNull();
          expect(info?.characters).toEqual(characters);
          expect(info?.scenes).toEqual(scenes);
        }
      )
    );
  });
});
