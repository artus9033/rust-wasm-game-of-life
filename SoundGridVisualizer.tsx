import { boundMethod } from "autobind-decorator";
import React from "react";
import type { Frequency } from "tone/build/esm/core/type/Units";

import { VolumeOff } from "@mui/icons-material";
import {
	Alert,
	Container,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Theme,
	useTheme,
} from "@mui/material";

import { synthesizeFreq } from "./chromestesia";

type SoundGridVisualizerProps = {
	theme: Theme;
};

type SoundGridVisualizerState = {
	notesGrid: Array<Array<Frequency>> | null;
};

const CustomContainer = ({ children }: { children: React.ReactNode }) => (
	<Container>{children}</Container>
);

class SoundGridVisualizerRaw extends React.Component<
	SoundGridVisualizerProps,
	SoundGridVisualizerState
> {
	state: SoundGridVisualizerState = {
		notesGrid: null,
	};

	@boundMethod
	public updateNotesGrid(newNotesGrid: Array<Array<Frequency>> | null) {
		this.setState({
			notesGrid: newNotesGrid,
		});
	}

	render() {
		return (
			<Stack>
				{!this.state.notesGrid?.length && (
					<Container maxWidth="sm">
						<Alert icon={<VolumeOff fontSize="inherit" />} severity="warning">
							To show something here, enable sound in the floating options window and
							turn up the sound.
						</Alert>
					</Container>
				)}

				<TableContainer component={CustomContainer}>
					<Table
						style={{
							tableLayout: "fixed",
						}}
					>
						<TableHead>
							<TableRow>
								<TableCell />
								{this.state.notesGrid?.[0]?.map((_row, colIndex) => (
									<TableCell key={colIndex} align="center">
										<b>Col #{colIndex + 1}</b>
									</TableCell>
								))}
							</TableRow>
						</TableHead>
						<TableBody>
							{this.state.notesGrid?.map((row, rowIndex) => (
								<TableRow key={rowIndex}>
									<TableCell align="center">
										<b>Row #{rowIndex + 1}</b>
									</TableCell>
									{row.map((note, colIndex) => {
										const freqColor = synthesizeFreq(note);

										return (
											<TableCell
												key={colIndex}
												align="center"
												style={{
													color: (
														this.props.theme as Theme
													).palette.getContrastText(freqColor),
													backgroundColor: freqColor,
												}}
											>
												<b>{note}</b>
											</TableCell>
										);
									})}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			</Stack>
		);
	}
}

const WithThemeSoundGridVisualizer = React.forwardRef<SoundGridVisualizerRaw>((props, ref) => {
	const theme = useTheme();

	return <SoundGridVisualizerRaw theme={theme} ref={ref} />;
});

export const SoundGridVisualizer = WithThemeSoundGridVisualizer;

export default SoundGridVisualizer;
