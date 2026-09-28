# Zotero Last Read Time Format

A tiny [Zotero](https://www.zotero.org/) 7–10 plugin that changes the built-in
**Last Read Time (最后阅读时间)** column from the full locale datetime to a
compact `MM-DD HH:mm` format.

| Before | After |
| ------ | ----- |
| `2026/9/28 14:30:55` | `09-28 14:30` |

## Install

1. Download the latest `lastread-format@yangc.dev.xpi` from
   [Releases](https://github.com/yanchou3/zotero-lastread-format/releases/latest).
2. In Zotero: `Tools → Plugins → ⚙ → Install Plugin From File…`
3. Restart Zotero when prompted.

## How it works

The plugin wraps `ItemTree.prototype._getRowData` and reformats the `lastRead`
cell value. Sorting still uses the raw timestamp, so ordering is unaffected.
Row caches are invalidated on startup so the new format shows immediately
without switching collections.

## Compatibility

- Zotero 7 – 10 (tested on Zotero 10.0.3 / Windows)

## License

MIT
