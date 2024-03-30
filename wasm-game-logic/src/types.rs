use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
    Vanishing1 = 2,
    Vanishing2 = 3,
    Vanishing3 = 4,
}

impl std::convert::Into<Cell> for u8 {
    fn into(self) -> Cell {
        match self {
            0 => Cell::Dead,
            1 => Cell::Alive,
            2 => Cell::Vanishing1,
            3 => Cell::Vanishing2,
            _ => Cell::Vanishing3,
        }
    }
}

pub type CellsPackedArr = Vec<u8>;
pub type CellsMatrix2D = Vec<Vec<u8>>;

#[macro_export]
macro_rules! vec2d {
    [$([$($d:expr), *]), *] => {vec![$(vec![$($d), *], )*]}
}

pub(crate) use vec2d;
