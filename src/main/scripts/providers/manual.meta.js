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
 * manual provider — $meta defaults. Records override per field with metaSources /
 * metaNotes / metaFlags / metaSourceUrls (see manual.parse.js).
 */

const manualMetaConfig = {
  parsed: {
    normative: { confidence: 'high', note: 'Citations read from the document; refIds from parseRefId' },
    bibliographic: { confidence: 'high', note: 'Citations read from the document; refIds from parseRefId' },
    default: { confidence: 'high', note: "Read from the publisher's document or website" }
  },
  inferred: {
    default: { confidence: 'medium', note: 'Derived (translation, summary or registry convention)' }
  },
  manual: {
    default: { confidence: 'high', note: 'Set by a person' }
  },
  resolved: {
    resolvedHref: { confidence: 'high', note: 'Final URL resolved via URL redirect verification' },
    'status.active': { confidence: 'medium', note: "Current edition on the publisher's list" },
    'status.latestVersion': { confidence: 'medium', note: "Current edition on the publisher's list" },
    default: { confidence: 'medium', note: 'Calculated or normalized value' }
  }
};

module.exports = { manualMetaConfig };
