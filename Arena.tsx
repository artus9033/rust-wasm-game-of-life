import _ from "lodash";
import { useSnackbar } from "notistack5";
import React, { RefObject, memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as Tone from "tone";

import { Canvas } from "@react-three/fiber";

import MotionFader from "../components/animations/MotionFader";
import useIsomorphicLayoutEffect from "../hooks/useIsomorphicLayoutEffect";
import useWindowSize from "../hooks/useWindowSize";
import Cells from "./Cells";
import SoundGridVisualizer from "./SoundGridVisualizer";
import Stats from "./Stats";
import { CANVAS_UNIT, threeColorBlack, threeColorWhite } from "./gameConstants";
import { startSoundContext } from "./sound";

export type ArenaProps = {
	darkMode: boolean;
	containerRef: RefObject<HTMLElement>;
	roundDeltaSeconds?: number;
	soundDeltaSeconds?: number;
	maxTones?: number;
	motionAnimStaggered?: boolean;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
} & (
	| {
			stats: true;
			statsClassName: string;
	  }
	| {
			stats?: false;
			statsClassName?: never;
	  }
);

const Arena = memo(
	({
		darkMode,
		containerRef,
		stats = false,
		statsClassName,
		roundDeltaSeconds = 1 / 8,
		soundDeltaSeconds = 1 / 1.5,
		maxTones = 8,
		motionAnimStaggered = false,
		soundGridVisualizerRef,
	}: ArenaProps) => {
		const windowSize = useWindowSize();
		const { enqueueSnackbar } = useSnackbar();

		const canvasRef = useRef<HTMLCanvasElement | null>(null);

		const [reRenderFlag, setReRenderFlag] = useState<boolean>(false);
		const [canvasSize, setCanvasSize] = useState<{ width?: number; height?: number }>({
			width: undefined,
			height: undefined,
		});

		useIsomorphicLayoutEffect(() => {
			function updateSize() {
				const newWidth = containerRef.current?.clientWidth ?? window.innerWidth,
					newHeight = Math.min(
						window.outerHeight,
						containerRef.current?.clientHeight ?? Infinity
					);

				setCanvasSize({
					width: newWidth / CANVAS_UNIT,
					height: newHeight / CANVAS_UNIT,
				});

				if (canvasRef.current) {
					const ctx = canvasRef.current.getContext("2d");

					if (ctx) {
						ctx.canvas.width = newWidth;
						ctx.canvas.height = newHeight;
					}
				}
			}

			window.addEventListener("resize", updateSize);

			updateSize();

			return () => window.removeEventListener("resize", updateSize);
		}, []);

		let aspect = (windowSize?.width ?? 1) / (windowSize?.height ?? 1);

		if (aspect < 1) {
			aspect = 1 / aspect;
		}

		useEffect(
			() => {
				if (Tone.Transport.state !== "started") {
					enqueueSnackbar("Click the game to enable sound", {
						variant: "info",
						autoHideDuration: 7000,
					});
				}
			},
			// on mount effect
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[]
		);

		return (
			<div
				style={{
					position: "relative",
					height: "70vh",
					cursor: Tone.Transport.state === "started" ? undefined : "pointer",
				}}
				onClick={() => {
					if (Tone.Transport.state !== "started") {
						startSoundContext();

						// @ts-ignore: this property actually changes here (or at least it should if the operation was successful)
						if (Tone.Transport.state === "started") {
							enqueueSnackbar("Sound is now enabled", {
								variant: "success",
							});

							setReRenderFlag(!reRenderFlag); // the component won't re-render automatically, as no state/prop/hook change
						} else {
							enqueueSnackbar("Could not enable sound...", {
								variant: "error",
							});
						}
					}
				}}
			>
				<MotionFader key={aspect} staggered={motionAnimStaggered}>
					<Canvas
						style={{
							position: "absolute",
						}}
						orthographic
						camera={{
							scale: new THREE.Vector3(1, -1, 1),
							position: new THREE.Vector3(0, 0, 0),
							zoom: 1,
						}}
						key={aspect}
						ref={canvasRef}
					>
						<color
							attach="background"
							args={[darkMode ? threeColorBlack : threeColorWhite]}
						/>

						<Cells
							roundDeltaSeconds={roundDeltaSeconds}
							soundDeltaSeconds={soundDeltaSeconds}
							maxTones={maxTones}
							canvasSize={canvasSize}
							darkMode={darkMode}
							soundGridVisualizerRef={soundGridVisualizerRef}
						/>

						{!!stats && <Stats parent={containerRef} className={statsClassName} />}
					</Canvas>
				</MotionFader>
			</div>
		);
	}
);

Arena.displayName = "Arena";

export default Arena;
