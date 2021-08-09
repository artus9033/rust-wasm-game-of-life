import { RefObject, useEffect, useState } from "react";
import StatsImpl from "stats.js";

import { addAfterEffect, addEffect } from "@react-three/fiber";

function Stats({
	showPanel = 0,
	className,
	parent,
}: {
	showPanel?: number;
	className?: string;
	parent?: RefObject<HTMLElement>;
}) {
	const [stats] = useState(() => new StatsImpl());

	useEffect(() => {
		const node = parent?.current ?? document.body;

		stats.showPanel(showPanel);
		node.appendChild(stats.dom);

		if (className) stats.dom.classList.add(className);

		const begin = addEffect(() => stats.begin());
		const end = addAfterEffect(() => stats.end());

		return () => {
			node.removeChild(stats.dom);
			begin();
			end();
		};
	}, [parent, className, showPanel, stats]);

	return null;
}

export default Stats;
