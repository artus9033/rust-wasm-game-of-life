mod constants;
mod gol_patterns;
mod types;
mod utils;

use wasm_bindgen::prelude::*;

use gol_patterns::*;
use types::*;

use rand::Rng;
use std::collections::HashMap;

fn tagged_console_log(s: &str) -> String {
    let mut buffer = constants::LOG_TAG.to_owned();
    buffer.push_str(s);

    buffer
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

        console_log(&*tagged_console_log(
            "Running in debug mode - enabling console_error_panic_hook",
        ));
    } else {
        console_log(&*tagged_console_log(
            "Running in production mode with stripped std & no console_error_panic_hook",
        ));
    }
}

#[wasm_bindgen]
pub struct Map {
    pub width: usize,
    pub height: usize,
    map: CellsPackedArr,
    previous_map: CellsPackedArr,
}

#[wasm_bindgen]
impl Map {
    pub fn get_index_for_coordinates(&self, row: usize, col: usize) -> usize {
        self.width * row + col
    }

    pub fn new(
        map_width: usize,
        map_height: usize,
        num_cell_divisions_x: Option<usize>,
        num_cell_divisions_y: Option<usize>,
    ) -> Map {
        let size = map_width * map_height;
        let mut map_cells = Vec::with_capacity(size);
        map_cells.resize(size, Cell::Dead as u8);

        let mut map = Map {
            width: map_width,
            height: map_height,
            previous_map: map_cells.clone(),
            map: map_cells.clone(),
        };

        map.regenerate(num_cell_divisions_x, num_cell_divisions_y);

        map
    }

    pub fn regenerate(&mut self, num_cell_divisions_x: Option<usize>, num_cell_divisions_y: Option<usize>) {
        let mut rng = rand::thread_rng();

        let grid_cell_width = utils::max(
            1,
            (self.width as f32 / num_cell_divisions_x.unwrap_or(30) as f32).ceil() as usize,
        );
        let grid_cell_height = utils::max(
            1,
            (self.height as f32 / num_cell_divisions_y.unwrap_or(60) as f32).ceil() as usize,
        );
        let grid_cells_x = utils::max(
            1,
            (self.width as f32 / grid_cell_width as f32).floor() as usize,
        );
        let grid_cells_y = utils::max(
            1,
            (self.height as f32 / grid_cell_height as f32).floor() as usize,
        );

        self.map.fill(Cell::Dead as u8);

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
                    let mut c_gy = gy;

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
                        while (c_gy - gy + 1) * grid_cell_height < target_height {
                            c_gy += 1;

                            if c_gy > grid_cells_y {
                                can_be_placed_here = false;
                                break;
                            }
                        }
                    }

                    can_be_placed_here = can_be_placed_here
                        && x + target_width < self.width
                        && y + target_height < self.height;
                    if can_be_placed_here {
                        'gxLoop: for i_gx in gx..=c_gx {
                            for i_g_y in gy..=c_gy {
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
                            for i_g_y in gy..=c_gy {
                                occupied_cell_indices.insert((i_g_y, i_gx), true);
                            }
                        }

                        for local_x in 0..target_width {
                            for local_y in 0..target_height {
                                let index = self.get_index_for_coordinates(y + local_y, x + local_x);

                                self.map[index] = pattern.cells[local_y][local_x];
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn morph_map_next_round(&mut self) {
        self.previous_map.copy_from_slice(&self.map);
        let mut count: u128;

        for y in 0..self.height {
            for x in 0..self.width {
                let index = self.get_index_for_coordinates(y as usize, x as usize);

                count = 0; // reset the count for this loop
                let previous_cell = self.previous_map[index];

                for iy in utils::max(0, (y - 1) as usize)
                    ..=utils::min((self.height - 1) as usize, (y + 1) as usize)
                {
                    for ix in utils::max(0, (x - 1) as usize)
                        ..=utils::min((self.width - 1) as usize, (x + 1) as usize)
                    {
                        let iter_cell = self.previous_map[self.get_index_for_coordinates(iy, ix)];

                        if !(ix == x as usize && iy == y as usize) // check if this is not the currently processed cell
                            && iter_cell == Cell::Alive as u8
                        {
                            // count for GoL cell state update
                            count += 1;
                        }
                    }
                }

                // update the processed cell state
                self.map[index] = match (previous_cell.into(), count) {
                    (Cell::Alive, x) if x < 2 => Cell::Vanishing,
                    (Cell::Alive, 2) | (Cell::Alive, 3) => Cell::Alive,
                    (Cell::Alive, x) if x > 3 => Cell::Vanishing,
                    (Cell::Dead, 3) => Cell::Alive,
                    (Cell::Vanishing, _) => Cell::Dead,
                    (other, _) => other,
                } as u8;
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
            let mut sum = 0u32;

            for iy in start_y..=stop_y {
                for ix in start_x..=stop_x {
                    sum += self.map[self.get_index_for_coordinates(iy, ix)] as u32
                }
            }

            Some(sum)
        };
    }

    pub fn get_map_ptr(&self) -> *const u8 {
        self.map.as_ptr()
    }
}
