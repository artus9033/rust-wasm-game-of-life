import { blue, deepOrange, green, lightBlue, orange, red, yellow } from "@mui/material/colors";

import type { Frequency } from "tone/build/esm/core/type/Units";

export function synthesizeFreq(freq: Frequency): string {
	let noteStr = String(freq),
		note: string,
		variant: string;

	if (noteStr.length === 2) {
		note = noteStr[0];
		variant = noteStr[1];
	} else {
		note = noteStr.slice(0, 2);
		variant = noteStr[2];
	}

	let baseColor: {
		50: string;
		100: string;
		200: string;
		300: string;
		400: string;
		500: string;
		600: string;
		700: string;
		800: string;
		900: string;
		A100: string;
		A200: string;
		A400: string;
		A700: string;
	};

	switch (note) {
		default:
		case "A":
			baseColor = green;
			break;

		case "B":
			baseColor = blue;
			break;

		case "C":
			baseColor = red;
			break;

		case "D":
			baseColor = yellow;
			break;

		case "E":
			baseColor = lightBlue;
			break;

		case "F":
			baseColor = deepOrange;
			break;

		case "G":
			baseColor = orange;
			break;
	}

	let colorShade: keyof typeof baseColor;
	switch (variant) {
		default:
		case "1":
			colorShade = 300;
			break;

		case "2":
			colorShade = 600;
			break;

		case "3":
			colorShade = 900;
			break;

		case "4":
			colorShade = "A200";
			break;

		case "5":
			colorShade = "A400";
			break;

		case "6":
			colorShade = "A700";
			break;
	}

	return baseColor[colorShade];
}
