use crate::{console_log, tagged_console_log, types::*};
use once_cell::sync::Lazy;
use rand::distributions::WeightedIndex;
use rand::prelude::*;

pub struct Pattern {
    pub name: Box<str>,
    pub weight: f32,
    pub cells: CellsMatrix2D,
}

impl Pattern {
    pub fn width(&self) -> usize {
        self.cells[0].len()
    }

    pub fn height(&self) -> usize {
        self.cells.len()
    }

    pub fn new(name: &str, weight: f32, pattern_proto: Vec<Vec<u8>>) -> Pattern {
        Pattern {
            name: name.into(),
            weight,
            cells: pattern_proto,
        }
    }
}

static PATTERNS: Lazy<Vec<Pattern>> = Lazy::new(|| {
    tagged_console_log("The following game of life entity templates will be used:\n");

    let patterns: Vec<Pattern> = [
        // blinker
        Pattern::new(
            "blinker",
            0.3,
            vec2d![[0, 0, 0], [1, 1, 1], [0, 0, 0]]
        ),
        // octagon
        Pattern::new(
            "octagon",
            0.4,
            vec2d![
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 1, 0, 0, 1, 0, 0],
                [0, 1, 0, 0, 0, 0, 1, 0],
                [1, 0, 0, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 0, 0, 1],
                [0, 1, 0, 0, 0, 0, 1, 0],
                [0, 0, 1, 0, 0, 1, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0]
            ],
        ),
        // beacon
        Pattern::new(
            "beacon",
            0.2,
            vec2d![[1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 1]],
        ),
        // pulsar
        Pattern::new(
            "pulsar",
            0.2,
            vec2d![
                [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0]
            ],
        ),
        // pentadecathlon
        Pattern::new(
            "pentadecathlon",
            0.2,
            vec2d![
                [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
                [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
                [0, 0, 1, 0, 0, 0, 0, 1, 0, 0]
            ],
        ),
        // unix
        Pattern::new(
            "unix",
            0.1,
            vec2d![
                [0, 1, 1, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0, 0, 0],
                [1, 0, 1, 0, 0, 0, 0, 0],
                [1, 0, 0, 1, 0, 0, 1, 1],
                [0, 0, 0, 0, 1, 0, 1, 1],
                [0, 0, 1, 1, 0, 0, 0, 0]
            ],
        ),
        // clock
        Pattern::new(
            "clock",
            0.1,
            vec2d![[0, 0, 1, 0], [1, 0, 1, 0], [0, 1, 0, 1], [0, 1, 0, 0]],
        ),
        // bipole
        Pattern::new(
            "bipole",
            0.2,
            vec2d![
                [1, 1, 0, 0, 0],
                [1, 0, 1, 0, 0],
                [0, 0, 0, 0, 0],
                [0, 0, 1, 0, 1],
                [0, 0, 0, 1, 1]
            ],
        ),
        // queen bee shuttle
        Pattern::new(
            "queen",
            0.15,
            vec2d![
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ],
        ),
        // tumbler
        Pattern::new(
            "tumbler",
            0.1,
            vec2d![
                [0, 1, 0, 0, 0, 0, 0, 1, 0],
                [1, 0, 1, 0, 0, 0, 1, 0, 1],
                [1, 0, 0, 1, 0, 1, 0, 0, 1],
                [0, 0, 1, 0, 0, 0, 1, 0, 0],
                [0, 0, 1, 1, 0, 1, 1, 0, 0]
            ],
        ),
    ]
    .iter()
    .map(|pattern: &Pattern| Pattern {
        name: pattern.name.to_owned(),
        weight: pattern.weight,
        cells: add_safety_border(&pattern),
    })
    .collect();

    for pattern in patterns.iter() {
        let mut log_string: String = "".to_owned();

        let name = &*pattern.name;
        log_string.push_str(format!("\t> {name}", name = name).as_str());
        log_string.push_str("\n\t  ");
        log_string.push_str("-".repeat(name.len()).as_str());
        log_string.push_str("\n");

        for row in &pattern.cells {
            let mut row_string: String = "".to_owned();
            
            row.iter().for_each(
                |cell| {
                    row_string.push_str(match (*cell).into() {
                        Cell::Dead => " ",
                        Cell::Alive => "⏺",
                        _ => " ",
                    });
                }
            );

            log_string.push_str(format!("\t\t{row}\n", row = row_string).as_str());
        }

        console_log(log_string.as_str());
    }

    patterns
});

static WEIGHTED_RANDOM_DISTRIBUTION: Lazy<WeightedIndex<f32>> = Lazy::new(|| {
    WeightedIndex::new(PATTERNS.iter().map(|pattern| pattern.weight)).unwrap()
});

fn add_safety_border(pattern: &Pattern) -> CellsMatrix2D {
    // first, add horizontal margins to all rows
    let padded_horizontally: CellsMatrix2D = pattern
        .cells
        .clone()
        .into_iter()
        .map(|row| {
            [Cell::Dead as u8]
                .iter()
                .chain(row.iter())
                .chain([Cell::Dead as u8].iter())
                .cloned()
                .collect()
        })
        .collect();

    let vertical_margin: Vec<u8> = (0..(pattern.width() + 2))
        .collect::<Vec<usize>>()
        .into_iter()
        .map(|_i| Cell::Dead as u8)
        .collect();
    /* then, stack vertically the following:
        - top margin
        - all original rows with horizontal margins
        - bottom margin
    */
    let mut padded_pattern = Vec::from([vertical_margin.clone()]);
    padded_pattern.extend(padded_horizontally);
    padded_pattern.push(vertical_margin.clone());

    padded_pattern
}

pub fn pick_random_weighted_pattern() -> &'static Pattern {
    &PATTERNS[WEIGHTED_RANDOM_DISTRIBUTION.sample(&mut rand::thread_rng())]
}
