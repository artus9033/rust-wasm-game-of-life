use crate::types::*;
use once_cell::sync::Lazy;
use rand::distributions::WeightedIndex;
use rand::prelude::*;

pub struct Pattern {
    weight: f32,
    pub pattern: CellsMatrix2D,
}

impl Pattern {
    pub fn width(&self) -> usize {
        return self.pattern[0].len();
    }

    pub fn height(&self) -> usize {
        return self.pattern.len();
    }

    pub fn new(weight: f32, pattern_proto: Vec<Vec<u8>>) -> Pattern {
        return Pattern {
            weight: weight,
            pattern: pattern_proto
                .iter()
                .map(|row: &Vec<u8>| {
                    row.iter()
                        .map(|c| {
                            if *c == 1 {
                                Cell::Alive.into()
                            } else {
                                Cell::Dead.into()
                            }
                        })
                        .collect()
                })
                .collect(),
        };
    }
}

static PATTERNS: Lazy<Vec<Pattern>> = Lazy::new(|| {
    return [
        // blinker
        Pattern::new(0.3, vec2d![[0, 0, 0], [1, 1, 1], [0, 0, 0]]),
        // octagon
        Pattern::new(
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
            0.2,
            vec2d![[1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 1]],
        ),
        // pulsar
        Pattern::new(
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
            0.2,
            vec2d![
                [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
                [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
                [0, 0, 1, 0, 0, 0, 0, 1, 0, 0]
            ],
        ),
        // unix
        Pattern::new(
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
            0.1,
            vec2d![[0, 0, 1, 0], [1, 0, 1, 0], [0, 1, 0, 1], [0, 1, 0, 0]],
        ),
        // bipole
        Pattern::new(
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
        weight: pattern.weight,
        pattern: add_safety_border(&pattern),
    })
    .collect();
});

static WEIGHTED_RANDOM_DISTRIBUTION: Lazy<WeightedIndex<f32>> = Lazy::new(|| {
    return WeightedIndex::new(PATTERNS.iter().map(|pattern| pattern.weight)).unwrap();
});

fn add_safety_border(pattern: &Pattern) -> CellsMatrix2D {
    // first, add horizontal margins to all rows
    let padded_horizontally: CellsMatrix2D = pattern
        .pattern
        .clone()
        .into_iter()
        .map(|row| {
            [Cell::Dead]
                .iter()
                .chain(row.iter())
                .chain([Cell::Dead].iter())
                .cloned()
                .collect()
        })
        .collect();

    let vertical_margin: Vec<Cell> = (0..(pattern.width() + 2))
        .collect::<Vec<usize>>()
        .into_iter()
        .map(|_i| Cell::Dead)
        .collect();
    /* then, stack vertically the following:
        - top margin
        - all original rows with horizontal margins
        - bottom margin
    */
    let mut padded_pattern = Vec::from([vertical_margin.clone()]);
    padded_pattern.extend(padded_horizontally);
    padded_pattern.push(vertical_margin);

    return padded_pattern;
}

pub fn pick_random_weighted_pattern() -> &'static Pattern {
    let mut rng = rand::thread_rng();
    return &PATTERNS[WEIGHTED_RANDOM_DISTRIBUTION.sample(&mut rng)];
}
