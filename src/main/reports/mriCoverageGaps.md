# MRI Coverage Validation

> Generated at: 2026-06-22
> MRI version: 2.0.0

## Invariant

Every string in `doc.references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. The MRI v2 slug-system guarantees this — `extractDocs.js` routes through `mriRecordSighting`, which mints a slug for every ref it sees, and the slug is cited from `doc.references[]` before the doc is saved.

See [docs/mri-citation-system.md](../../../docs/mri-citation-system.md) for the resolution lifecycle.

## Totals

- Registry docs: **26445**
- Docs with non-empty `references[]`: **1071**
- Total ref-entries audited: **9547**
- MRI `refs[]` entries: **3358**
- **Leak count: 0**

## Result: PASS

Every audited ref-string is present in MRI. The invariant holds.
