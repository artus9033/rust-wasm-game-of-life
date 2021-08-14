mod constants;
mod gol_patterns;
mod types;
mod utils;

use wasm_bindgen::prelude::*;

use gol_patterns::*;
use types::*;

use rand::Rng;
use std::collections::HashMap;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

fn format_log(s: &str) -> String {
    let mut buffer = constants::LOG_TAG.to_owned();
    buffer.push_str(s);

    return buffer;
}

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn console_log(a: &str);
}

#[wasm_bindgen]
pub fn init() {
    if cfg!(feature = "debug") {
        // When the `console_error_panic_hook` feature is enabled, we can call the
        // `console_error_panic_hook` function at least once during initialization, and then
        // we will get better error messages if our code ever panics.
        //
        // For more details see
        // https://github.com/rustwasm/console_error_panic_hook#readme
        #[cfg(feature = "console_error_panic_hook")]
        console_error_panic_hook::set_once();

        console_log(&*format_log(
            "Running in debug mode - enabling console_error_panic_hook",
        ));
    } else {
        console_log(&*format_log(
            "Running in production mode with stripped std & no console_error_panic_hook",
        ));
    }
}

#[wasm_bindgen]
pub struct Map {
    pub width: usize,
    pub height: usize,
    map: CellsMatrix2D,
    previous_map: CellsMatrix2D,
}

#[wasm_bindgen]
impl Map {
    pub fn generate(
        map_width: usize,
        map_height: usize,
        num_cell_divisions_x: Option<usize>,
        num_cell_divisions_y: Option<usize>,
    ) -> Map {
        let mut rng = rand::thread_rng();

        let grid_cell_width = utils::max(
            1,
            (map_width as f32 / num_cell_divisions_x.unwrap_or(30) as f32).ceil() as usize,
        );
        let grid_cell_height = utils::max(
            1,
            (map_height as f32 / num_cell_divisions_y.unwrap_or(60) as f32).ceil() as usize,
        );
        let grid_cells_x = utils::max(
            1,
            (map_width as f32 / grid_cell_width as f32).floor() as usize,
        );
        let grid_cells_y = utils::max(
            1,
            (map_height as f32 / grid_cell_height as f32).floor() as usize,
        );

        let mut map: CellsMatrix2D =
            vec![vec![Cell::Dead; map_width as usize]; map_height as usize];

        let mut occupied_cell_indices: HashMap<(usize, usize), bool> = HashMap::new();
        for gx in 0..grid_cells_x {
            for gy in 0..grid_cells_y {
                if rng.gen::<f32>() <= 0.4 {
                    let pattern = pick_random_weighted_pattern();
                    let x = gx * grid_cell_width + rng.gen_range(0..=grid_cell_width);
                    let y = gy * grid_cell_height + rng.gen_range(0..=grid_cell_height);

                    let target_width = pattern.width();
                    let target_height = pattern.height();

                    let mut c_gx = gx;
                    let mut c_g_y = gy;

                    let mut can_be_placed_here = true;

                    // span horizontally
                    while (c_gx - gx + 1) * grid_cell_width < target_width {
                        c_gx += 1;

                        if c_gx > grid_cells_x {
                            can_be_placed_here = false;
                            break;
                        }
                    }

                    // span vertically
                    if can_be_placed_here {
                        while (c_g_y - gy + 1) * grid_cell_height < target_height {
                            c_g_y += 1;

                            if c_g_y > grid_cells_y {
                                can_be_placed_here = false;
                                break;
                            }
                        }
                    }

                    can_be_placed_here = can_be_placed_here
                        && x + target_width < map_width
                        && y + target_height < map_height;
                    if can_be_placed_here {
                        'gxLoop: for i_gx in gx..=c_gx {
                            for i_g_y in gy..=c_g_y {
                                if occupied_cell_indices.contains_key(&(i_g_y, i_gx))
                                    && occupied_cell_indices[&(i_g_y, i_gx)]
                                {
                                    can_be_placed_here = false;

                                    break 'gxLoop;
                                }
                            }
                        }
                    }

                    if can_be_placed_here {
                        for i_gx in gx..=c_gx {
                            for i_g_y in gy..=c_g_y {
                                occupied_cell_indices.insert((i_g_y, i_gx), true);
                            }
                        }

                        for local_x in 0..target_width {
                            for local_y in 0..target_height {
                                map[y + local_y][x + local_x] = pattern.pattern[local_y][local_x];
                            }
                        }
                    }
                }
            }
        }

        return Map {
            width: map_width,
            height: map_height,
            previous_map: map.clone(),
            map: map,
        };
    }

    pub fn get_cell(&self, x: usize, y: usize, from_previous_map: bool) -> Cell {
        return if from_previous_map {
            self.previous_map[y][x]
        } else {
            self.map[y][x]
        };
    }

    pub fn morph_map_next_round(&mut self) {
        self.previous_map = self.map.clone();
        let mut count: u128;

        for y in 0..self.height {
            for x in 0..self.width {
                count = 0; // reset the count for this loop
                let cell = self.get_cell(x as usize, y as usize, true);

                for iy in utils::max(0, (y - 1) as usize)
                    ..=utils::min((self.height - 1) as usize, (y + 1) as usize)
                {
                    for ix in utils::max(0, (x - 1) as usize)
                        ..=utils::min((self.width - 1) as usize, (x + 1) as usize)
                    {
                        if !(ix == x as usize && iy == y as usize)
                            && self.get_cell(ix, iy, true) == Cell::Alive
                        {
                            count += 1;
                        }
                    }
                }

                self.map[y as usize][x as usize] = match (cell, count) {
                    (Cell::Alive, x) if x < 2 => Cell::Dead,
                    (Cell::Alive, 2) | (Cell::Alive, 3) => Cell::Alive,
                    (Cell::Alive, x) if x > 3 => Cell::Dead,
                    (Cell::Dead, 3) => Cell::Alive,
                    (other, _) => other,
                };
            }
        }
    }

    pub fn current_map_subgrid_sum(
        &self,
        gx: usize,
        gy: usize,
        grid_size_x: usize,
        grid_size_y: usize,
    ) -> Option<u32> {
        let start_y = gy * grid_size_y;
        let start_x = gx * grid_size_x;

        let stop_y = utils::min((gy + 1) * grid_size_y, self.height - 1);
        let stop_x = utils::min((gx + 1) * grid_size_x, self.width - 1);

        return if stop_y <= start_y || stop_x <= start_x {
            None
        } else {
            Some(
                self.map[start_y..=stop_y]
                    .iter()
                    .map(|row| {
                        row[start_x..=stop_x]
                            .iter()
                            .map(|cell| *cell as u32)
                            .sum::<u32>()
                    })
                    .sum(),
            )
        };
    }
}
