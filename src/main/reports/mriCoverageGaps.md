# MRI Coverage Validation

> Generated at: (set MRI_COVERAGE_TIMESTAMP env var)
> MRI version: 2.0.0

## Invariant

Every string in `doc.references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. The MRI v2 slug-system guarantees this — `extractDocs.js` routes through `mriRecordSighting`, which mints a slug for every ref it sees, and the slug is cited from `doc.references[]` before the doc is saved.

See [docs/mri-citation-system.md](../../../docs/mri-citation-system.md) for the resolution lifecycle.

## Totals

- Registry docs: **26298**
- Docs with non-empty `references[]`: **5477**
- Total ref-entries audited: **52607**
- MRI `refs[]` entries: **43405**
- **Leak count: 0**

## Result: PASS

Every audited ref-string is present in MRI. The invariant holds.
