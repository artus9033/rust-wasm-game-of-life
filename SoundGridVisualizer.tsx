import { boundMethod } from "autobind-decorator";
import React from "react";
import type { Frequency } from "tone/build/esm/core/type/Units";

import {
	Container,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Theme,
} from "@material-ui/core";
import { WithStyles, createStyles, withStyles } from "@material-ui/styles";

import { synthesizeFreq } from "./chromestesia";

const styles = createStyles({});

type SoundGridVisualizerProps = WithStyles<typeof styles, true>;

type SoundGridVisualizerState = {
	notesGrid: Array<Array<Frequency>> | null;
};

const CustomContainer = ({ children }: { children: React.ReactNode }) => (
	<Container>{children}</Container>
);

class SoundGridVisualizer extends React.Component<
	SoundGridVisualizerProps,
	SoundGridVisualizerState
> {
	state: SoundGridVisualizerState = {
		notesGrid: null,
	};

	@boundMethod
	public updateNotesGrid(newNotesGrid: Array<Array<Frequency>>) {
		this.setState({
			notesGrid: newNotesGrid,
		});
	}

	render() {
		return (
			<Stack>
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

export default withStyles(styles, { withTheme: true })(SoundGridVisualizer);
