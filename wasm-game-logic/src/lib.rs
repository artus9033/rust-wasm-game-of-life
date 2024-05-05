mod constants;
mod gol_patterns;
mod types;
mod utils;

use wasm_bindgen::prelude::*;

use gol_patterns::*;
use rand::Rng;
use std::{cell::RefCell, collections::HashMap};
use types::*;

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
    js_cells_instanced_mesh: RefCell<JsValue>,
    set_cells_im_matrix_color_at: js_sys::Function,
    cells_im_matrix_instance_color: JsValue,
    cell_color_lut: RefCell<JsValue>,
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
            js_cells_instanced_mesh: RefCell::new(JsValue::undefined()),
            set_cells_im_matrix_color_at: js_sys::Function::default(),
            cells_im_matrix_instance_color: JsValue::undefined(),
            cell_color_lut: RefCell::new(JsValue::undefined()), // update_cells: Function::default()
        };

        map.regenerate(num_cell_divisions_x, num_cell_divisions_y);

        map
    }

    pub fn regenerate(
        &mut self,
        num_cell_divisions_x: Option<usize>,
        num_cell_divisions_y: Option<usize>,
    ) {
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

        let mut generated_entities_stats: HashMap<Box<str>, usize> = PATTERNS
            .iter()
            .map(|pattern| (pattern.name.clone(), 1))
            .collect::<HashMap<_, _>>();
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
                                let index =
                                    self.get_index_for_coordinates(y + local_y, x + local_x);

                                self.map[index] = pattern.cells[local_y][local_x];
                            }
                        }

                        *generated_entities_stats.get_mut(&pattern.name).unwrap() += 1;
                    }
                }
            }
        }

        tagged_console_log("Map has been regenerated using the following entities:\n");

        for pattern in PATTERNS.iter() {
            let mut log_string: String = "".to_owned();

            let name = &*pattern.name;
            log_string.push_str(
                format!(
                    "\t> {name} ({count}x)",
                    name = name,
                    count = generated_entities_stats[&pattern.name]
                )
                .as_str(),
            );
            log_string.push_str("\n\t  ");
            log_string.push_str("-".repeat(name.len()).as_str());
            log_string.push_str("\n");

            for row in &pattern.cells {
                let mut row_string: String = "".to_owned();

                row.iter().for_each(|cell| {
                    row_string.push_str(match (*cell).into() {
                        Cell::Dead => " · ",
                        Cell::Alive => " ■ ",
                        _ => " ",
                    });
                });

                log_string.push_str(format!("\t\t{row}\n", row = row_string).as_str());
            }

            console_log(log_string.as_str());
        }
    }

    pub fn bind_js_cells_instanced_mesh(&mut self, js_mesh_ref: JsValue, cell_color_lut: JsValue) {
        self.js_cells_instanced_mesh = RefCell::new(js_mesh_ref);
        self.set_cells_im_matrix_color_at = js_sys::Reflect::get(
            &self.js_cells_instanced_mesh.borrow(),
            &JsValue::from_str("setColorAt"),
        )
        .unwrap()
        .into();
        self.cells_im_matrix_instance_color = js_sys::Reflect::get(
            &self.js_cells_instanced_mesh.borrow(),
            &JsValue::from_str("instanceColor"),
        )
        .unwrap();
        self.cell_color_lut = RefCell::new(cell_color_lut);
    }

    pub fn morph_map_next_round(&mut self) {
        self.previous_map.copy_from_slice(&self.map);
        let mut count: u128;

        for y in 0..self.height {
            for x in 0..self.width {
                let index = self.get_index_for_coordinates(y as usize, x as usize);

                count = 0; // reset the count for this loop
                let previous_cell = self.previous_map[index];

                for iy in utils::max(0i32, y as i32 - 1)
                    ..=utils::min(self.height as i32 - 1, y as i32 + 1)
                {
                    for ix in utils::max(0, x as i32 - 1)
                        ..=utils::min(self.width as i32 - 1, x as i32 + 1)
                    {
                        let iter_cell = self.previous_map[self.get_index_for_coordinates(iy as usize, ix as usize)];

                        if !(ix as usize == x && iy as usize == y) // check if this is not the currently processed cell
                            && iter_cell == Cell::Alive as u8
                        {
                            // count for GoL cell state update
                            count += 1;
                        }
                    }
                }

                // update the processed cell state
                let new_value = match (previous_cell.into(), count) {
                    (Cell::Alive, x) if x < 2 || x > 3 => Cell::Vanishing1,
                    (Cell::Alive, 2) | (Cell::Alive, 3) => Cell::Alive,
                    (cell, 3) if cell != Cell::Alive => Cell::Alive,
                    (Cell::Vanishing3, _) => Cell::Dead,
                    (Cell::Vanishing2, _) => Cell::Vanishing3,
                    (Cell::Vanishing1, _) => Cell::Vanishing2,
                    (other, _) => other,
                } as u8;
                self.map[index] = new_value;

                match self.set_cells_im_matrix_color_at.call2(&self.js_cells_instanced_mesh.borrow(), &JsValue::from(index), &js_sys::Reflect::get(&self.cell_color_lut.borrow(), &JsValue::from(new_value)).unwrap()) {
                    Ok(_) => (),
                    Err(_) => panic!("Error calling instancedMesh.setColorAt for index {index} and value {value}", index=index, value=new_value)
                }
            }
        }

        match js_sys::Reflect::set(
            &self.cells_im_matrix_instance_color,
            &JsValue::from_str("needsUpdate"),
            &JsValue::from(true),
        ) {
            Ok(_) => (),
            Err(_) => panic!("Error setting instancedMesh.instanceColor.needsUpdate"),
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
