import React, { RefObject, memo, useEffect, useMemo, useRef, useState } from "react";
import _ from "lodash";

import { useMediaQuery, useTheme } from "@mui/material";
import { useSnackbar } from "notistack";

import { Leva, useControls } from "leva";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

import * as Tone from "tone";

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
	roundDeltaSecondsDefault?: number;
	soundDeltaSecondsDefault?: number;
	maxTonesDefault?: number;
	motionAnimStaggered?: boolean;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
	gui?: boolean;
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
		roundDeltaSecondsDefault = 1 / 8,
		soundDeltaSecondsDefault = 0.9,
		maxTonesDefault = 8,
		motionAnimStaggered = false,
		soundGridVisualizerRef,
		gui = false,
	}: ArenaProps) => {
		const windowSize = useWindowSize();
		const { enqueueSnackbar } = useSnackbar();
		const theme = useTheme();
		const isSmartphoneSize = useMediaQuery(theme.breakpoints.down("md")); // this is exclusive for the key itself

		const { roundDeltaSeconds: roundDeltaSecondsSuffixed } = useControls("Game logic", {
			roundDeltaSeconds: {
				value: roundDeltaSecondsDefault,
				min: 0,
				max: 2,
				suffix: "s",
			},
		});

		const roundDeltaSeconds = useMemo(
			() => Number(String(roundDeltaSecondsSuffixed).replace("s", "")),
			[roundDeltaSecondsSuffixed]
		);

		const { soundDeltaSeconds: soundDeltaSecondsSuffixed, maxTones } = useControls(
			"Sound synthesization",
			{
				soundDeltaSeconds: {
					value: soundDeltaSecondsDefault,
					min: 0.4,
					max: 2,
					suffix: "s",
				},
				maxTones: {
					value: maxTonesDefault,
					min: 0,
					max: 32,
				},
			}
		);

		const soundDeltaSeconds = useMemo(
			() => Number(String(soundDeltaSecondsSuffixed).replace("s", "")),
			[soundDeltaSecondsSuffixed]
		);

		const canvasRef = useRef<HTMLCanvasElement | null>(null);

		const [reRenderFlag, setReRenderFlag] = useState<boolean>(false);
		const [canvasSize, setCanvasSize] = useState<{ width?: number; height?: number }>({
			width: undefined,
			height: undefined,
		});
		const [levaPosition, setLevaPosition] = useState<{ x?: number; y?: number }>({
			x: undefined,
			y: undefined,
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

		useEffect(
			_.debounce(() => {
				if (windowSize.width !== undefined) {
					setLevaPosition({
						x: isSmartphoneSize ? -windowSize.width / 2 + levaPanelWidth / 2 + 15 : -15,
						y: isSmartphoneSize ? 0 : 100,
					});
				}
			}, 1000),
			[windowSize, isSmartphoneSize]
		);

		const aspect = useMemo(() => {
			let aspectVal = (windowSize?.width ?? 1) / (windowSize?.height ?? 1);

			if (aspectVal < 1) {
				aspectVal = 1 / aspectVal;
			}

			return aspectVal;
		}, [windowSize]);

		const levaPanelWidth = useMemo(
			() => Math.min(Math.round((windowSize.width ?? 100) * 0.9), 360),
			[windowSize.width]
		);

		const mountClickForSoundFlagRef = useRef<boolean>(false); // fix for react strict mode multiple runs of the below on mount useEffect

		useEffect(
			() => {
				if (Tone.Transport.state !== "started" && !mountClickForSoundFlagRef.current) {
					enqueueSnackbar("Click the game to enable sound", {
						variant: "info",
						autoHideDuration: 7000,
					});

					mountClickForSoundFlagRef.current = true;
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
				<Leva
					// this is just the starting prop, despite the name - the component is uncontrolled after mount
					key={`leva-gol-gui-${isSmartphoneSize}`}
					collapsed={isSmartphoneSize}
					titleBar={{
						title: "Game of Life parameters",
						position: levaPosition,
						onDrag: (position) => {
							setLevaPosition(position);
						},
					}}
					theme={{
						sizes: {
							rootWidth: `${levaPanelWidth}px`,
							numberInputMinWidth: "50px",
						},
					}}
					hidden={!gui}
				/>

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
