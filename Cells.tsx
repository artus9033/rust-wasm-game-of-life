import _ from "lodash";
import dynamic from "next/dynamic";
import React, { RefObject, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Frequency } from "tone/build/esm/core/type/Units";
import type WasmGameLogicType from "wasm-game-logic/wasm_game_logic";
import { Cell as CellEnum } from "wasm-game-logic/wasm_game_logic";

import { useFrame, useThree } from "@react-three/fiber";

import SoundGridVisualizer from "./SoundGridVisualizer";
import { SYNTH_ATTACK_MINIMUM_DURATION_MS } from "./gameConstants";
import { useOnMountOnce } from "./hooks/useOnMountOnce";
import { SynthVoice, useTonePlayer } from "./sound";
import { Size2D } from "./types";

export type CellsProps = {
	canvasSize?: Size2D;
	darkMode: boolean;
	fps: number;
	cellEdgeSizePx: number;
	soundEnabled: boolean;
	maxTones: number;
	synthVoice?: SynthVoice;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
	setIsWASMReady: (value: boolean) => void | Promise<void>;
	regenerateMapFlag?: string; // when this prop changes, the map will be re-generated
};

const Cells = memo(
	({
		canvasSize,
		darkMode,
		fps,
		soundEnabled,
		maxTones,
		synthVoice = SynthVoice.DUO_SYNTH,
		soundGridVisualizerRef,
		regenerateMapFlag = "",
		setIsWASMReady,
		cellEdgeSizePx,
	}: CellsProps) => {
		const {
			advance: advanceThreeRenderer,
			set: setThreeOptions,
			frameloop: originalFrameloop,
		} = useThree();

		const playTone = useTonePlayer(maxTones, soundEnabled, synthVoice);

		const [_reRenderFlag, setReRenderFlag] = useState<string>(_.uniqueId());
		const [wasmGameLogic, setWASMGameLogic] = useState<typeof WasmGameLogicType | null>(null);

		// custom frequency frameloop setup effect
		useEffect(
			() => {
				console.log(
					"[Game of Life - Cells] Setting up custom render frameloop with fps:",
					fps,
				);

				let lastTimestamp: number = 0;
				let animationFrameID: any = null;
				const interval = 1000 / fps; // convert from fps to delay in ms

				function tick(delta: number) {
					animationFrameID = requestAnimationFrame(tick);

					let timestamp = delta - lastTimestamp;
					if (timestamp > interval) {
						advanceThreeRenderer(delta);
						lastTimestamp = delta - (timestamp % interval);
					}
				}

				// use a custom frameloop
				setThreeOptions({ frameloop: "never" });
				animationFrameID = requestAnimationFrame(tick);

				// cleanup
				return () => {
					cancelAnimationFrame(animationFrameID);
					setThreeOptions({ frameloop: originalFrameloop });
				};
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[fps],
		);

		const map = useRef<WasmGameLogicType.Map | null>(null);
		const soundClockBuffer = useRef<number>(0);
		const cellsInstancedMesh = useRef<THREE.InstancedMesh | null>(null);
		const soundGridRef = useRef<Array<Array<Frequency>> | undefined>(undefined);
		const lastRegenerateMapFlagRef = useRef<string>("");

		const calculateTransform = useCallback(
			(x: number, y: number, size: Size2D) =>
				new THREE.Matrix4().setPosition(
					x * cellEdgeSizePx - ((size?.width ?? 0) * cellEdgeSizePx) / 2,
					y * cellEdgeSizePx - ((size?.height ?? 0) * cellEdgeSizePx) / 2,
					0,
				),
			[cellEdgeSizePx],
		);

		const CELL_COLORS_LUT: Record<CellEnum, THREE.Color> = useMemo(
			() =>
				darkMode
					? {
							[CellEnum.Alive]: new THREE.Color(0xffffff),
							[CellEnum.Vanishing1]: new THREE.Color(0x494949),
							[CellEnum.Vanishing2]: new THREE.Color(0x222222),
							[CellEnum.Vanishing3]: new THREE.Color(0x080808),
							[CellEnum.Dead]: new THREE.Color(0x000000),
						}
					: {
							[CellEnum.Alive]: new THREE.Color(0x000000),
							[CellEnum.Vanishing1]: new THREE.Color(0xbebebe),
							[CellEnum.Vanishing2]: new THREE.Color(0xd3d3d3),
							[CellEnum.Vanishing3]: new THREE.Color(0xe8e8e8),
							[CellEnum.Dead]: new THREE.Color(0xffffff),
						},
			[darkMode],
		);

		const boxGeometry = useMemo(
			() => new THREE.BoxGeometry(cellEdgeSizePx, cellEdgeSizePx, cellEdgeSizePx / 3),
			[cellEdgeSizePx],
		);

		const canvasResolution = useMemo(
			() => (canvasSize ? Math.floor(canvasSize.width) * Math.floor(canvasSize.height) : 0),
			[canvasSize],
		);

		useOnMountOnce(() => {
			(async () => {
				setWASMGameLogic(await import("wasm-game-logic/wasm_game_logic.js"));

				setIsWASMReady(true);
			})();
		});

		/**
		 * Prepares THREE WebGL scene for operations with the WASM game logic;
		 * - THREE.js requires that `setColorAt` is called at least once before anything
		 * else is done, otherwise accessing `instanceColor` will yield `undefined`
		 * - transform needs to be set up for each of the instances only once (positions are fixed,
		 * only the color changes)
		 *
		 * Note: this is also invoked whenever the instancedMesh instance is re-created
		 */
		const maybePrepareWebGLScene = useCallback(
			(bSilent: boolean) => {
				if (map.current && cellsInstancedMesh.current) {
					if (!bSilent) {
						let entitiesCount = Math.round(canvasSize!.width * canvasSize!.height);

						console.log(
							`[Game of Life - Cells] Preparing WebGL scene: setting up colors and transforms on map of size ${
								canvasSize!.width
							} entities (${canvasSize!.width * cellEdgeSizePx} px^2) x ${
								canvasSize!.height
							} entities (${
								canvasSize!.height * cellEdgeSizePx
							} px^2) => ${entitiesCount} entities^2 = ${
								entitiesCount * cellEdgeSizePx ** 2
							} px^2`,
						);
					}

					// the below is needed to ensure that instanceColor property will be generated (without this call,
					// THREE.js will leave the property with null value, which will cause a runtime error later)
					cellsInstancedMesh.current.setColorAt(0, new THREE.Color(0x000000));

					// ensure the transforms are initialized for the current scenario
					const { height: mapHeightPrecomputed, width: mapWidthPrecomputed } =
						map.current;

					for (let y = 0; y < mapHeightPrecomputed; y++) {
						for (let x = 0; x < mapWidthPrecomputed; x++) {
							const index = mapWidthPrecomputed * y + x;

							cellsInstancedMesh.current.setMatrixAt(
								index,
								calculateTransform(x, y, canvasSize!),
							);
						}
					}

					cellsInstancedMesh.current.instanceMatrix.needsUpdate = true;
					cellsInstancedMesh.current.instanceColor!.needsUpdate = true;

					if (!bSilent)
						console.log(
							"[Game of Life - Cells] Preparing WebGL scene: binding THREE.js instanced mesh and colors LUT to WASM ",
						);
					map.current.bind_js_cells_instanced_mesh(
						cellsInstancedMesh.current,
						CELL_COLORS_LUT,
					);

					if (!bSilent) console.log("[Game of Life - Cells] WebGL scene prepared");
				}
			},
			[canvasSize, CELL_COLORS_LUT, calculateTransform, cellEdgeSizePx],
		);

		// map setup effect
		useEffect(() => {
			if (!wasmGameLogic || !canvasSize) return;

			const { width, height } = canvasSize;
			console.log("[Game of Life - Cells] Detected canvas size:", width, height);

			if (width !== undefined && height !== undefined) {
				let mapChanged = false;

				if (!map.current) {
					// first initialization
					console.log("[Game of Life - Cells] Initializing map for the first time...");

					map.current = wasmGameLogic.Map.new(width, height); // width, height
					mapChanged = true;

					lastRegenerateMapFlagRef.current = regenerateMapFlag;
				} else if (regenerateMapFlag !== lastRegenerateMapFlagRef.current) {
					// re-initialization with or without changing map size

					if (width === map.current.width && height === map.current.height) {
						console.log(
							"[Game of Life - Cells] Re-initializing map (same size, no reallocation)...",
						);

						map.current.regenerate();
					} else {
						console.log(
							"[Game of Life - Cells] Re-initializing map (new size, will perform reallocation)...",
						);

						map.current = wasmGameLogic.Map.new(width, height);
					}

					mapChanged = true;
					lastRegenerateMapFlagRef.current = regenerateMapFlag;
				}

				if (mapChanged) {
					maybePrepareWebGLScene(true);
				}

				setReRenderFlag(_.uniqueId()); // without this, everything fucks up
			}
		}, [canvasSize, regenerateMapFlag, wasmGameLogic, maybePrepareWebGLScene]);

		useFrame((_state, delta) => {
			if (!wasmGameLogic || !canvasSize || !cellsInstancedMesh.current?.instanceColor) return;

			if (map.current) {
				soundClockBuffer.current += delta;

				// tone.js requires the delta to be > 0; here, we choose SYNTH_ATTACK_MINIMUM_DURATION as a minimum so that sounds are audible
				if (soundClockBuffer.current > SYNTH_ATTACK_MINIMUM_DURATION_MS) {
					// sound update (if sound available & enabled)
					soundGridRef.current = playTone(
						// play either for the length of the sound frequency
						map.current,
						// or for half the length of a single frame (this handles the case when the fps is set to a low value
						// so as not to have not "music" at all), whichever is greater; multiply the single frame length twice
						// to make it mix the previous + next tones with PolySync for the case when fps is set low
						Math.max(SYNTH_ATTACK_MINIMUM_DURATION_MS * 2, (1000 / fps) * 0.5),
					);

					if (soundGridRef.current)
						(soundGridVisualizerRef?.current as any)?.updateNotesGrid(
							soundGridRef.current,
						);

					soundClockBuffer.current = 0;
				}

				// game update
				map.current.morph_map_next_round();
			}
		});

		return map.current && canvasSize ? (
			<React.Fragment>
				<instancedMesh
					ref={(ref) => {
						cellsInstancedMesh.current = ref;

						maybePrepareWebGLScene(false);
					}}
					args={[
						boxGeometry,
						new THREE.MeshBasicMaterial({
							side: THREE.DoubleSide,
							toneMapped: false,
						}),
						canvasResolution,
					]}
				/>
			</React.Fragment>
		) : null;
	},
	(prevProps, nextProps) => _.isEqual(prevProps, nextProps),
);

Cells.displayName = "Cells";

export default dynamic(() => Promise.resolve(Cells), { ssr: false });
