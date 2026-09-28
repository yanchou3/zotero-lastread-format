/* Zotero plugin: format the "Last Read Time" (最后阅读时间) column
 * as MM-DD HH:mm (e.g. 09-28 14:30) instead of the full locale string.
 *
 * Monkey-patches ItemTree.prototype._getRowData, the single place Zotero
 * formats the lastRead cell value for display. Sorting is unaffected.
 *
 * Notes on timing (do not "optimize" these away):
 * - Plugin startup runs AFTER the main window has already rendered items,
 *   so bootstrap must not wait for Zotero.initializationPromise (it only
 *   resolves once the UI is up). Patch as soon as win.require() is usable.
 * - Rows rendered before the patch keep stale values in the view's
 *   _rowCache. React's forceUpdate() alone won't repaint them (the
 *   VirtualizedTree subtree props are unchanged and React bails out), so
 *   the view's virtualized table must be invalidated explicitly.
 */

if (typeof Zotero === "undefined") {
	var Zotero;
}

var _origGetRowData = null;
var _wrapper = null;
var _patchedItemTree = null;
var LOG_PREFIX = "[lastread-format] ";

function pad2(n) {
	return String(n).padStart(2, "0");
}

function formatLastRead(ts) {
	var d = new Date(ts * 1000);
	return (
		pad2(d.getMonth() + 1) +
		"-" +
		pad2(d.getDate()) +
		" " +
		pad2(d.getHours()) +
		":" +
		pad2(d.getMinutes())
	);
}

function install(data, reason) {}

function uninstall(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
	try {
		if (!Zotero) {
			Zotero = ChromeUtils.importESModule(
				"chrome://zotero/content/zotero.mjs"
			).Zotero;
		}

		var delay = (ms) =>
			Zotero.Promise && Zotero.Promise.delay
				? Zotero.Promise.delay(ms)
				: new Promise((r) => setTimeout(r, ms));

		// Poll for the main window and patch the moment the itemTree module
		// can be loaded, i.e. during window script parsing - long before the
		// item tree renders its first rows in most startups.
		var win = null;
		var ItemTree = null;
		for (var i = 0; i < 300; i++) {
			win = Zotero.getMainWindow();
			if (win && win.require) {
				try {
					ItemTree = win.require("zotero/itemTree");
					if (ItemTree && ItemTree.prototype && ItemTree.prototype._getRowData) {
						break;
					}
				} catch (e) {
					// module not loadable yet, keep polling
				}
			}
			ItemTree = null;
			await delay(50);
		}
		if (!ItemTree) {
			Zotero.debug(LOG_PREFIX + "could not load ItemTree in time", 1);
			return;
		}

		_origGetRowData = ItemTree.prototype._getRowData;

		_wrapper = function (index) {
			var row = _origGetRowData.call(this, index);
			if (row && row.lastRead) {
				// After the original call, row.lastRead is already a formatted
				// string. Get the raw epoch-seconds from the tree row instead.
				var ts = null;
				if (typeof row.lastRead === "number") {
					ts = row.lastRead;
				} else {
					try {
						var treeRow = this.getRow(index);
						if (
							treeRow &&
							treeRow.ref &&
							typeof treeRow.ref.getItemLastRead === "function"
						) {
							ts = treeRow.ref.getItemLastRead();
						}
					} catch (e) {
						// ignore, keep original display
					}
				}
				if (typeof ts === "number" && ts > 0) {
					row.lastRead = formatLastRead(ts);
				}
			}
			return row;
		};

		_patchedItemTree = ItemTree;
		ItemTree.prototype._getRowData = _wrapper;

		Zotero.debug(LOG_PREFIX + "patched ItemTree._getRowData", 3);

		// Insurance: if the view already rendered rows before the patch, clear
		// its row cache and invalidate the virtualized table so visible rows
		// re-render through the patched function immediately.
		try {
			for (var w of Zotero.getMainWindows()) {
				var view = w.ZoteroPane && w.ZoteroPane.itemsView;
				if (view && view._rowCache && Object.keys(view._rowCache).length) {
					view._rowCache = {};
					if (view.tree && typeof view.tree.invalidate === "function") {
						view.tree.invalidate();
					} else if (typeof view.forceUpdate === "function") {
						view.forceUpdate();
					}
				}
			}
		} catch (e) {
			// ignore
		}
	} catch (e) {
		try {
			Zotero.debug(LOG_PREFIX + "startup failed: " + (e.stack || e), 1);
		} catch (e2) {}
	}
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
	try {
		if (_patchedItemTree && _wrapper) {
			_patchedItemTree.prototype._getRowData = _origGetRowData;
		}
	} catch (e) {
		// ignore on shutdown
	}
	_origGetRowData = null;
	_wrapper = null;
	_patchedItemTree = null;
}

function onMainWindowLoad({ window }, reason) {}
