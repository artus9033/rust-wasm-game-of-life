use core::ops::Add;
use std::cmp::Ord;

pub fn min<T: Add<Output=T> + Default + Copy + Ord>(x: T, y: T) -> T {
    if x < y { x } else { y }
}

pub fn max<T: Add<Output=T> + Default + Copy + Ord>(x: T, y: T) -> T {
    if x > y { x } else { y }
}
