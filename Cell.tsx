import React, { useMemo, useRef } from "react";
import { BoxGeometry as THREEBoxGeometry, DoubleSide as THREEDoubleSide } from "three";
import { Cell as MapCellType } from "wasm-game-logic/wasm_game_logic";

import {
	CANVAS_UNIT,
	CANVAS_UNIT_SIZE_SCALE,
	threeColorBlack,
	threeColorWhite,
} from "./gameConstants";

export type CellProps = {
	x: number;
	y: number;
	canvasWidth: number;
	canvasHeight: number;
	darkMode: boolean;
	cellValue: MapCellType;
};

const boxGeometry = new THREEBoxGeometry(
	CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
	CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
	(CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE) / 3,
);

export const Cell = ({ x, y, canvasWidth, canvasHeight, darkMode, cellValue }: CellProps) => {
	const { canvasX, canvasY } = useMemo(
		() => ({
			canvasX: x * CANVAS_UNIT - (canvasWidth * CANVAS_UNIT) / 2,
			canvasY: y * CANVAS_UNIT - (canvasHeight * CANVAS_UNIT) / 2,
		}),
		[x, y, canvasWidth, canvasHeight],
	);

	return (
		<mesh position={[canvasX, canvasY, 0]} scale={[1, 1, 1]}>
			{/* <boxGeometry
				attach="geometry"
				args={[
					CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
					CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE,
					(CANVAS_UNIT * CANVAS_UNIT_SIZE_SCALE) / 3,
				]}
			/>
			<meshStandardMaterial
				attach="material"
				// color={darkMode ? threeColorWhite : threeColorBlack}
				color={threeColorWhite}
				shadowSide={THREEDoubleSide}
				dithering
				opacity={0.18}
				transparent
			/> */}

			<primitive object={boxGeometry} />
			<meshBasicMaterial
				color={darkMode ? threeColorWhite : threeColorBlack}
				shadowSide={THREEDoubleSide}
				dithering
				opacity={cellValue === MapCellType.Dead ? 0 : 0.18}
				transparent
			/>
		</mesh>
	);
};

export default Cell;
