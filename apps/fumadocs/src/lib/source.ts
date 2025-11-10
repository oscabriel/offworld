import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";
import { create, docs } from "@/.source";

export const source = loader({
	source: await create.sourceAsync(docs.doc, docs.meta),
	baseUrl: "/docs",
	icon(icon) {
		if (!icon) {
			return;
		}

		const iconKey = icon as keyof typeof icons;
		// biome-ignore lint/performance/noDynamicNamespaceImportAccess: Dynamic icon lookup is required for fumadocs
		if (iconKey in icons) return icons[iconKey];
	},
});
