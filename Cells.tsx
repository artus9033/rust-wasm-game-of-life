import _ from "lodash";
import dynamic from "next/dynamic";
import React, { RefObject, memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Frequency } from "tone/build/esm/core/type/Units";
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
import { useOnMountOnce } from "./hooks/useOnMountOnce";
import { useTonePlayer } from "./sound";

export type CellsProps = {
	canvasSize: Size2D;
	darkMode: boolean;
	roundDeltaSeconds: number;
	soundDeltaSeconds: number;
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
		soundDeltaSeconds,
		maxTones,
		soundGridVisualizerRef,
		regenerateMapFlag = "",
		setIsWASMReady,
	}: CellsProps) => {
		const playTone = useTonePlayer(soundDeltaSeconds, maxTones);

		const [_reRenderFlag, setReRenderFlag] = useState<string>(_.uniqueId());
		const [wasmGameLogic, setWASMGameLogic] = useState<typeof WasmGameLogicType | null>(null);

		const map = useRef<WasmGameLogicType.Map | null>(null);
		const livingCells = useRef<THREE.InstancedMesh | null>(null);
		const vanishingCells = useRef<THREE.InstancedMesh | null>(null);
		const soundClockBuffer = useRef<number>(0);
		const roundClockBuffer = useRef<number>(0);
		const soundGridRef = useRef<Array<Array<Frequency>> | undefined>(undefined);
		const lastRegenerateMapFlagRef = useRef<string>("");

		useOnMountOnce(() => {
			(async () => {
				setWASMGameLogic(await import("wasm-game-logic/wasm_game_logic.js"));

				setIsWASMReady(true);
			})();
		});

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

		// initialize on new WASM game logic instance
		useEffect(() => {
			wasmGameLogic?.init();
		}, [wasmGameLogic]);

		useEffect(() => {
			if (!wasmGameLogic) return;

			const { width, height } = canvasSize;
			console.log("[Game of Life - Arena] Detected canvas size:", width, height);

			if (width !== undefined && height !== undefined) {
				if (!map.current || regenerateMapFlag !== lastRegenerateMapFlagRef.current) {
					map.current = wasmGameLogic.Map.generate(width, height);

					lastRegenerateMapFlagRef.current = regenerateMapFlag;
				}

				setReRenderFlag(_.uniqueId()); // without this, everything fucks up
			}
		}, [canvasSize, regenerateMapFlag, wasmGameLogic]);

		useFrame((_state, delta) => {
			if (map.current) {
				soundClockBuffer.current += delta;

				if (soundClockBuffer.current >= soundDeltaSeconds) {
					soundGridRef.current = playTone(map.current);

					if (soundGridRef.current)
						(soundGridVisualizerRef?.current as any)?.updateNotesGrid(
							soundGridRef.current,
						);

					soundClockBuffer.current = 0;
				}
			}
		});

		useFrame((_state, delta) => {
			if (!wasmGameLogic) return;

			if (map.current) {
				roundClockBuffer.current += delta;

				if (roundClockBuffer.current >= roundDeltaSeconds) {
					map.current.morph_map_next_round();

					let onCt = 0,
						previouslyOnCt = 0;

					for (let y = 0; y < map.current.height; y++) {
						for (let x = 0; x < map.current.width; x++) {
							if (map.current.get_cell(x, y, false) === wasmGameLogic.Cell.Alive) {
								// is turned on now
								onCt++;

								updateTransform(transform, x, y, canvasSize);
								livingCells.current?.setMatrixAt(onCt, transform);
							} else if (
								map.current.get_cell(x, y, true) === wasmGameLogic.Cell.Alive
							) {
								// was turned on the previous render
								previouslyOnCt++;

								updateTransform(transform, x, y, canvasSize);
								vanishingCells.current?.setMatrixAt(previouslyOnCt, transform);
							}
						}
					}

					if (livingCells.current) {
						livingCells.current.count = onCt + 1; // clear out the remainders from last render
						livingCells.current.instanceMatrix.needsUpdate = true; // invalidate
					}

					if (vanishingCells.current) {
						vanishingCells.current.count = previouslyOnCt + 1; // clear out the remainders from last render
						vanishingCells.current.instanceMatrix.needsUpdate = true; // invalidate
					}

					roundClockBuffer.current = 0;
				}
			}
		});

		return map.current ? (
			<React.Fragment>
				<instancedMesh ref={livingCells} args={[null!, null!, 10000]}>
					<primitive object={boxGeometry} />
					<meshBasicMaterial
						color={darkMode ? threeColorWhite : threeColorBlack}
						shadowSide={THREE.DoubleSide}
						dithering
						opacity={0.45}
						transparent
					/>
				</instancedMesh>
				<instancedMesh ref={vanishingCells} args={[null!, null!, 10000]}>
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
