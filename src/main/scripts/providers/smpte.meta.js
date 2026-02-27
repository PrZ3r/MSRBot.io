/*
Copyright (c) 2025-26 Steve LLamb (https://github.com/SteveLLamb) and PrZ3(https://github.com/PrZ3r)

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

const smpteMetaConfig = {
  parsed: {
    abstract: { confidence: 'high', note: 'Parsed from HTML sec-scope section' },
    docNumber: { confidence: 'high', note: 'Parsed from HTML pubNumber meta tag' },
    docPart: { confidence: 'high', note: 'Parsed from HTML pubPart meta tag' },
    docSuiteTitle: { confidence: 'high', note: 'Parsed from HTML pubSuiteTitle meta tag, or derived from wrapper title for PDF releases' },
    docTitle: { confidence: 'high', note: 'Parsed from HTML pubTitle, or derived from wrapper title for PDF releases' },
    docType: { confidence: 'high', note: 'Publication type parsed from HTML' },
    group: { confidence: 'high', note: 'Working group parsed from HTML pubTC meta tag' },
    publicationDate: { confidence: 'high', note: 'Parsed from HTML pubDateTime meta tag' },
    releaseTag: { confidence: 'high', note: 'Release tag parsed from URL folder structure' },
    publisher: { confidence: 'high', note: 'Parsed from HTML publisher meta tag' },
    'status.stage': { confidence: 'high', note: 'Stage parsed from HTML pubStage meta tag' },
    'status.state': { confidence: 'high', note: 'State parsed from HTML pubState meta tag' },
    'status.amended': { confidence: 'high', note: 'Parsed from wrapper #amendments' },
    'status.amendedBy': { confidence: 'high', note: 'Parsed from wrapper #amendment' },
    'status.stabilized': { confidence: 'high', note: 'Parsed from wrapper #state' },
    'status.withdrawn': { confidence: 'high', note: 'Parsed from wrapper #state' },
    'status.withdrawnNotice': { confidence: 'high', note: 'Parsed from wrapper #withdrawal-statement' },
    references: { confidence: 'high', note: 'Parsed from HTML references sections' },
    revisionOf: { confidence: 'high', note: 'Parsed from HTML pubRevisionOf meta tag' },
    default: { confidence: 'high', note: 'Extracted directly from HTML' }
  },
  inferred: {
    docNumber: { confidence: 'medium', note: 'Inferred from root folder name' },
    docPart: { confidence: 'medium', note: 'Inferred from root folder name' },
    docSuiteTitle: { confidence: 'low', note: 'Not available for inferred releases' },
    docTitle: { confidence: 'low', note: 'Not available for inferred releases' },
    docType: { confidence: 'medium', note: 'Inferred from release folder name' },
    group: { confidence: 'low', note: 'Unknown in inferred release' },
    publicationDate: { confidence: 'medium', note: 'Inferred from release folder name' },
    releaseTag: { confidence: 'high', note: 'Release tag inferred from URL folder structure' },
    publisher: { confidence: 'high', note: 'Static: provider' },
    'status.stage': { confidence: 'medium', note: 'Inferred from release folder name' },
    'status.state': { confidence: 'low', note: 'Unknown in inferred release' },
    references: { confidence: 'low', note: 'Unknown in inferred release' },
    revisionOf: { confidence: 'low', note: 'Unknown in inferred releases' },
    default: { confidence: 'medium', note: '' }
  },
  resolved: {
    docId: { confidence: 'high', note: 'Calculated from parsed/inferred metadata' },
    docLabel: { confidence: 'high', note: 'Constructed from parsed/inferred typenumber/number/date' },
    doi: { confidence: 'medium', note: 'Constructed from parsed/inferred type/date' },
    href: { confidence: 'high', note: 'URL generated and verified via redirect resolution' },
    resolvedHref: { confidence: 'high', note: 'Final URL resolved via URL redirect verification' },
    repo: { confidence: 'high', note: 'Calculated from parsed or inferred publication type/number/part and verified to exist' },
    'status.active': { confidence: 'high', note: 'Calculated from the releaseTag(s) and other status values' },
    'status.latestVersion': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.superseded': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.supersededBy': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.supersededDate': { confidence: 'high', note: 'Calculated as the publication date of the next base release (from releaseTag)' },
    default: { confidence: 'high', note: 'Calculated or verified value' }
  }
};

module.exports = { smpteMetaConfig };
