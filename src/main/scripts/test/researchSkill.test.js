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
 * researchSkill.test.js — pins the msrbot-research skill's packaging:
 *   - SKILL.md frontmatter `name` matches its directory (Agent Skills rule).
 *   - SKILL.md `metadata.version` equals research/.claude-plugin/plugin.json
 *     `version`. The claude.ai zip carries only the skill folder (no
 *     plugin.json), so metadata.version is the only version a zip install sees.
 *   - The description stays within the 1,024-character limit.
 *
 *   node src/main/scripts/test/researchSkill.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const skillDir = path.join(repoRoot, 'research', 'skills', 'msrbot-research');
const skillMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const plugin = JSON.parse(fs.readFileSync(path.join(repoRoot, 'research', '.claude-plugin', 'plugin.json'), 'utf8'));

const fm = skillMd.match(/^---\n([\s\S]*?)\n---\n/);
assert.ok(fm, 'SKILL.md must start with YAML frontmatter');
const front = fm[1];

const name = (front.match(/^name:\s*(.+)$/m) || [])[1];
assert.strictEqual(name && name.trim(), path.basename(skillDir), 'frontmatter name must match the skill directory');

const description = (front.match(/^description:\s*(.+)$/m) || [])[1] || '';
assert.ok(description.length > 0 && description.length <= 1024, `description must be 1–1024 chars (is ${description.length})`);

const meta = front.match(/^metadata:\n((?:[ \t]+.+\n?)+)/m);
assert.ok(meta, 'SKILL.md frontmatter must have a metadata block');
const version = (meta[1].match(/^[ \t]+version:\s*"?([^"\n]+)"?\s*$/m) || [])[1];
assert.ok(version, 'SKILL.md metadata must include version');
assert.strictEqual(version, plugin.version,
  `SKILL.md metadata.version (${version}) must equal research/.claude-plugin/plugin.json version (${plugin.version})`);

console.log(`researchSkill.test.js — all assertions passed (skill ${version})`);
