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

const { createSmpteDiscovery } = require('./smpte.discovery');
const { createSmpteParser } = require('./smpte.parse');
const { createIetfDiscovery } = require('./ietf.discovery');
const { createIetfParser } = require('./ietf.parse');
const { smpteMetaConfig } = require('./smpte.meta');
const { ietfMetaConfig } = require('./ietf.meta');

const PROVIDER_CONFIGS = {
  smpte: {
    label: 'SMPTE',
    seedPath: 'src/main/input/seedUrls.smpte.json',
    discovery: {
      rootUrl: 'https://pub.smpte.org/doc/',
      filterEnabled: true,
      filterPath: 'src/main/input/filterList.smpte.json'
    }
  },
  ietf: {
    label: 'IETF',
    seedPath: 'src/main/input/seedUrls.ietf.json',
    discovery: {
      seedFirst: true,
      filterEnabled: true,
      filterPath: 'src/main/input/filterList.ietf.json'
    }
  }
};

function listProviders() {
  return Object.keys(PROVIDER_CONFIGS);
}

function getProvider(providerKey, deps) {
  const cfg = PROVIDER_CONFIGS[providerKey];
  if (!cfg) return null;

  if (providerKey === 'smpte') {
    const discovery = createSmpteDiscovery({
      axios: deps.axios,
      cheerio: deps.cheerio,
      options: cfg.discovery
    });
    const parser = createSmpteParser({
      axios: deps.axios,
      cheerio: deps.cheerio,
      dayjs: deps.dayjs,
      urlReachable: deps.urlReachable,
      extractRefs: deps.extractRefs,
      mapRefByCite: deps.mapRefByCite,
      withNoCache: deps.withNoCache,
      NO_CACHE_HEADERS: deps.NO_CACHE_HEADERS,
      onBadRefs: deps.onBadRefs
    });
    return {
      key: providerKey,
      label: cfg.label,
      seedPath: cfg.seedPath,
      metaConfig: smpteMetaConfig,
      discovery,
      parser
    };
  }

  if (providerKey === 'ietf') {
    const discovery = createIetfDiscovery({
      options: cfg.discovery
    });
    const parser = createIetfParser({
      axios: deps.axios,
      cheerio: deps.cheerio,
      dayjs: deps.dayjs,
      extractRefs: deps.extractRefs,
      mapRefByCite: deps.mapRefByCite,
      withNoCache: deps.withNoCache,
      NO_CACHE_HEADERS: deps.NO_CACHE_HEADERS,
      onBadRefs: deps.onBadRefs
    });
    return {
      key: providerKey,
      label: cfg.label,
      seedPath: cfg.seedPath,
      metaConfig: ietfMetaConfig,
      discovery,
      parser
    };
  }

  return null;
}

module.exports = { getProvider, listProviders };
