# Rust WASM Game of Life logic

This package is a code extract from a part of [my website](https://artus9033.now.sh), as I wanted to share my implementation of [Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) logic in Rust that compiles to WASM using `wasm-pack`.

The submodule that can be plugged in to any React project. Particularly, this has one is used ina Next.js project. The dependencies here are omitted, as they should belong to the project's `package.json` and the purpose of this repository is solely to provide the implementation code. The main dependencies needed are:

-   `React`
-   `lodash`
-   `tone`
-   `THREE.js`
-   `@react-three/fiber`

## Why is this implementation special?

Firstly, this implementation defines the Three.js scene declaratively with React components, and uses hooks to run timers, updates, etc.

Secondly, it provides a polyphonic sound synthesization algorithm that plays background music generated based on the current contents of the map (universe).

Lastly, this implementation features a dynamic, weighted-pseudorandom map (universe) generation for a specified canvas size - everything in Rust.

## How does this work?

Everything is described on [the GoL page on my website](https://artus9033.now.sh/game-of-life).

## License

This code is provided under the MIT License, see [LICENSE](./LICENSE).
