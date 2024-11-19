import _ from "lodash";
import { useEffect, useMemo, useRef } from "react";
import * as Tone from "tone";
import type { Frequency } from "tone/build/esm/core/type/Units";
import type WasmGameLogicType from "wasm-game-logic/wasm_game_logic";

const MAJOR_PENTATONIC = [
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

const MINOR_PENTATONIC = [
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
	if (bDisableLooping) Tone.getTransport().loop = false;

	if (Tone.getTransport().state !== "started") {
		Tone.getTransport().start();
	}
}

export enum SynthVoice {
	DUO_SYNTH,
	FM_SYNTH,
}

export function useTonePlayer(maxTones: number, soundEnabled: boolean, synthVoice: SynthVoice) {
	const _synthRef = useRef<Tone.PolySynth | null>(null);
	const _lastSynthVoiceRef = useRef<SynthVoice | null>(null);
	const previousNotesRef = useRef<Frequency[]>([]);

	const synth = useMemo(() => {
		let justCreated = false;

		if (!_synthRef.current || _lastSynthVoiceRef.current !== synthVoice) {
			if (_synthRef.current) {
				_synthRef.current.releaseAll();
				_synthRef.current.dispose();
			}

			_synthRef.current = new Tone.PolySynth(
				(synthVoice === SynthVoice.DUO_SYNTH ? Tone.DuoSynth : Tone.FMSynth) as any,
				{
					volume: -24,
					portamento: 0.005,
				},
			);

			_lastSynthVoiceRef.current = synthVoice;
			justCreated = true;
		}

		_synthRef.current.maxPolyphony = maxTones * 2; // double the tones to mix last + new notes together

		if (justCreated) {
			_synthRef.current.toDestination();
		}

		return _synthRef.current;
	}, [maxTones, synthVoice]);

	useEffect(() => {
		return () => {
			_synthRef.current?.releaseAll();
			_synthRef.current?.dispose();
		};
	}, []);

	return (map: WasmGameLogicType.Map, notesDuration: number) => {
		if (!soundEnabled) return;

		if (!synth.disposed) {
			const proportion = map.width / map.height;

			const nCells = Math.min(maxTones, Math.round(Math.sqrt(proportion * maxTones))),
				musicGridSizeX = Math.round(map.width / nCells);

			const nRows = Math.ceil((maxTones + musicGridSizeX - 1) / musicGridSizeX),
				musicGridSizeY = Math.round(map.height / nRows);

			const notesGrid: Array<Array<Frequency>> = [];

			for (let gy = 0; gy < nRows; gy++) {
				const notesThisRow: Frequency[] = [];

				for (let gx = 0; gx < nCells; gx++) {
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

			if (Tone.getTransport().state === "started") {
				const newNotes = notesGrid.flat();

				synth.triggerRelease(previousNotesRef.current, 0);
				synth.triggerAttack(newNotes, notesDuration / 1000);

				previousNotesRef.current = newNotes;
			}

			return notesGrid;
		}
	};
}
