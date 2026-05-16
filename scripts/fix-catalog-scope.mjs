import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "catalog.html");
let h = fs.readFileSync(p, "utf8");

h = h.replace(
	"let activeListingId = null;",
	"let activeListingId = null;\n\t\twindow.__fieldlotActiveListing = null;",
);

h = h.replace(
	"function openDetail(item) {\n\t\t\tdetailTitle",
	"function openDetail(item) {\n\t\t\tactiveListingId = item.id;\n\t\t\twindow.__fieldlotActiveListing = item.id;\n\t\t\tdetailTitle",
);

h = h.replace(
	"function closeDetail() {\n\t\t\tbackdrop",
	"function closeDetail() {\n\t\t\tactiveListingId = null;\n\t\t\twindow.__fieldlotActiveListing = null;\n\t\t\tbackdrop",
);

h = h.replace(
	/\t\t\tconst origOpen = openDetail;[\s\S]*?origClose\(\);\n\t\t\t};\n\n/,
	"",
);

h = h.replace(
	"function visibleIds() {\n\t\t\treturn filterListings().map((i) => i.id);\n\t\t}",
	"function visibleIds() {\n\t\t\treturn filterListings().map((i) => i.id);\n\t\t}\n\t\twindow.__fieldlotVisibleIds = visibleIds;",
);

h = h.replace(
	"listingId: typeof activeListingId === 'string' ? activeListingId : undefined,",
	"listingId: window.__fieldlotActiveListing || undefined,",
);

h = h.replace(
	"visibleListingIds: typeof visibleIds === 'function' ? visibleIds() : [],",
	"visibleListingIds: window.__fieldlotVisibleIds ? window.__fieldlotVisibleIds() : [],",
);

fs.writeFileSync(p, h);
console.log("fixed");
