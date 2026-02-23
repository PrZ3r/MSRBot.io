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
      mapRefByCite: deps.mapRefByCite,
      withNoCache: deps.withNoCache,
      NO_CACHE_HEADERS: deps.NO_CACHE_HEADERS
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
