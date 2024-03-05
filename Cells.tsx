import _ from "lodash";
import dynamic from "next/dynamic";
import React, { RefObject, memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Frequency } from "tone/build/esm/core/type/Units";
import type WasmGameLogicType from "wasm-game-logic/wasm_game_logic";

import { useFrame } from "@react-three/fiber";

import Cell from "./Cell";
import SoundGridVisualizer from "./SoundGridVisualizer";
import {
	CANVAS_UNIT,
	CANVAS_UNIT_SIZE_SCALE,
	SYNTH_ATTACK_MINIMUM_DURATION,
	threeColorBlack,
	threeColorWhite,
} from "./gameConstants";
import { useOnMountOnce } from "./hooks/useOnMountOnce";
import { useTonePlayer } from "./sound";
import { Size2D } from "./types";

export type CellsProps = {
	canvasSize?: Size2D;
	darkMode: boolean;
	roundDeltaSeconds: number;
	soundEnabled: boolean;
	maxTones: number;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
	setIsWASMReady: (value: boolean) => void | Promise<void>;
	regenerateMapFlag?: string; // when this prop changes, the map will be re-generated
};

function updateTransform(transform: THREE.Matrix4, x: number, y: number, size: Size2D): void {
	transform.setPosition(
		x * CANVAS_UNIT - ((size?.width ?? 0) * CANVAS_UNIT) / 2,
		y * CANVAS_UNIT - ((size?.height ?? 0) * CANVAS_UNIT) / 2,
		0,
	);
}

const Cells = memo(
	({
		canvasSize,
		darkMode,
		roundDeltaSeconds,
		soundEnabled,
		maxTones,
		soundGridVisualizerRef,
		regenerateMapFlag = "",
		setIsWASMReady,
	}: CellsProps) => {
		const playTone = useTonePlayer(maxTones, soundEnabled);

		const [_reRenderFlag, setReRenderFlag] = useState<string>(_.uniqueId());
		const [wasmGameLogic, setWASMGameLogic] = useState<typeof WasmGameLogicType | null>(null);

		const map = useRef<WasmGameLogicType.Map | null>(null);
		const roundClockBuffer = useRef<number>(0);
		const soundClockBuffer = useRef<number>(0);
		const livingCells = useRef<THREE.InstancedMesh | null>(null);
		const vanishingCells = useRef<THREE.InstancedMesh | null>(null);
		const soundGridRef = useRef<Array<Array<Frequency>> | undefined>(undefined);
		const lastRegenerateMapFlagRef = useRef<string>("");
		const wasmMemory = useRef<Uint8Array>();
		const bufferPointer = useRef<number>(0);

		const transform = useMemo(() => new THREE.Matrix4(), []);
		const boxGeometry = useMemo(
			() =>
				new THREE.BoxGeometry(
					CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
					CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
					(CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE) / 3,
				),
			[],
		);

		const canvasResolution = useMemo(
			() => (canvasSize ? canvasSize.width * canvasSize.height : 0),
			[canvasSize],
		);

		useOnMountOnce(() => {
			(async () => {
				setWASMGameLogic(await import("wasm-game-logic/wasm_game_logic.js"));

				setIsWASMReady(true);
			})();
		});

		// initialize on new WASM game logic instance
		useEffect(() => {
			wasmGameLogic?.init();
		}, [wasmGameLogic]);

		// map setup effect
		useEffect(() => {
			if (!wasmGameLogic || !canvasSize) return;

			const { width, height } = canvasSize;
			console.log("[Game of Life - Arena] Detected canvas size:", width, height);

			if (width !== undefined && height !== undefined) {
				let mapChanged = false;

				if (!map.current) {
					// first initialization
					console.log("[Game of Life - Arena] Initializing map for the first time...");

					map.current = wasmGameLogic.Map.new(width, height);
					mapChanged = true;

					lastRegenerateMapFlagRef.current = regenerateMapFlag;
				} else if (regenerateMapFlag !== lastRegenerateMapFlagRef.current) {
					// re-initialization with or without changing map size

					if (width === map.current.width && height === map.current.height) {
						console.log(
							"[Game of Life - Arena] Re-initializing map (same size, no reallocation)...",
						);

						map.current.regenerate();
						mapChanged = true;
					} else {
						console.log(
							"[Game of Life - Arena] Re-initializing map (new size, will perform reallocation)...",
						);

						map.current = wasmGameLogic.Map.new(width, height);
						mapChanged = true;
					}

					lastRegenerateMapFlagRef.current = regenerateMapFlag;
				}

				if (mapChanged) {
					wasmMemory.current = new Uint8Array((wasmGameLogic as any).getMemory());
					bufferPointer.current = map.current.get_map_ptr();
				}

				setReRenderFlag(_.uniqueId()); // without this, everything fucks up
			}
		}, [canvasSize, regenerateMapFlag, wasmGameLogic]);

		useFrame((_state, delta) => {
			if (!wasmGameLogic || !canvasSize) return;

			if (map.current) {
				const { height: mapHeightPrecomputed, width: mapWidthPrecomputed } = map.current;

				roundClockBuffer.current += delta;
				soundClockBuffer.current += delta;

				if (roundClockBuffer.current >= roundDeltaSeconds) {
					// tone.js requires the delta to be > 0; here, we choose SYNTH_ATTACK_MINIMUM_DURATION as a minimum so that sounds are audible
					if (soundClockBuffer.current > SYNTH_ATTACK_MINIMUM_DURATION) {
						// sound update (if sound available & enabled)
						soundGridRef.current = playTone(
							map.current,
							Math.max(SYNTH_ATTACK_MINIMUM_DURATION, soundClockBuffer.current),
						);

						if (soundGridRef.current)
							(soundGridVisualizerRef?.current as any)?.updateNotesGrid(
								soundGridRef.current,
							);

						soundClockBuffer.current = 0;
					}

					// game update
					map.current.morph_map_next_round();

					let onCt = 0,
						previouslyOnCt = 0;

					for (let y = 0; y < mapHeightPrecomputed; y++) {
						for (let x = 0; x < mapWidthPrecomputed; x++) {
							const cell =
								wasmMemory.current![
									bufferPointer.current + mapWidthPrecomputed * y + x
								];

							if (cell === wasmGameLogic.Cell.Alive) {
								// is turned on now
								onCt++;

								updateTransform(transform, x, y, canvasSize);
								livingCells.current?.setMatrixAt(onCt, transform);
							} else if (cell === wasmGameLogic.Cell.Vanishing) {
								// was turned on the previous render
								previouslyOnCt++;

								if (livingCells.current) {
									livingCells.current.count = onCt + 1; // clear out the remainders from last render
									livingCells.current.instanceMatrix.needsUpdate = true; // invalidate
								}

								if (vanishingCells.current) {
									vanishingCells.current.count = previouslyOnCt + 1; // clear out the remainders from last render
									vanishingCells.current.instanceMatrix.needsUpdate = true; // invalidate
								}

								updateTransform(transform, x, y, canvasSize);
								vanishingCells.current?.setMatrixAt(previouslyOnCt, transform);
							}
						}
					}

					roundClockBuffer.current = 0;
				}
			}
		});

		return map.current && canvasSize ? (
			<React.Fragment>
				<instancedMesh ref={livingCells} args={[null!, null!, canvasResolution]}>
					<primitive object={boxGeometry} />
					<meshBasicMaterial
						color={darkMode ? threeColorWhite : threeColorBlack}
						shadowSide={THREE.DoubleSide}
						dithering
						opacity={0.45}
						transparent
					/>
				</instancedMesh>
				<instancedMesh ref={vanishingCells} args={[null!, null!, canvasResolution]}>
					<primitive object={boxGeometry} />
					<meshBasicMaterial
						color={darkMode ? threeColorWhite : threeColorBlack}
						shadowSide={THREE.DoubleSide}
						dithering
						opacity={0.18}
						transparent
					/>
				</instancedMesh>
			</React.Fragment>
		) : null;
	},
);

Cells.displayName = "Cells";

export default dynamic(() => Promise.resolve(Cells), { ssr: false });
