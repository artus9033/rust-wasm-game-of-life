use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
    Vanishing = 2
}

impl std::convert::Into<Cell> for u8 {
    fn into(self) -> Cell {
        match self {
            1 => Cell::Alive,
            _ => Cell::Dead,
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
