import { it, expect } from "vitest";
import { imageDimensions } from "./imageCompression";
it("limite les deux orientations à 1000 px en conservant le ratio", () => {
  expect(imageDimensions(4000, 3000)).toEqual({ width: 1000, height: 750 });
  expect(imageDimensions(3000, 4000)).toEqual({ width: 750, height: 1000 });
  expect(imageDimensions(400, 300)).toEqual({ width: 400, height: 300 });
});
