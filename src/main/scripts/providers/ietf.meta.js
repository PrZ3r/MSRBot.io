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

const ietfMetaConfig = {
  parsed: {
    abstract: { confidence: 'high', note: 'Parsed from Datatracker doc.json abstract' },
    authors: { confidence: 'high', note: 'Parsed from RFC citation meta and/or Datatracker doc.json' },
    docNumber: { confidence: 'high', note: 'Parsed from RFC citation meta and/or URL identifier' },
    docTitle: { confidence: 'high', note: 'Parsed from Datatracker doc.json title or RFC citation meta' },
    docType: { confidence: 'high', note: 'Mapped from Datatracker std_level or RFC status text' },
    issn: { confidence: 'high', note: 'Parsed from RFC citation meta' },
    pages: { confidence: 'high', note: 'Parsed from Datatracker doc.json pages' },
    publicationDate: { confidence: 'high', note: 'Parsed from Datatracker doc.json or RFC citation meta' },
    publisher: { confidence: 'high', note: 'Static: provider' },
    references: { confidence: 'high', note: 'Parsed from RFC HTML reference sections' },
    'status.statusNote': { confidence: 'high', note: 'Mapped from Datatracker std_level or RFC status text' },
    'status.amendedBy': { confidence: 'high', note: 'Parsed from RFC relationship metadata (Updated by)' },
    'status.amends': { confidence: 'high', note: 'Parsed from RFC relationship metadata (Updates)' },
    'status.supersededBy': { confidence: 'high', note: 'Parsed from RFC relationship metadata (Obsoleted by)' },
    'status.supersedes': { confidence: 'high', note: 'Parsed from RFC relationship metadata (Obsoletes)' },
    'status.errataExist': { confidence: 'high', note: 'Derived from presence of errata links' },
    'status.errataUrl': { confidence: 'high', note: 'Parsed from RFC Editor and Datatracker errata links' },
    default: { confidence: 'high', note: 'Parsed from Datatracker/RFC sources' }
  },
  inferred: {
    publisher: { confidence: 'high', note: 'Static: provider' },
    default: { confidence: 'medium', note: 'Inferred from URL pattern or fallback parser logic' }
  },
  resolved: {
    docId: { confidence: 'high', note: 'Derived from RFC number or Datatracker identifier' },
    docLabel: { confidence: 'high', note: 'Constructed from provider and document identifier' },
    href: { confidence: 'high', note: 'URL normalized and retained from seed/discovery input' },
    resolvedHref: { confidence: 'high', note: 'Final URL resolved via URL redirect verification' },
    'status.active': { confidence: 'high', note: 'Derived from supersession relationship fields' },
    'status.latestVersion': { confidence: 'high', note: 'Derived from supersession relationship fields' },
    'status.superseded': { confidence: 'high', note: 'Derived from supersession relationship fields' },
    default: { confidence: 'high', note: 'Calculated or normalized value' }
  }
};

module.exports = { ietfMetaConfig };
