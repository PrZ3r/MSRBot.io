#!/usr/bin/env python3
"""
msrbot.py: read-only helper for looking up records in MSRBot.io (https://msrbot.io).

Standard library only. Every result includes the URLs it was read from and each
record's lastModified, so answers can cite them.

  python3 msrbot.py find "2067-21"                 # search the index (docId / label / title)
  python3 msrbot.py find "IMF" --publisher SMPTE --type Standard --limit 20
  python3 msrbot.py get SMPTE.ST2067-21.2020       # full record (add --meta for $meta provenance)
  python3 msrbot.py current SMPTE.ST2067-21.2020   # follow supersededBy to the current edition
  python3 msrbot.py editions SMPTE.ST2067-21.2022  # all indexed editions sharing the docId base
  python3 msrbot.py ref SMPTE.ST2067-2             # resolve a reference id via the MRI cite map
  python3 msrbot.py family SMPTE 2067              # every part of a multi-part family + newest edition of each

The index (~9 MB), the cite map (~12 MB) and suites.json (~230 KB) are cached for the session in the
system temp dir, so repeated calls don't download them again.
"""

import argparse
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("MSRBOT_BASE", "https://msrbot.io").rstrip("/")
# Cache per base URL, so an override (MSRBOT_BASE) never reads another site's cached files.
CACHE_DIR = os.path.join(tempfile.gettempdir(), "msrbot-research-cache",
                         re.sub(r"[^A-Za-z0-9]+", "_", BASE))
CACHE_TTL_S = 6 * 3600
UA = "msrbot-research-skill/1.0"


def _fetch_json(url, cache_name=None):
    if cache_name:
        path = os.path.join(CACHE_DIR, cache_name)
        if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL_S:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
    data = json.loads(raw)
    if cache_name:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(os.path.join(CACHE_DIR, cache_name), "w", encoding="utf-8") as fh:
            fh.write(raw)
    return data


def doc_api_url(doc_id):
    return f"{BASE}/api/doc/{urllib.parse.quote(doc_id, safe='')}.json"


def doc_page_url(doc_id):
    # Pages exist only for documents that pass the site's page gate; many
    # journal articles are JSON-only. The API URL is always the safe citation.
    return f"{BASE}/docs/{urllib.parse.quote(doc_id, safe='')}/"


def strip_meta(value):
    if isinstance(value, dict):
        return {k: strip_meta(v) for k, v in value.items() if "$meta" not in k}
    if isinstance(value, list):
        return [strip_meta(v) for v in value]
    return value


def get_record(doc_id):
    url = doc_api_url(doc_id)
    try:
        payload = _fetch_json(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, url
        raise
    return payload, url


def load_index():
    url = f"{BASE}/api/documents.json"
    return _fetch_json(url, "documents.json"), url


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def cmd_find(args):
    index, url = load_index()
    q = _norm(args.query)
    rows = []
    for row in index.get("documents", []):
        if args.publisher and (row.get("publisher") or "").lower() != args.publisher.lower():
            continue
        if args.type and (row.get("docType") or "").lower() != args.type.lower():
            continue
        hay = [_norm(row.get(k)) for k in ("docId", "docLabel", "docTitle")]
        if any(q in h for h in hay if h):
            rows.append({
                "docId": row.get("docId"),
                "docLabel": row.get("docLabel"),
                "docTitle": row.get("docTitle"),
                "publisher": row.get("publisher"),
                "docType": row.get("docType"),
                "apiUrl": BASE + row["path"] if row.get("path") else doc_api_url(row.get("docId")),
            })
    return {
        "query": args.query,
        "matches": len(rows),
        "results": rows[: args.limit],
        "truncated": len(rows) > args.limit,
        "source": {"indexUrl": url, "indexGeneratedAt": index.get("generatedAt"),
                   "indexApiVersion": index.get("apiVersion")},
        "note": "Index rows carry no status. Fetch each record (get) before stating status or dates.",
    }


def _summary(payload, url):
    d = payload.get("document", {})
    status = strip_meta(d.get("status") or {})
    return {
        "docId": payload.get("docId"),
        "docLabel": d.get("docLabel"),
        "docTitle": d.get("docTitle"),
        "publisher": d.get("publisher"),
        "docType": d.get("docType"),
        "publicationDate": d.get("publicationDate"),
        "status": status,
        "doi": d.get("doi"),
        "publisherUrl": d.get("href"),
        "apiUrl": url,
        "pageUrl": doc_page_url(payload.get("docId")),
        "lastModified": payload.get("lastModified"),
    }


def cmd_get(args):
    payload, url = get_record(args.docId)
    if payload is None:
        return {"docId": args.docId, "found": False, "apiUrl": url,
                "note": "404 at this docId. Check the id with `find`; a 404 does not prove the document is absent from MSRBot."}
    doc = payload["document"] if args.meta else strip_meta(payload["document"])
    return {"found": True, "apiUrl": url, "pageUrl": doc_page_url(args.docId),
            "lastModified": payload.get("lastModified"), "apiVersion": payload.get("apiVersion"),
            "document": doc}


def cmd_current(args):
    chain, seen, doc_id = [], set(), args.docId
    while doc_id and doc_id not in seen and len(chain) < 25:
        seen.add(doc_id)
        payload, url = get_record(doc_id)
        if payload is None:
            chain.append({"docId": doc_id, "found": False, "apiUrl": url})
            break
        s = _summary(payload, url)
        chain.append(s)
        nxt = s["status"].get("supersededBy") or []
        if len(nxt) > 1:
            s["note"] = "Multiple successors; only the first was followed. Check the others."
        doc_id = nxt[0] if nxt else None
    last = chain[-1] if chain else {}
    return {
        "start": args.docId,
        "current": last.get("docId") if last.get("found", True) else None,
        "currentIsActive": (last.get("status") or {}).get("active"),
        "chain": chain,
        "note": "Chain follows status.supersededBy. Check each edition's status.amendedBy for amendments.",
    }


def _doc_base(doc_id):
    # Strip a trailing edition segment, e.g. SMPTE.ST2067-21.2020 -> SMPTE.ST2067-21,
    # SMPTE.ST429-2.2023-09 -> SMPTE.ST429-2. Heuristic: works for dated
    # standards-style ids; returns the id unchanged when there is no trailing date.
    m = re.match(r"^(.*?)\.(\d{4}(?:-\d{2})?(?:Am\d+\.\d{4})?)$", doc_id)
    return m.group(1) if m else doc_id


def cmd_editions(args):
    index, url = load_index()
    base = _doc_base(args.docId)
    rows = [r for r in index.get("documents", []) if _doc_base(r.get("docId") or "") == base]
    rows.sort(key=lambda r: r.get("docId") or "")
    return {
        "docIdBase": base,
        "editions": [{"docId": r["docId"], "docLabel": r.get("docLabel"),
                      "apiUrl": BASE + r["path"] if r.get("path") else doc_api_url(r["docId"])} for r in rows],
        "source": {"indexUrl": url, "indexGeneratedAt": index.get("generatedAt")},
        "note": "Grouped by docId base from the index. This is a heuristic, not MSRBot's lineage data. "
                "Fetch each record for status before stating which edition is current.",
    }


def cmd_ref(args):
    url = f"{BASE}/api/mri-cite-map.json"
    cmap = _fetch_json(url, "mri-cite-map.json")
    entry = cmap.get(args.refId)
    out = {"refId": args.refId, "found": entry is not None, "citeMapUrl": url, "entry": entry}
    if entry and entry.get("resolvedDocId"):
        out["resolvedApiUrl"] = doc_api_url(entry["resolvedDocId"])
        out["note"] = ("resolvedDocId is the registry doc this reference points to. For an UNDATED "
                       "reference, the edition that applies is the current one; confirm with `current`.")
    elif entry:
        out["note"] = "Known to MSRBot's reference index, but it is not a registry document."
    return out


def cmd_family(args):
    url = f"{BASE}/suites/_data/suites.json"
    data = _fetch_json(url, "suites.json")
    pub = args.publisher.strip().upper()
    num = re.sub(r"^[A-Za-z]+", "", args.number.strip())
    hit = None
    for s in data.get("suites", []):
        if (s.get("publisher") or "").upper() == pub and str(s.get("number")) == num:
            hit = s
            break
    if not hit:
        return {"publisher": pub, "number": num, "found": False, "suitesUrl": url,
                "note": "Not a multi-part family in suites.json (single-part documents aren't listed there). "
                        "This is NOT evidence the document is absent. Use `find` or fetch candidate docIds."}
    latest = {part: v.get("docId") for part, v in (hit.get("latestPerPart") or {}).items()}
    return {
        "found": True,
        "key": hit.get("key"),
        "suiteTitle": hit.get("suiteTitle"),
        "parts": hit.get("parts"),
        "latestPerPart": latest,
        "counts": hit.get("counts"),
        "suitePageUrl": f"{BASE}/suites/{hit.get('suiteSlug')}/" if hit.get("suiteSlug") else None,
        "suitesUrl": url,
        "note": "`parts` is every part MSRBot holds for this family; latestPerPart is the newest edition of each "
                "in MSRBot. Fetch the record before stating its status or title.",
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="Read-only MSRBot.io lookups with provenance.")
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("find"); f.add_argument("query"); f.add_argument("--publisher")
    f.add_argument("--type"); f.add_argument("--limit", type=int, default=25); f.set_defaults(fn=cmd_find)
    g = sub.add_parser("get"); g.add_argument("docId"); g.add_argument("--meta", action="store_true"); g.set_defaults(fn=cmd_get)
    c = sub.add_parser("current"); c.add_argument("docId"); c.set_defaults(fn=cmd_current)
    e = sub.add_parser("editions"); e.add_argument("docId"); e.set_defaults(fn=cmd_editions)
    r = sub.add_parser("ref"); r.add_argument("refId"); r.set_defaults(fn=cmd_ref)
    fa = sub.add_parser("family"); fa.add_argument("publisher"); fa.add_argument("number"); fa.set_defaults(fn=cmd_family)
    args = p.parse_args(argv)
    try:
        result = args.fn(args)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        blocked = isinstance(e, urllib.error.HTTPError) and e.code in (401, 403, 407) \
            or isinstance(e, urllib.error.URLError) and not isinstance(e, urllib.error.HTTPError)
        result = {"error": f"{type(e).__name__}: {e}",
                  "networkBlocked": bool(blocked),
                  "note": ("This sandbox can't reach msrbot.io (proxy/network block). Stop using this script and "
                           "switch to your web-fetch tool with the same URLs now." if blocked else
                           "Fetch failed. Retry once, then report it. Don't guess.")}
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 2
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
