# Neutral human head — MakeHuman

The current `neutral-head.glb` is a modified MakeHuman asset, released under
**CC0 1.0 Universal**. Source license and full license text:

- https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- `HEAD-LICENSE.txt`

Source creators credited for transparency: MakeHuman Team, Data Collection AB,
Joel Palmius, Jonas Hauquier; the male-young target credits Manuel Bastioni
(original author, rights transferred to the team in 2016).

## Official sources

- Base mesh: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
- Male-young target: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/targets/macrodetails/caucasian-male-young.target
- Eyes: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/eyes/high-poly/high-poly.obj
- Eye fitting: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/eyes/high-poly/high-poly.mhclo

Each source header explicitly releases the asset under CC0. Only graphical
assets are used; no MakeHuman application code is included.

## Modifications

Applied the male-young shape; normalized the body reference to 1.88 m; extracted
head and neck with an exact cut at 1.60 m; subdivided the clean facial topology
once; fitted the original eyes through the supplied barycentric fitting table;
replaced all materials with one neutral gray sculpture material. No head
separate head-muscle groups or personal likeness.

The lower neck fits beneath the separately licensed anatomy body. The rear
outline widens toward the shoulder, with a shallow central groove. The front
edge follows the underside of the jaw. The anatomy builder uses this fitted
surface to shape the ends of the original trapezius. Both surfaces share a
neutral material gradient at the join. Training colors belong to the body.

Rebuild with:

```
node scripts/build-makehuman-head.mjs <base.obj> <male-young.target> <high-poly.obj> <high-poly.mhclo>
```

The source files are downloaded separately, not copied into the public build.
Source SHA-256:

- base.obj: `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`
- male-young.target: `70e228ba7164737dae664454394536fc5935fa48d333c1a97d77e2dc6eacc5f5`
- high-poly.obj: `da2493215b708a344c33dc72f2a9a5b8fa985dcc5a70ad3b208995cf871da8e1`
- high-poly.mhclo: `b183cfe37120ab726f9b3f2ea6cd3a64c44ce7b4bd91a77c841cf70c04f83a0d`

This asset replaces the earlier BodyParts3D/open-anatomy-3d head. The anatomy
body is separately licensed under CC BY 4.0. See README.txt and LICENSE.txt.
