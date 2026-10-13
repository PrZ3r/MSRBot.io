'use strict';

/**
 * Publisher config — one entry per publisher in src/main/config/publishers.json:
 *
 *   { "logoHeight": 25,
 *     "publishers": { "AMPAS": { "url", "logo", "logoDark", "aliases": [...], "dateless": true } } }
 *
 * Every field on an entry is optional. `aliases` are the other spellings docs
 * use for the publisher ("Academy of Motion Picture Arts and Sciences"); an
 * entry with only aliases is a placeholder for a publisher not filled in yet.
 * `dateless` marks a publisher whose documents carry no edition date, and it
 * covers the aliases too.
 *
 * loadPublisherConfig() returns the flat maps the build and the client-side
 * _data/publisher-*.json files use (name → url / logo / logoDark, alias → name).
 */

const fs = require('fs');
const path = require('path');

const PUBLISHERS_PATH = path.join(__dirname, '..', 'config', 'publishers.json');

function loadPublisherConfig(file = PUBLISHERS_PATH) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || typeof data.publishers !== 'object' || Array.isArray(data.publishers)) {
    throw new Error(`${file}: expected a "publishers" object`);
  }
  const urls = {};
  const logos = {};
  const logosDark = {};
  const aliases = {};
  const dateless = [];
  for (const [name, p] of Object.entries(data.publishers)) {
    if (p.url) urls[name] = p.url;
    if (p.logo) logos[name] = p.logo;
    if (p.logoDark) logosDark[name] = p.logoDark;
    for (const a of p.aliases || []) {
      if (aliases[a]) throw new Error(`${file}: alias "${a}" is listed under both ${aliases[a]} and ${name}`);
      aliases[a] = name;
    }
    if (p.dateless) dateless.push(name, ...(p.aliases || []));
  }
  return {
    logoHeight: typeof data.logoHeight === 'number' ? data.logoHeight : 25,
    urls,
    logos,
    logosDark,
    aliases,
    dateless,
  };
}

module.exports = { PUBLISHERS_PATH, loadPublisherConfig };
