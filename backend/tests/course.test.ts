import { describe, it, expect } from "vitest";
import slugify from "../src/lib/slugify.js";
import { getSignedPlaybackUrl, getBunnySignedUrl } from "../src/lib/video.js";

describe("slugify (usado em createCourse)", () => {
  it("gera slug minúsculo com hífens", () => {
    expect(slugify("Curso de TypeScript")).toBe("curso-de-typescript");
  });
});

describe("video signed url", () => {
  it("gera URL HLS a partir do playbackId (fallback dev sem chaves)", () => {
    const url = getSignedPlaybackUrl("abc123");
    expect(url).toContain("abc123.m3u8");
  });
  it("gera URL assinada Bunny com token e expires", () => {
    const url = getBunnySignedUrl("vid1", "lib1");
    expect(url).toContain("token=");
    expect(url).toContain("expires=");
  });
});
