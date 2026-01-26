import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

export function rehypeWrapTables() {
	return (tree: Root) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName === "table" && parent && typeof index === "number") {
				const wrapper: Element = {
					type: "element",
					tagName: "div",
					properties: { className: ["table-wrapper"] },
					children: [node],
				};
				(parent.children as Element[])[index] = wrapper;
			}
		});
	};
}
