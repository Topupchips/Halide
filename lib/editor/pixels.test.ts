import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from "./color";
import { dragRect } from "./geom";
import {
  applyMasked,
  brightnessContrast,
  floodFill,
  gaussianBlur,
  invert,
  levels,
} from "./pixels";

describe("color", () => {
  it("round-trips hex and hsv", () => {
    const [r, g, b] = hexToRgb("#e4a574");
    assert.deepEqual([r, g, b], [228, 165, 116]);
    const [h, s, v] = rgbToHsv(r, g, b);
    const [nr, ng, nb] = hsvToRgb(h, s, v);
    assert.equal(rgbToHex(nr, ng, nb), "#e4a574");
  });
});

describe("geometry", () => {
  it("constrains a centered square", () => {
    const rect = dragRect({ x: 10, y: 10 }, { x: 20, y: 14 }, { square: true, center: true });
    assert.deepEqual(rect, { x: 0, y: 0, w: 20, h: 20 });
  });
});

describe("pixels", () => {
  it("raises brightness without changing alpha", () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255]);
    brightnessContrast(data, 20, 0);
    assert.ok(data[0] > 10);
    assert.equal(data[3], 255);
  });

  it("inverts channels", () => {
    const data = new Uint8ClampedArray([0, 128, 255, 200]);
    invert(data);
    assert.deepEqual(Array.from(data), [255, 127, 0, 200]);
  });

  it("maps the black point through levels", () => {
    const data = new Uint8ClampedArray([0, 128, 255, 255]);
    levels(data, 0, 255, 1, 20, 255);
    assert.equal(data[0], 20);
    assert.equal(data[2], 255);
  });

  it("leaves masked-out pixels alone", () => {
    const data = new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 255]);
    const mask = new Uint8Array([255, 0]);
    applyMasked(data, 2, 1, mask, (pixels) => {
      pixels[0] = 200;
      pixels[4] = 200;
    });
    assert.equal(data[0], 200);
    assert.equal(data[4], 10);
  });

  it("floods a bounded region", () => {
    const width = 4;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = 255;
    }
    for (let y = 0; y < height; y++) {
      const index = (y * width + 2) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
    }
    floodFill(data, width, height, 0, 1, [255, 0, 0, 255], 0, null);
    assert.equal(data[0], 255);
    assert.equal(data[1], 0);
    assert.equal(data[(1 * width + 3) * 4], 255);
    assert.equal(data[(1 * width + 3) * 4 + 1], 255);
  });

  it("spreads a bright pixel when blurred", () => {
    const width = 7;
    const height = 7;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 3; index < data.length; index += 4) data[index] = 255;
    const center = (3 * width + 3) * 4;
    data[center] = 255;
    data[center + 1] = 255;
    data[center + 2] = 255;
    const blurred = gaussianBlur(data, width, height, 2);
    const neighbor = (3 * width + 4) * 4;
    assert.ok(blurred[center] < 255);
    assert.ok(blurred[neighbor] > 0);
  });
});
