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

const ACRONYM_MAP = new Map([
  "and",
  "3GPP",
  "AAF",
  "ACES",
  "AEAD",
  "AES",
  "AgreementMethod",
  "AKA",
  "AKA'",
  "API",
  "ASCII",
  "ATM",
  "AVC",
  "AXF",
  "BXF",
  "ChaCha",
  "ChaCha20",
  "CoAP",
  "CPL",
  "DCDM",
  "DigestMethod",
  "DNS",
  "DOI",
  "DV",
  "EAP",
  "EAP-AKA'",
  "EOTF",
  "EncryptionMethod",
  "FS",
  "HDR",
  "HDTV",
  "HTJ2K",
  "HTTP",
  "HTTPS",
  "IETF",
  "IMAP",
  "IMAPV4",
  "IMF",
  "IoT",
  "IP",
  "IPSEC",
  "ISO",
  "ITU",
  "JPEG2000",
  "JPEG",
  "JSON",
  "KDM",
  "KeyDerivationMethod",
  "KeyInfo",
  "MIME",
  "MPEG",
  "MXF",
  "NAT",
  "NETCONF",
  "NMDA",
  "NTSC",
  "OPL",
  "POLY1305",
  "REST",
  "RESTCONF",
  "RFC",
  "SDI",
  "SigntureMethod",
  "SMTP",
  "UHDTV",
  "UMID",
  "URI",
  "URL",
  "URN",
  "UTF",
  "W-OTS",
  "W-OTS+",
  "WOTS",
  "WOTS+",
  "XML",
  "XMLDSIG",
  "XMLENC",
  "XMLSEC",
  "XMSS",
  "YANG"
].map((value) => [value.toLowerCase(), value]));

function normalizeKeyword(input) {
  const s = String(input || "").trim().replace(/\s+/g, " ");
  if (!s) return "";

  return s
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYM_MAP.has(lower)) return ACRONYM_MAP.get(lower);
      if (/^b-?chain$/i.test(word)) return "B-Chain";
      if (/^d-?cinema$/i.test(word)) return "DCinema";
      if (/^subtitles?$/i.test(word)) return "Subtitles";
      if (/^sha-?1$/i.test(word)) return "SHA-1";
      if (/^dcp(?=$|[-/])/i.test(word)) return word.replace(/^dcp/i, "DCP");
      // Preserve MIME/media-type forms as lowercase per convention.
      if (/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(word)) return lower;
      // Preserve already-uppercase hyphenated acronym tokens (e.g., MIME-EXT, URI-GEN).
      if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(word)) return word;
      if (/^\d+mm$/i.test(word)) return `${word.replace(/mm$/i, "")}mm`;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function splitAndNormalizeKeywords(values = []) {
  return Array.from(new Set(
    values
      .flatMap((entry) => String(entry || "").split(/[;,]/))
      .map((entry) => normalizeKeyword(entry))
      .filter(Boolean)
  ));
}

module.exports = {
  normalizeKeyword,
  splitAndNormalizeKeywords
};
