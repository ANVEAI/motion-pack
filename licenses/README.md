# Licence texts for third-party artwork shown in committed images

The pack ships no third-party icon or emoji files (they are fetched by `scripts/fetch-external.sh`, never committed). But the lab contact sheets in
`lab/*/sheets/` are renders of those sets (and of other test inputs), so the upstream notices travel with the images:

| file | set | shown in | source (pinned in `scripts/external.lock`) |
|---|---|---|---|
| `lucide-ISC-and-feather-MIT.txt` | Lucide icons (ISC; the Feather-derived icons MIT, Cole Bemis) | `lab/c-vector/sheets/c3-*.jpg` | github.com/lucide-icons/lucide @ `3f1255ecfa1b5b3a231e4aeb027781761204e187` |
| `phosphor-MIT.txt` | Phosphor icons, regular weight | `lab/c-vector/sheets/c3-fidelity-worst.jpg` | github.com/phosphor-icons/core @ `2b75f3ad12b420c9504ef05df8d2564a28f8500e` |
| `fluent-emoji-MIT.txt` | Microsoft Fluent Emoji (Flat SVG and 3D PNG) | `lab/c-vector/sheets/c3-fidelity-worst.jpg`, `lab/d-output/sheets/` (the cover and CSS-support sheets show the 3D notebook emoji) | github.com/microsoft/fluentui-emoji @ `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` |

These texts are copied unchanged from the licence file of each fetched set. The images are NOT covered by the CC0 grant in `LICENSE-MEDIA`: see its
"does NOT cover" list and `THIRD_PARTY.md` section 1b.
