#!/usr/bin/env -S deno run --allow-all --unstable-ffi --unstable-temporal

import { Database } from "jsr:@db/sqlite@0.11";

async function* lines(file: Deno.FsFile) {
  let buffer = "";
  for await (
    const chunk of file.readable.pipeThrough(new TextDecoderStream())
  ) {
    buffer += chunk;
    if (buffer.includes("\n")) {
      const ls = buffer.split(/\r?\n/g);
      buffer = ls.pop()!;
      yield* ls;
    }
  }
}

function parseLine(line: string): [number, number, number] {
  const match = line.match(
    /^\d+,(?<v1>\d+\.\d+),(?<v2>\d+\.\d+),(?<v3>\d+\.\d+);(?<checksum>\d+)$/,
  );
  if (!match) throw "Invalid line format";

  const checksum = [...line.split(";")[0]].reduce(
    (sum, char) => sum + char.codePointAt(0)!,
    0,
  );

  if (Number(match.groups!.checksum) !== checksum) throw "Invalid checksum";

  return [
    Number(match.groups!.v1),
    Number(match.groups!.v2),
    Number(match.groups!.v3),
  ];
}

const db = new Database("measurements.sqlite");
db.run(`
  CREATE TABLE IF NOT EXISTS bat (
    timestamp INTEGER PRIMARY KEY,
    v1 DECIMAL(7,6),
    v2 DECIMAL(7,6),
    v3 DECIMAL(7,6)
  );
`);

const insertQuery = db.prepare(`
  INSERT INTO bat (timestamp, v1, v2, v3)
  VALUES (?, ?, ?, ?)
`);
const insertQueries = db.transaction(
  (entries: [number, number, number, number][]) => {
    for (const entry of entries) insertQuery.run(entry);
  },
);

using uart = await Deno.open("/dev/ttyACM0");
const entries: [number, number, number, number][] = [];
for await (const line of lines(uart)) {
  try {
    const values = parseLine(line);
    const timestamp = Math.floor(
      Temporal.Now.instant().epochMilliseconds / 1_000,
    );
    entries.push([timestamp, ...values]);

    if (entries.length > 10) {
      insertQueries(entries);
      entries.length = 0;
    }
  } catch (e) {
    console.error(e);
    entries.length = 0;
  }
}
