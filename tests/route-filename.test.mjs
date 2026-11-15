import assert from "node:assert/strict";
import { test } from "node:test";
import { routeToFilename } from "../scripts/ci/route-filename.mjs";

test("homepage and captured /index route have distinct preview files", () => {
  for (const extension of ["png", "webm"]) {
    assert.equal(routeToFilename("/", extension), `__root__.${extension}`);
    assert.equal(routeToFilename("/index", extension), `index.${extension}`);
  }
});

test("nested routes keep readable preview filenames", () => {
  assert.equal(routeToFilename("/lookbook/looks/babes-day", "png"), "lookbook--looks--babes-day.png");
});
