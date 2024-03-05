import { Leva, LevaInputs, button, useControls } from "leva";
import _ from "lodash";
import { useSnackbar } from "notistack";
import React, { RefObject, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as Tone from "tone";

import {
	Alert,
	CircularProgress,
	Collapse,
	Container,
	Grid,
	Link,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import { Canvas } from "@react-three/fiber";
import { useHover } from "@uidotdev/usehooks";

import MotionFader from "../components/animations/MotionFader";
import UniversalLink from "../components/misc/UniversalLink";
import useIsomorphicLayoutEffect from "../hooks/useIsomorphicLayoutEffect";
import useWindowSize from "../hooks/useWindowSize";
import Cells from "./Cells";
import SoundGridVisualizer from "./SoundGridVisualizer";
import Stats from "./Stats";
import { CANVAS_UNIT, threeColorBlack, threeColorWhite } from "./gameConstants";
import { startSoundContext } from "./sound";
import { Size2D } from "./types";

const AUTOPLAY_DOCS_URL = "https://developer.chrome.com/blog/autoplay";
const LONG_HOVER_MS = 1000;

export type ArenaProps = {
	darkMode: boolean;
	containerRef: RefObject<HTMLElement>;
	roundDeltaSecondsDefault?: number;
	soundEnabledDefault?: boolean;
	maxTonesDefault?: number;
	motionAnimStaggered?: boolean;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
	gui?: boolean;
	onChangeSoundEnabled?: (soundEnabled: boolean) => void;
	showSoundAvailabilityStatusWarning?: boolean;
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
		roundDeltaSecondsDefault = 0.2,
		soundEnabledDefault = true,
		maxTonesDefault = 2,
		motionAnimStaggered = false,
		soundGridVisualizerRef,
		gui = false,
		onChangeSoundEnabled = () => {},
		showSoundAvailabilityStatusWarning = false,
	}: ArenaProps) => {
		const windowSize = useWindowSize();
		const { enqueueSnackbar } = useSnackbar();
		const theme = useTheme();
		const isSmartphoneSize = useMediaQuery(theme.breakpoints.down("md")); // this is exclusive for the key itself
		const [autoplayDocsLinkHoverHookRef, isHoveringAutoplayDocsLink] = useHover();

		const autoplayDocsLinkLongHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

		const { "Round period (seconds)": roundDeltaSecondsSuffixed } = useControls(
			"Game logic",
			{
				"Round period (seconds)": {
					value: roundDeltaSecondsDefault,
					min: 0,
					max: 2,
					suffix: "s",
				},
			},
			{ order: 1 },
		);

		const roundDeltaSeconds = useMemo(
			() => Number(String(roundDeltaSecondsSuffixed).replace("s", "")),
			[roundDeltaSecondsSuffixed],
		);

		const { "Sound enabled": soundEnabled, "Max polyphonic tones": maxTones } = useControls(
			"Sound synthesization",
			{
				"Sound enabled": {
					value: soundEnabledDefault,
					type: LevaInputs.BOOLEAN,
				},
				"Max polyphonic tones": {
					value: maxTonesDefault,
					min: 0,
					max: 32,
					step: 1,
				},
			},
			{ order: 2 },
		);

		// onChangeSoundEnabled effect
		useEffect(() => {
			onChangeSoundEnabled(soundEnabled);
		}, [soundEnabled, onChangeSoundEnabled]);

		useControls(
			"Map controls",
			{
				"Regenerate map!": button(() => {
					setRegenerateMapFlag(_.uniqueId());
				}),
			},
			{ order: 3 },
		);

		// open autoplay docs link on hover effect
		useEffect(() => {
			if (isHoveringAutoplayDocsLink) {
				autoplayDocsLinkLongHoverTimerRef.current = setTimeout(() => {
					window.open(AUTOPLAY_DOCS_URL, "_blank", "noopener,noreferrer");
					autoplayDocsLinkLongHoverTimerRef.current = null;
				}, LONG_HOVER_MS);
			} else if (autoplayDocsLinkLongHoverTimerRef.current !== null) {
				clearTimeout(autoplayDocsLinkLongHoverTimerRef.current);
				autoplayDocsLinkLongHoverTimerRef.current = null;
			}
		}, [isHoveringAutoplayDocsLink]);

		const canvasRef = useRef<HTMLCanvasElement | null>(null);

		const [reRenderFlag, setReRenderFlag] = useState<boolean>(false);
		const [isWASMReady, setIsWASMReady] = useState<boolean>(false);
		const [regenerateMapFlag, setRegenerateMapFlag] = useState<string>(_.uniqueId());
		const [canvasSize, setCanvasSize] = useState<Size2D | undefined>(undefined);
		const [levaPosition, setLevaPosition] = useState<{ x?: number; y?: number }>({
			x: undefined,
			y: undefined,
		});
		const [soundAvailable, setSoundAvailable] = useState<boolean>(true);

		useIsomorphicLayoutEffect(() => {
			function updateSize() {
				const newWidth = containerRef.current?.clientWidth ?? window.innerWidth,
					newHeight = Math.min(
						window.outerHeight,
						containerRef.current?.clientHeight ?? Infinity,
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

		// eslint-disable-next-line react-hooks/exhaustive-deps
		useEffect(
			_.debounce(() => {
				if (windowSize.width !== undefined) {
					setLevaPosition({
						x: isSmartphoneSize ? -windowSize.width / 2 + levaPanelWidth / 2 + 15 : -15,
						y: isSmartphoneSize ? 0 : 100,
					});
				}
			}, 1000),
			[windowSize, isSmartphoneSize],
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
			[windowSize.width],
		);

		const mountClickForSoundFlagRef = useRef<boolean>(false); // fix for react strict mode multiple runs of the below on mount useEffect

		useEffect(
			() => {
				if (Tone.Transport.state !== "started" && !mountClickForSoundFlagRef.current) {
					enqueueSnackbar("Click the game to enable sound", {
						variant: "info",
						autoHideDuration: 7000,
					});

					setSoundAvailable(false);

					mountClickForSoundFlagRef.current = true;
				}
			},
			// on mount effect
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[],
		);

		// keep this always rendered, but mount in different place while loading
		const cells = (
			<Cells
				regenerateMapFlag={regenerateMapFlag}
				roundDeltaSeconds={roundDeltaSeconds}
				soundEnabled={soundEnabled}
				maxTones={maxTones}
				canvasSize={canvasSize}
				darkMode={darkMode}
				soundGridVisualizerRef={soundGridVisualizerRef}
				setIsWASMReady={setIsWASMReady}
			/>
		);

		const activateSound = useCallback(() => {
			if (Tone.Transport.state !== "started") {
				startSoundContext();

				// @ts-ignore: this property actually changes here (or at least it should if the operation was successful)
				if (Tone.Transport.state === "started") {
					enqueueSnackbar("Sound is now available", {
						variant: "success",
					});

					setSoundAvailable(true);
					setReRenderFlag(!reRenderFlag); // the component won't re-render automatically, as no state/prop/hook change
				} else {
					enqueueSnackbar("Could not enable sound...", {
						variant: "error",
					});
				}
			}
		}, [enqueueSnackbar, reRenderFlag]);

		return (
			<>
				{showSoundAvailabilityStatusWarning && (
					<MotionFader
						motionProps={{
							style: {
								width: "100%",
								display: "flex",
								position: "absolute",
								top: 0,
								zIndex: 1,
								cursor: soundAvailable ? undefined : "pointer",
							},
							onTap: activateSound,
						}}
					>
						<Container maxWidth="sm">
							<Collapse in={!soundAvailable}>
								<Alert
									sx={{
										mb: 2,
										mt: 4,
										backdropFilter: "blur(8px)",
										padding: theme.spacing(1, 3),
										cursor: soundAvailable ? undefined : "pointer",
									}}
									severity="warning"
									variant="outlined"
								>
									Sound is not yet available due to{" "}
									<UniversalLink
										ref={autoplayDocsLinkHoverHookRef}
										external
										href={AUTOPLAY_DOCS_URL}
										dummy
										tooltipped
									>
										browser policies (hover to open)
									</UniversalLink>
									.
									<br />
									<br />
									Click any interactive item, the map or{" "}
									<Link onClick={activateSound}>even here</Link> to enable it!
								</Alert>
							</Collapse>
						</Container>
					</MotionFader>
				)}

				<div
					style={{
						position: "relative",
						height: "70vh",
						cursor: soundAvailable ? undefined : "pointer",
						width: "100%",
					}}
					onClick={activateSound}
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
							style={{ position: "absolute" }}
							orthographic
							camera={{
								// scale: new THREE.Vector3(1, -1, 1),
								position: new THREE.Vector3(0, 0, 100),
								zoom: 1,
							}}
							key={aspect}
							ref={canvasRef}
						>
							<color
								attach="background"
								args={[darkMode ? threeColorBlack : threeColorWhite]}
							/>

							{cells}

							{!!stats && <Stats parent={containerRef} className={statsClassName} />}
						</Canvas>

						{!isWASMReady && (
							<Grid
								justifyContent="center"
								container
								direction="column"
								display="flex"
								style={{
									position: "relative",
									height: "70vh",
									width: "100%",
								}}
							>
								<CircularProgress style={{ alignSelf: "center" }} size="3.5rem" />

								<Typography variant="h6" style={{ alignSelf: "center" }}>
									Loading...
								</Typography>
							</Grid>
						)}
					</MotionFader>
				</div>
			</>
		);
	},
);

Arena.displayName = "Arena";

export default Arena;
