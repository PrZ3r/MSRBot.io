/*
Copyright (c) 2025-26 PrZ3 LLC (d/b/a [PrZ3](https://github.com/PrZ3r))

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

3. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.

4. Neither the name of the copyright holder nor the names of its contributors may
   be used to endorse or promote products derived from this software without specific
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
 * publishers.test.js — src/main/config/publishers.json and its loader.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PUBLISHERS_PATH, loadPublisherConfig } = require('../../lib/publishers');

let n = 0;
const eq = (got, want, msg) => { assert.deepStrictEqual(got, want, msg); n++; };

const raw = JSON.parse(fs.readFileSync(PUBLISHERS_PATH, 'utf8'));
const cfg = loadPublisherConfig();
const names = Object.keys(raw.publishers);

// Entries stay sorted by name, so the file scans alphabetically.
eq(names, [...names].sort((a, b) => a.localeCompare(b)), 'publishers.json entries out of localeCompare order');

// Only the known fields, so a typo ("logodark") can't silently drop a logo.
const FIELDS = new Set(['url', 'logo', 'logoDark', 'aliases', 'dateless']);
eq(names.flatMap((name) => Object.keys(raw.publishers[name]).filter((f) => !FIELDS.has(f)).map((f) => `${name}.${f}`)), [], 'unknown publisher fields');

// Every logo is a file the build copies.
const siteRoot = path.join(__dirname, '..', '..', '..', 'site');
const missing = [...Object.entries(cfg.logos), ...Object.entries(cfg.logosDark)]
  .filter(([, rel]) => !fs.existsSync(path.join(siteRoot, rel)))
  .map(([name, rel]) => `${name}: ${rel}`);
eq(missing, [], 'logo files missing under src/site/');

// Aliases resolve to their entry; dateless covers them.
eq(cfg.aliases['Academy of Motion Picture Arts and Sciences'], 'AMPAS', 'alias → publisher');
eq(cfg.dateless.includes('AMPAS') && cfg.dateless.includes('Academy of Motion Picture Arts and Sciences'), true, 'dateless covers aliases');
eq(cfg.dateless.includes('SMPTE'), false, 'SMPTE is not dateless');
eq(typeof cfg.logoHeight, 'number', 'logoHeight is a number');

// One alias under two publishers is ambiguous and throws.
{
  const bad = path.join(os.tmpdir(), `publishers-${process.pid}.json`);
  fs.writeFileSync(bad, JSON.stringify({ publishers: { A: { aliases: ['X'] }, B: { aliases: ['X'] } } }));
  let threw = false;
  try { loadPublisherConfig(bad); } catch { threw = true; }
  fs.unlinkSync(bad);
  eq(threw, true, 'duplicate alias throws');
}

console.log(`publishers.test.js — ${n} cases passed`);
