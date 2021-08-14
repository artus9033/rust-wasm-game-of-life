import _ from "lodash";
import { useMemo, useRef } from "react";
import * as Tone from "tone";
import type { Frequency } from "tone/build/esm/core/type/Units";
import type WasmGameLogicType from "wasm-game-logic/wasm_game_logic";

export const MAJOR_PENTATONIC = [
	"C6",
	"A5",
	"G5",
	"E5",
	"D5",
	"C5",
	"A4",
	"G4",
	"E4",
	"D4",
	"C4",
	"A3",
	"G3",
	"E3",
	"D3",
	"C3",
];

export const MINOR_PENTATONIC = [
	"C6",
	"A#5",
	"G5",
	"E#5",
	"D#5",
	"C5",
	"A#4",
	"G4",
	"E#4",
	"D#4",
	"C4",
	"A#3",
	"G3",
	"E#3",
	"D#3",
	"C3",
];

export function startSoundContext(bDisableLooping: boolean = true) {
	if (bDisableLooping) Tone.Transport.loop = false;

	if (Tone.Transport.state !== "started") {
		Tone.Transport.start();
	}
}

export function useTonePlayer(soundDeltaSeconds: number, maxTones: number) {
	const _synthRef = useRef<Tone.PolySynth | null>(null);

	const synth = useMemo(() => {
		let justCreated = false;

		if (!_synthRef.current) {
			_synthRef.current = new Tone.PolySynth(Tone.FMSynth, {
				volume: -32,
				portamento: 0.005,
			});

			justCreated = true;
		}

		_synthRef.current.maxPolyphony = maxTones;

		if (justCreated) {
			_synthRef.current.toDestination();
		}

		return _synthRef.current;
	}, [maxTones]);

	return (map: WasmGameLogicType.Map) => {
		if (!synth.disposed) {
			const proportion = map.width / map.height;

			const nCells = Math.min(maxTones, Math.round(Math.sqrt(proportion * maxTones))),
				musicGridSizeX = Math.round(map.width / nCells);

			const nRows = Math.ceil((maxTones + musicGridSizeX - 1) / musicGridSizeX),
				musicGridSizeY = Math.round(map.height / nRows);

			const notesGrid: Array<Array<Frequency>> = [];

			for (let gy = 0; gy * musicGridSizeY < map.height; gy++) {
				const notesThisRow: Frequency[] = [];

				for (let gx = 0; gx * musicGridSizeX < map.width; gx++) {
					const sum = map.current_map_subgrid_sum(gx, gy, musicGridSizeX, musicGridSizeY);

					if (sum) {
						const tonePalette = sum % 2 === 1 ? MINOR_PENTATONIC : MAJOR_PENTATONIC,
							n = tonePalette.length;

						notesThisRow.push(tonePalette[((sum % n) + n) % n]);
					} else {
						// this means bad luck, as the slice start index is >= stop index
						// just omit this grid cell - this is just imprecision of grid size calculations
						break;
					}
				}

				if (notesThisRow.length) notesGrid.push(notesThisRow);
			}

			if (Tone.Transport.state === "started") {
				synth.triggerAttackRelease(notesGrid.flat(), soundDeltaSeconds);
			}

			return notesGrid;
		}
	};
}
