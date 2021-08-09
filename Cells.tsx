import _ from "lodash";
import dynamic from "next/dynamic";
import React, { RefObject, memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type WasmGameLogicType from "wasm-game-logic/wasm_game_logic";

import { useFrame } from "@react-three/fiber";

import SoundGridVisualizer from "./SoundGridVisualizer";
import {
	CANVAS_UNIT,
	CANVAS_UNIT_SIZE_SCALE,
	Size2D,
	threeColorBlack,
	threeColorWhite,
} from "./gameConstants";
import { useTonePlayer } from "./sound";

export type CellsProps = {
	canvasSize: Size2D;
	darkMode: boolean;
	roundDeltaSeconds: number;
	soundDeltaSeconds: number;
	maxTones: number;
	soundGridVisualizerRef?: RefObject<typeof SoundGridVisualizer | null>;
};

function updateTransform(transform: THREE.Matrix4, x: number, y: number, size: Size2D): void {
	transform.setPosition(
		x * CANVAS_UNIT - ((size?.width ?? 0) * CANVAS_UNIT) / 2,
		y * CANVAS_UNIT - ((size?.height ?? 0) * CANVAS_UNIT) / 2,
		0
	);
}

const DynamicCells = dynamic(
	{
		loader: async () => {
			const wasmGameLogic = (await import(
				"../gameOfLife/wasm-game-logic/pkg/wasm_game_logic_bg"
			)) as typeof WasmGameLogicType; // unfortunately, importing straight the non-bg file fails in Next.js

			const component = memo(
				({
					canvasSize,
					darkMode,
					roundDeltaSeconds,
					soundDeltaSeconds,
					maxTones,
					soundGridVisualizerRef,
				}: CellsProps) => {
					const playTone = useTonePlayer(soundDeltaSeconds, maxTones);

					const [_reRenderFlag, setReRenderFlag] = useState<string>(_.uniqueId());

					const map = useRef<WasmGameLogicType.Map | null>(null);
					const livingCells = useRef<THREE.InstancedMesh>(null!);
					const vanishingCells = useRef<THREE.InstancedMesh>(null!);
					const soundClockBuffer = useRef<number>(0);
					const roundClockBuffer = useRef<number>(0);

					const transform = useMemo(() => new THREE.Matrix4(), []);

					useEffect(
						() => {
							wasmGameLogic.init();
						},
						// on mount hook - no dependencies
						[]
					);

					useEffect(() => {
						const { width, height } = canvasSize;
						console.log("[Game of Life - Arena] Detected canvas size:", width, height);

						if (width !== undefined && height !== undefined) {
							if (!map.current)
								map.current = wasmGameLogic.Map.generate(width, height);

							setReRenderFlag(_.uniqueId()); // without this, everything fucks up
						}
					}, [canvasSize]);

					useFrame((_state, delta) => {
						if (map.current) {
							soundClockBuffer.current += delta;

							if (soundClockBuffer.current >= soundDeltaSeconds) {
								const soundGrid = playTone(map.current);

								if (soundGrid)
									(soundGridVisualizerRef?.current as any)?.updateNotesGrid(
										soundGrid
									);

								soundClockBuffer.current = 0;
							}
						}
					});

					useFrame((_state, delta) => {
						if (map.current) {
							roundClockBuffer.current += delta;

							if (roundClockBuffer.current >= roundDeltaSeconds) {
								map.current.morph_map_next_round();

								let onCt = 0,
									previouslyOnCt = 0;

								for (let y = 0; y < map.current.height; y++) {
									for (let x = 0; x < map.current.width; x++) {
										if (
											map.current.get_cell(x, y, false) ===
											wasmGameLogic.Cell.Alive
										) {
											// is turned on now
											onCt++;

											updateTransform(transform, x, y, canvasSize);
											livingCells.current.setMatrixAt(onCt, transform);
										} else if (
											map.current.get_cell(x, y, true) ===
											wasmGameLogic.Cell.Alive
										) {
											// was turned on the previous render
											previouslyOnCt++;

											updateTransform(transform, x, y, canvasSize);
											vanishingCells.current.setMatrixAt(
												previouslyOnCt,
												transform
											);
										}
									}
								}

								livingCells.current.count = onCt + 1; // clear out the remainders from last render
								livingCells.current.instanceMatrix.needsUpdate = true; // invalidate

								vanishingCells.current.count = previouslyOnCt + 1; // clear out the remainders from last render
								vanishingCells.current.instanceMatrix.needsUpdate = true; // invalidate

								roundClockBuffer.current = 0;
							}
						}
					});

					return map.current ? (
						<React.Fragment>
							<instancedMesh ref={livingCells} args={[null!, null!, 10000]}>
								<boxBufferGeometry
									args={[
										CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
										CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
										(CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE) / 3,
									]}
								/>
								<meshBasicMaterial
									color={darkMode ? threeColorWhite : threeColorBlack}
									shadowSide={THREE.DoubleSide}
									dithering
									opacity={0.45}
									transparent
								/>
							</instancedMesh>
							<instancedMesh ref={vanishingCells} args={[null!, null!, 10000]}>
								<boxBufferGeometry
									args={[
										CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
										CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
										(CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE) / 3,
									]}
								/>
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
				}
			);

			component.displayName = "Cells";

			return component;
		},
	},
	{
		ssr: false,
	}
);

DynamicCells.displayName = "DynamicCells";

export default DynamicCells;
