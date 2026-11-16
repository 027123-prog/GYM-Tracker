# Male Full Body Ecorche

Original model by **Diego Luján García** (diegoluga), released under
**Creative Commons Attribution 4.0 International (CC BY 4.0)**.

- Creator: https://sketchfab.com/diegoluga
- Original: https://sketchfab.com/3d-models/male-full-body-ecorche-ab11ebff89224f03bd75efede1164cf6
- License: https://creativecommons.org/licenses/by/4.0/ — full text in LICENSE.txt
- Public redistribution used to obtain the files without an account:
  https://github.com/TheMakerAL/virtual-human-muscle-anatomy-react-electron-threejs-app/tree/305de405134d449305e797fe4d30698230a92909/public/resources/gltf/body

The source GLTF embeds the original creator, license and exact model URL.
Source scene.bin Git blob SHA-1: 71b2f537687dcf821e8d82e030237b68f9042364.
Downloaded on 15 November 2026. No affiliation or endorsement is implied.

## HardGainWAF adaptations

- Normalized to a common 1.88-unit height with feet at zero, anterior +Z.
- Retained the sculpt, triangle detail, UV layout and baked normal-map fibers.
- Removed the exposed face and clipped the anatomy neck at 1.615 units.
  A separately credited neutral MakeHuman head (CC0) replaces it; see
  HEAD-ATTRIBUTION.md and HEAD-LICENSE.txt.
- Assigned connected muscle pieces to broader training regions. The fused
  upper/middle/lower chest, deltoid heads and trapezius subdivisions have
  illustrative soft color borders.
  Serratus slips receive their own training region. Covered lumbar spinal
  erectors and deep hip flexors use soft bilateral color projections on the
  existing surfaces. These projections are schematic, not dissected muscle
  geometry; no triangles or anatomical contours are added or reshaped.
- Converted the colored source textures to neutral/estimated-load display in
  the shader. Light tendon pixels within assigned muscles receive their muscle's
  tint for visual continuity; other support surfaces remain neutral in training
  mode. The separately credited MakeHuman neck has a soft bilateral posterior
  upper-trapezius color projection; its face, anterior neck and skull remain
  neutral. These color changes do not alter either sculpt.
- Resized source textures to at most 1024 pixels and compressed geometry with
  EXT_meshopt_compression. Maximum attribute rounding error is in the manifest.
- Generated fallback-front.png and fallback-back.png from this adapted figure.

The model, its source textures and these adapted model/render assets retain
CC BY 4.0. The separate MakeHuman contribution is CC0. Unrelated application
code and personal training data are not part of this model license.

Rebuild: node scripts/build-diego-anatomy.mjs <source-directory>
The source directory contains scene.gltf, scene.bin and textures/.
The pinned source, model checksum and region IDs are in diego-manifest.json.
