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
 * referencing.citeTypography.test.js — parseRefId on French/European citation text.
 *
 * Cases are verbatim citations from CST technical recommendations (cst.fr), which use
 * spaced thousands ("ISO 26 428 – 3"), en dashes, a space before colons ("RP 200 :2012"),
 * French organisation spellings (UIT-R, CEI) and two families the parser didn't know
 * (CST, AFNOR). Before this, "ISO 26 428 – 1" parsed as the meaningless `ISO.26`.
 * The last block pins forms that must not change.
 *
 *   node src/main/scripts/test/referencing.citeTypography.test.js
 */

const assert = require('assert');
const path = require('path');
const { parseRefId } = require(path.join(__dirname, '..', '..', 'lib', 'referencing.js'));

const cases = [
  // ISO / IEC typography
  ['ISO 26 428 – 1 – D-Cinema Distribution Master – Part 1 Image characteristics', 'ISO.26428-1'],
  ['ISO26 428 – 2 – D-Cinema Distribution Master – Part 2 Audio characteristics', 'ISO.26428-2'],
  ['(ISO/DIS 26 428 – 3 – D-Cinema Distribution Master – Part 3 Audio channel mapping & channel labeling)', 'ISO.26428-3'],
  ['ISO 26 430 – 2 – D-Cinema Operations – Part 2 Digital Certificate', 'ISO.26430-2'],
  ['ISO/CD 21727 "Cinématographie – Méthode de mesure de l\'intensité sonore perçue"', 'ISO.21727'],
  ['Ils sont définis dans la norme ISO/R1996 :1971.', 'ISO.1996.1971'],
  ['10. ISO/DIS 20462–3, ISO TC 42/SC /WG 18, International Standard', 'ISO.20462-3'],
  ['voir CEI 61672-1 « Électroacoustique – Sonomètres »', 'IEC.61672-1'],
  // SMPTE
  ['SMPTE RP 200 :2012 Relative and Absolute Sound Pressure Levels', 'SMPTE.RP200.2012'],
  ['[4] SMPTE, «RP 177-1993 Derivation of Basic Television Color Equation,» SMPTE, 1993.', 'SMPTE.RP177.1993'],
  ['la publication du standard SMPTE ST2067-40:2016 qui remplace l’annexe', 'SMPTE.ST2067-40.2016'],
  ['.dpx Extension de fichier … normalisé par le SMPTE (268M-2003) Digital Picture Exchange (DPX).', 'SMPTE.ST268.2003'],
  ['[8] SMPTE , “ ST 291–1: 2011 Ancillary Data Packet and Space Formatting ,” 2011 .', 'SMPTE.ST291-1.2011'],
  ['2. SMPTE 326M “Television—SDTI Content Package Format (SDTI-CP),” SMPTE, J., Mar. 2000; SMPTE RP204-2000', 'SMPTE.ST326'],
  // ITU / EBU
  ['Recommendation UIT-R BT.709-5, Valeur des paramètres des normes de TVHD', 'R-REC-BT.709-5'],
  ['ITU–R : BT 709 - 6 « Valeur des paramètres des normes de TVHD »', 'R-REC-BT.709-6'],
  ['utilisant un espace colorimétrique ITU-BT.709', 'R-REC-BT.709'],
  ['Recommendation UIT-R 1680, Format de signal d\'image en bande de base', 'R-REC-BT.1680'], // refMap
  ['EBU – R95 V1.1 - 2016 Safe areas for 16 :9 television production', 'EBU.R95.2016'],
  ['EBU–R 95 v1.1 - 2016 Safe areas for 16 :9 television production', 'EBU.R95.2016'],
  // CST
  ['CST RT 031 – Projection – 2012 « Méthodologie de relevé des caractéristiques dimensionnelles »', 'CST.RT031.2012'],
  ['CST - RT – 007 - S - 2001', 'CST.RT007.2001'],
  ['C.S.T. – RT - 005 - P - 2002', 'CST.RT005.2002'],
  ['CST-RT 040 TV - 2016 – PAD fichiers Editeurs V1.2', 'CST.RT040.2016'],
  ['CST-RT021:2016', 'CST.RT021.2016'],
  ['CST-RT021-annexe:2016', 'CST.RT021annex.2016'],
  ['2011 : CST RT 028 « Sous-titrage en projection numérique » (en cours de validation)', 'CST.RT028'],
  ['Note technique CST NT 001 « Synchronisation son/image des copies d’exploitation 35 mm »', 'CST.NT001'],
  // AFNOR
  ['Afnor NF S 27100 « Salle de projection électronique » dans sa version révisée 2012-2013', 'AFNOR.NFS27-100'],
  ['La norme Afnor NF S27-100:2014,“Établissements de spectacles cinématographiques”', 'AFNOR.NFS27-100.2014'],
  ['Norme Afnor NF-S 27001 "Caractéristiques dimensionnelles"', 'AFNOR.NFS27-001'],
  ['NF S 27–001, Cinématographie - Théâtres cinématographiques', 'AFNOR.NFS27-001'],
  ['Réf Afnor NF-S 27100 - 2006', 'AFNOR.NFS27-100.2006'],
  ['NF EN 61947-2, Projection électronique - Mesure et documentation', 'AFNOR.NFEN61947-2'],
  // DCI Digital Cinema System Specification (version-level, undated)
  ['[10] Digital Cinema Initiatives, LLC, «Digital Cinema System Specifications Version 1.2,» Digital Cinema Initiatives, LLC, 2008.', 'DCI.DCSS.v1.2'],
  ['1. Digital Cinema System Specification V1. 0, July 20, 2005 (Digital Cinema Initiatives, LLC)', 'DCI.DCSS.v1.0'],
  ['[19] Digital Cinema Initiatives (DCI) . Digital cinema system specification, version 1.4.2', 'DCI.DCSS.v1.4.2'],
  // refMap one-offs from CST batch 4
  ['(norme AES 3, reprise dans la norme ISO 26428-3)', 'AES3'],
  ['SMPTE : The restauration Business Part 4 In black and white – reel two – Grant Loban-2000', '10.5594-J05296'],
  ['[5] F. Helt et V. La Torre, «Quality Assessment Framework for Color Conversions and Perception,» chez SMPTE 2014 Annual Technical Conference, Los Angeles, 2014.', '10.5594-M001556'],
  ['Les CPL produites devront respecter la dernière version en date de la convention de nommage du cinéma numérique.', 'ISDCF.DCNC'],
  // Unchanged forms
  ['ISO 9660:1988', 'ISO.9660.1988'],
  ['ISO 8601', 'ISO.8601'],
  ['ISO/IEC 15444-1:2019', 'ISO.15444-1.2019'],
  ['SMPTE ST 428-7:2014', 'SMPTE.ST428-7.2014'],
  ['SMPTE EG 21-1993', 'SMPTE.EG21.1993'],
  ['ITU-R BT.601-5 (10/95)', 'R-REC-BT.601-5'],
  ['AES3-2003', 'AES3.2003'],
];

for (const [cite, expected] of cases) {
  assert.strictEqual(parseRefId(cite), expected, `parseRefId(${JSON.stringify(cite)})`);
}

// CST ids from the parser must key into MSI lineages (#2085), annexes as supplements.
const keying = require(path.join(__dirname, '..', '..', 'lib', 'keying.js'));
for (const [id, number] of [['CST.RT028.2026', '028'], ['CST.RT021annex.2016', '021'], ['CST.NT001', '001']]) {
  const key = keying.keyFromDocId(id);
  assert.ok(key && key.publisher === 'CST' && key.number === number, `keyFromDocId(${id}) = ${JSON.stringify(key)}`);
}
assert.ok(keying.isSupplementDocId('CST.RT021annex.2016'), 'CST annex should be a supplement');

console.log(`referencing.citeTypography.test.js — all assertions passed (${cases.length} cases)`);
