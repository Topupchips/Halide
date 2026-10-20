# Halide

Halide is a browser darkroom: layers, brushes, selections, crop, type, and color, in one plate. It follows the working model of a desktop raster editor — tool rail, options, canvas, layers — and it is an original implementation. Adobe Photoshop was not decompiled, and none of its code or assets are included.

The interaction model was reconstructed the way [Reverse Engineer Anything](https://github.com/morluto/rea) describes a feature: watch what the tool does, then write a new version and check it. Photoshop itself was not on this machine, so the behavior comes from the public raster-editor workflow (marquees, blend modes, marching ants, clone source, crop, undo) rather than a binary.

## Run it

```bash
npm install
npm run dev
```

Open the URL Next prints. Create a plate, open an image, or load the studio still life.

```bash
npm test
npm run lint
```

## What you can do

- Paint, erase, clone, fill, and draw gradients and shapes
- Rectangular, elliptical, and freeform selections, including add and subtract
- Crop, flip, rotate, and resize
- Brightness, hue, levels, exposure, blur, sharpen, noise, pixelate, and vignette
- Layers with opacity, blend modes, lock, reorder, merge, and flatten
- Undo, redo, copy, paste, and export PNG, JPEG, or WebP

Keys follow the desktop set: `B` brush, `E` eraser, `V` move, `M` marquee, `C` crop, `[` `]` size, `Ctrl` or `⌘` `Z` undo. Press `?` inside the app for the full list.
