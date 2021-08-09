use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
}

pub type CellsMatrix2D = Vec<Vec<Cell>>;

#[macro_export]
macro_rules! vec2d {
    [$([$($d:expr), *]), *] => {vec![$(vec![$($d), *], )*]}
}

pub(crate) use vec2d;
