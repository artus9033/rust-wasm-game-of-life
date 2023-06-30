import { useEffect, useRef } from "react";

export const useOnMountOnce = (callback: () => void) => {
	const alreadyRunRef = useRef(false);

	useEffect(() => {
		if (!alreadyRunRef.current) {
			callback();
		}
		alreadyRunRef.current = true;
	}, [callback]);
};
