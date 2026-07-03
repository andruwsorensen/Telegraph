import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const morseMatch = source.match(/const MORSE = (\{[\s\S]*?\n\});/);
const referenceMatch = source.match(/const referenceCharacters = "([^"]+)";/);

assert.ok(morseMatch, "MORSE map should exist");
assert.ok(referenceMatch, "referenceCharacters should exist");

const MORSE = Function(`"use strict"; return (${morseMatch[1]});`)();
const referenceCharacters = referenceMatch[1];

assert.deepEqual(
  Object.fromEntries("1234567890".split("").map((digit) => [digit, MORSE[digit]])),
  {
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----.",
    0: "-----",
  },
);

assert.ok(
  referenceCharacters.endsWith("1234567890"),
  "Morse reference should show numbers in standard 1-9, then 0 order",
);
