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
 * manual provider — parser. Turns one record into a registry doc and runs its
 * citations through the same reference tooling as the SMPTE/IETF extractors:
 * parseRefId (refMap.json, then publisher families) and an MRI sighting per
 * parsed citation; anything unparsed goes to onBadRefs, which mints an orphan
 * slug carrying the citation text. A citation may carry an explicit `refId`
 * only for a documented judgment call (it is logged as mapSource manual:explicit).
 *
 * Per-field provenance hints on the record become `$meta` via extractDocs:
 *   metaSources {field: 'parsed'|'inferred'|'manual'}, metaSourceUrls {field: url},
 *   metaNotes {field: note}, metaFlags {field: {reviewRequired, flag}}.
 * Status fields use "status.<field>" keys.
 */

function hidden(target, key, value) {
  if (target && value !== undefined) Object.defineProperty(target, key, { value, enumerable: false, configurable: true, writable: true });
}

function scoped(map, prefix) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) if (k.startsWith(`${prefix}.`)) out[k.slice(prefix.length + 1)] = v;
  return out;
}

function createManualParser({ discovery, parseRefId, mriRecordSighting, onBadRefs }) {
  async function extractFromUrl(key) {
    const rec = discovery.getRecord(key);
    if (!rec) throw new Error(`no manual record for ${key}`);
    const {
      citations = {}, sourceUrl, metaSources = {}, metaSourceUrls = {}, metaNotes = {}, metaFlags = {},
      ...fields
    } = rec;
    const doc = JSON.parse(JSON.stringify(fields));

    const references = {};
    const bad = [];
    for (const type of ['normative', 'bibliographic']) {
      for (const c of citations[type] || []) {
        const cite = String((c && c.cite) || '').trim();
        const href = String((c && c.href) || '').trim();
        if (!cite && !href) continue;
        let refId = null;
        let mapSource = 'manual:explicit';
        let mapDetail = 'explicit refId (judgment call)';
        if (c.refId) {
          refId = String(c.refId).trim();
        } else {
          const r = parseRefId(cite, href, { wantDiag: true });
          refId = r && r.refId;
          mapSource = `manual:${(r && r.diag && r.diag.mapSource) || 'parser'}`;
          mapDetail = (r && r.diag && r.diag.mapDetail) || '';
        }
        if (!refId) { bad.push({ docId: doc.docId, type, refText: cite, href }); continue; }
        if (refId === doc.docId) continue;
        (references[type] = references[type] || []);
        if (!references[type].includes(refId)) references[type].push(refId);
        mriRecordSighting({ docId: doc.docId, type, refId, cite, href, mapSource, mapDetail });
      }
    }
    if (references.normative || references.bibliographic) doc.references = references;
    if (bad.length && typeof onBadRefs === 'function') onBadRefs(bad);

    hidden(doc, '__sourceUrl', sourceUrl);
    hidden(doc, '__metaNotes', metaNotes);
    hidden(doc, '__metaFlags', metaFlags);
    hidden(doc, '__metaSources', metaSources);
    hidden(doc, '__metaSourceUrls', metaSourceUrls);
    if (doc.status && typeof doc.status === 'object') {
      hidden(doc.status, '__metaSources', scoped(metaSources, 'status'));
      hidden(doc.status, '__metaSourceUrls', scoped(metaSourceUrls, 'status'));
      hidden(doc.status, '__metaFlags', scoped(metaFlags, 'status'));
    }
    if (doc.references) {
      hidden(doc.references, '__metaSources', scoped(metaSources, 'references'));
      hidden(doc.references, '__metaSourceUrls', scoped(metaSourceUrls, 'references'));
      hidden(doc.references, '__metaFlags', scoped(metaFlags, 'references'));
    }
    return [doc];
  }

  return { extractFromUrl, extractFromSeedDoc: extractFromUrl };
}

module.exports = { createManualParser };
