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
