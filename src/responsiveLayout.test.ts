import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("contrat de mise en page mobile iPhone 16 Pro", () => {
  it("contraint l’application au viewport, respecte les safe areas et centre les modales", () => {
    expect(styles).toMatch(/--safe-top:\s*max\(env\(safe-area-inset-top,\s*59px\),\s*59px\)/);
    expect(styles).toMatch(/--safe-bottom:\s*max\(env\(safe-area-inset-bottom,\s*34px\),\s*34px\)/);
    expect(styles).toMatch(/\.device-frame\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*width:\s*100vw;[^}]*height:\s*100dvh;[^}]*padding-top:\s*var\(--safe-top\);[^}]*padding-bottom:\s*var\(--safe-bottom\);[^}]*overflow:\s*hidden;/s);
    expect(styles).toMatch(/\.modal\s*\{[^}]*inset:\s*0;[^}]*margin:\s*auto;[^}]*width:\s*min\(361px,\s*calc\(100vw\s*-\s*32px\)\);[^}]*max-height:\s*calc\([\s\S]*?var\(--safe-top\)[\s\S]*?var\(--safe-bottom\)/);
  });
});
