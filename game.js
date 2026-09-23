const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");

const screenW = canvas.width || 160;
const screenH = canvas.height || 120;
canvas.width = screenW;
canvas.height = screenH;

const imgData = ctx.createImageData(screenW, screenH);
// Create a 32-bit View into the pixel buffer
const pixels = new Uint32Array(imgData.data.buffer);


const Con = {
    Walk: { U: false, D: false, L: false, R: false },
    Turn: { U: false, D: false, L: false, R: false },
    Other: { A: false, B: false }
};

const keys = {};

window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

function updateControls() {
    Con.Walk.U = keys["KeyW"] || false;
    Con.Walk.D = keys["KeyS"] || false;
    Con.Walk.L = keys["KeyA"] || false;
    Con.Walk.R = keys["KeyD"] || false;

    Con.Turn.U = keys["ArrowUp"] || false;
    Con.Turn.D = keys["ArrowDown"] || false;
    Con.Turn.L = keys["ArrowLeft"] || false;
    Con.Turn.R = keys["ArrowRight"] || false;

    Con.Other.A = keys["Space"] || keys["KeyZ"] || keys["KeyQ"] || false;
    Con.Other.B = keys["KeyX"] || keys["KeyE"] || keys["Enter"] || false;
}

// 2. Remove TypeScript types (voxels: number[] -> voxels)
const sizeX = 18;
const sizeY = 18;
const sizeZ = 18;

const X = sizeX;
const XY = X * sizeY;
const XYZ = XY * sizeZ;

let voxels = [];
let texData = [];
const texW = [];
const texH = [];
const texDisp = [];


function hitboxDirT(
    ax, ay, az,
    bx, by, bz,
    dx, dy, dz
) {

    let tx = 1
    let ty = 1
    let tz = 1

    let hitMask = 0

    let curAx = ax
    let curAy = ay
    let curAz = az
    let curBx = bx
    let curBy = by
    let curBz = bz

    const EPS = 0.001

    // --- X movement ---
    if (dx !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, dx, 0, 0)
        if (t < 1) {
            hitMask |= 1
            // back off a tiny bit so we don't end up exactly on the face
            const mag = Math.abs(dx)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        tx = t
        curAx += dx * t
        curBx += dx * t
    }

    // --- Y movement ---
    if (dy !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, 0, dy, 0)
        if (t < 1) {
            hitMask |= 2
            const mag = Math.abs(dy)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        ty = t
        curAy += dy * t
        curBy += dy * t
    }

    // --- Z movement ---
    if (dz !== 0) {
        let t = sweepAABB(curAx, curAy, curAz, curBx, curBy, curBz, 0, 0, dz)
        if (t < 1) {
            hitMask |= 4
            const mag = Math.abs(dz)
            if (mag > 0) t = Math.max(0, t - EPS / mag)
        }
        tz = t
        curAz += dz * t
        curBz += dz * t
    }

    return [tx, ty, tz, hitMask]
}



function sweepAABB(
    ax, ay, az,
    bx, by, bz,
    dx, dy, dz
) {

    // Swept AABB bounds
    let minX = ax < ax + dx ? ax : ax + dx
    let maxX = bx > bx + dx ? bx : bx + dx
    let minY = ay < ay + dy ? ay : ay + dy
    let maxY = by > by + dy ? by : by + dy
    let minZ = az < az + dz ? az : az + dz
    let maxZ = bz > bz + dz ? bz : bz + dz

    // Clamp to world
    if (minX < 0) minX = 0
    if (minY < 0) minY = 0
    if (minZ < 0) minZ = 0

    let minXi = Math.floor(minX)
    let minYi = Math.floor(minY)
    let minZi = Math.floor(minZ)

    let maxXi = Math.ceil(maxX)
    let maxYi = Math.ceil(maxY)
    let maxZi = Math.ceil(maxZ)

    if (maxXi > sizeX) maxXi = sizeX
    if (maxYi > sizeY) maxYi = sizeY
    if (maxZi > sizeZ) maxZi = sizeZ

    let smallestT = 1

    // Loop voxels
    for (let z = minZi; z < maxZi; z++) {
        const base = z * XY
        for (let y = minYi; y < maxYi; y++) {
            const i = base + y * X
            for (let x = minXi; x < maxXi; x++) {

                const idx = i + x
                if (voxels[idx] === 0) continue

                // Inline slab test
                let tEnter = 0
                let tExit = 1

                // X
                if (dx > 0) {
                    const t1 = (x - bx) / dx
                    const t2 = (x + 1 - ax) / dx
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dx < 0) {
                    const t1 = (x + 1 - ax) / dx
                    const t2 = (x - bx) / dx
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (bx <= x || ax >= x + 1) continue
                }

                // Y
                if (dy > 0) {
                    const t1 = (y - by) / dy
                    const t2 = (y + 1 - ay) / dy
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dy < 0) {
                    const t1 = (y + 1 - ay) / dy
                    const t2 = (y - by) / dy
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (by <= y || ay >= y + 1) continue
                }

                // Z
                if (dz > 0) {
                    const t1 = (z - bz) / dz
                    const t2 = (z + 1 - az) / dz
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else if (dz < 0) {
                    const t1 = (z + 1 - az) / dz
                    const t2 = (z - bz) / dz
                    if (t1 > tEnter) tEnter = t1
                    if (t2 < tExit) tExit = t2
                } else {
                    if (bz <= z || az >= z + 1) continue
                }

                if (tEnter <= tExit && tEnter >= 0 && tEnter < smallestT) {
                    smallestT = tEnter
                    if (smallestT <= 0) return 0
                }
            }
        }
    }

    return smallestT
}

const slices = [
    [
        "fffffffffffggggggg",
        "aaaaaaaaaaafccaaba",
        "aaaaaaaaaaaacaaaba",
        "cccccccaaaacaaaaba",
        "aaaaaaaaaacaaacaba",
        "aaaaaaaaaaaaaffcca",
        "aaaaaaaaaaaaacaffa",
        "aaaaaaaaaaaaacaaaa",
        "aaaaaaaaaaaaacaaaa",
        "caaacccaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "cccaaacaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "fffffffffffggggggg",
        "abcccbaaaaafcaaaaa",
        "abcacbaaaaacccccca",
        "cbcccbcaaaacfcaaca",
        "acccccaaaaacagcaca",
        "aaaaaaaaaaacaffccc",
        "aaaaaaaaaaacacafff",
        "aaaaaaaaaacaacaaaa",
        "aaaaaaaaacaaacaaaa",
        "caaccaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaccaacaaaaaaaaaaa",
        "aaaaaaaaacaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "fffffffffffggggggg",
        "aceaacaaaaafcaaaaa",
        "acaaacaaaaaagcaaaa",
        "ccaaaccaaaaagcaaaa",
        "acccccaaaaaafccaaa",
        "aacccaaaaaaacffccc",
        "aaaaaaaaaaaacaafff",
        "aaaaaaaaaaaacaaaaa",
        "aaaaaaaaaaaacaaaaa",
        "ccacaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaacaccaaaaaaaaaaa",
        "aaaaaaaaaaaacaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffgggggg",
        "acaaaaaaaaaagcaaac",
        "aaaaaaaaaaaafcaaaa",
        "ccaaaccaaaaaagcaaa",
        "acccccaaaaaaafccaa",
        "aacccaaaaaaaaaffcc",
        "aaabaaaaaaaaaaaaff",
        "aaabaaaaaaaaaaaaaa",
        "aaabaaaaaaaaaaaaaa",
        "accbccaaaaaaaaaaaa",
        "aaabaaaaaaaaaaaaaa",
        "aaabaaaaaaaaaaaaaa",
        "aaabaaaaaaaaaaaaaa",
        "accbccaaaaaaaaaaaa",
        "aaaaaaaaaaaaaacaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffgggggg",
        "acdaacaaaaaagcccaa",
        "acaaacaaaaaafgccaa",
        "ccaaaccaaaaaaggcca",
        "acccccaaaaaaafffcc",
        "aacccaaaaaaaaaaaff",
        "aaaaaaaaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaacaccaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "ccacaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "fffffffffffffggggg",
        "abcccbaaaaaaagggcc",
        "abcacbaaaaaaaffgcc",
        "cbcccbcaaaaaaaaggc",
        "acccccaaaaaaaaafff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaccaacaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "caaccaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaca",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffgg",
        "aaaaaaaaaaaaaaaagg",
        "aaaaaaaaaaaaaaaagg",
        "cccccccaaaaaaaaaff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaac",
        "cccaaacaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "caaacccaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaac",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaca",
        "aaahhhaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aahhhhhaaaaaaaaaaa",
        "aahhhhhaaaaaaaahhh",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aahhhhhaaaaaaaaaaa",
        "aahhhhhaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaacaaaaaaaaaaaaa",
        "aahhaahaaaaaaaaaaa",
        "aahaaahaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaahaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaabaaaaaaaaaaaaa",
        "aaaabaaaaaaaaaaaaa",
        "aahhbhhaaaaaaaaaaa",
        "aahhbhhaaaaaaahhhh",
        "aaaabaaaaaaaaaahhh",
        "aaaabaaaaaaaaaaaha",
        "aaaabaaaaaaaaaaaaa",
        "aahhbhhaaaaaaaaaaa",
        "aahhbhhaaaaaaaaaaa",
        "aaacbaaaaaaaaaaaaa",
        "aaaabaaaaaaaaaaaaa",
        "aaaabcaaaaaaaaaaaa",
        "aaaabaaaaaaaaaaaaa",
        "aahhbahaaaaaaaaaaa",
        "aahhhahaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahihaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaba",
        "aaaaaaaaaaaaaaaaba",
        "aahhhhhaaaaaaaaaba",
        "aahhhhhaaaaaaahhbh",
        "aaaaaaaaaaaaaaahhh",
        "aaaaaaaaaaaaaaahhh",
        "aaaaaaaaaaaaaaaaaa",
        "aahhhhhaaaaaaaaaaa",
        "aahhhhhaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaacaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aahhaahaaaaaaaaaaa",
        "aahhhhhaaaaaaaacaa",
        "aaaahaaaaaaaaaaaaa",
        "aaaahaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahhhaaaaaaaahhhh",
        "aaaaaaaaaaaaaaahha",
        "aaaaaaaaaaaaaaaaha",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaahhhaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaacaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaahhh",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaacaaaa",
        "aaaaaaaaaacaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaacccccccccccaaa",
        "aaaaaacacacacaaaaa",
        "aaaaaacccccccaaaaa",
        "aaaaaaaacacaaaaaaa",
        "aaaaaaaacccaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
    [
        "ffffffffffffffffff",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
        "aaaaaaaaaaaaaaaaaa",
    ],
]

// format: width height data
const textures = [
    // a - air
    ["", "", "", "", "", "", "a" // yes this does work
    ], [ // b - oak log
        "ppfeedfedfeeeeeeedfeeffdfedfedfefdfeefedfedfeefefdefefeefedfedfdfeefeeeeeeefedfdfeeeeedeeeefedfefeeefedeefdfeffefeedfedfdfdfefeefeedfedfefefdfeefeedfeedfeefdfedfefefeedfefedfedfdfefeedfdfedfedfdfdfeedfefedfeefdfeeeeefeeeefeddffedfeeffdedfeefeeeefeeefeeefeee",
        "ppfeedfedfeeeeeeedfeeffdfedfedfefdfeefedfedfeefefdefefeefedfedfdfeefeeeeeeefedfdfeeeeedeeeefedfefeeefedeefdfeffefeedfedfdfdfefeefeedfedfefefdfeefeedfeedfeefdfedfefefeedfefedfedfdfefeedfdfedfedfdfdfeedfefedfeefdfeeeeefeeeefeddffedfeeffdedfeefeeeefeeefeeefeee",
        "ppeefeeefffeefeeeeeddddddddddddddefdbbbbbbbbbbbbdeedbddddddddddbdffdbddddddddddbdefdbddbbbbbbddbdefdbddbddddbddbdffdbddbddddbddbdeedbddbddddbddbdeedbddbddddbddbdeedbddbbbbbbddbdefdbddddddddddbdefdbddddddddddbdffdbbbbbbbbbbbbdffddddddddddddddeeefeeefeeeeeffff",
        "ppeefeeefffeefeeeeeddddddddddddddefdbbbbbbbbbbbbdeedbddddddddddbdffdbddddddddddbdefdbddbbbbbbddbdefdbddbddddbddbdffdbddbddddbddbdeedbddbddddbddbdeedbddbddddbddbdeedbddbbbbbbddbdefdbddddddddddbdefdbddddddddddbdffdbbbbbbbbbbbbdffddddddddddddddeeefeeefeeeeeffff",
        "ppfeedfedfeeeeeeedfeeffdfedfedfefdfeefedfedfeefefdefefeefedfedfdfeefeeeeeeefedfdfeeeeedeeeefedfefeeefedeefdfeffefeedfedfdfdfefeefeedfedfefefdfeefeedfeedfeefdfedfefefeedfefedfedfdfefeedfdfedfedfdfdfeedfefedfeefdfeeeeefeeeefeddffedfeeffdedfeefeeeefeeefeeefeee",
        "ppfeedfedfeeeeeeedfeeffdfedfedfefdfeefedfedfeefefdefefeefedfedfdfeefeeeeeeefedfdfeeeeedeeeefedfefeeefedeefdfeffefeedfedfdfdfefeefeedfedfefefdfeefeedfeedfeefdfedfefefeedfefedfedfdfefeedfdfedfedfdfdfeedfefedfeefdfeeeeefeeeefeddffedfeeffdedfeefeeeefeeefeeefeee",
        "a"
    ], [ // c - oak plank
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "a"
    ], [ // d - crafting table
        "ppfddddeeeeeeddddffdddddeeeedddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddededffddedddeeddeeedffddedddeedd111dffeeeeeeeeee111effddedddeedd111dffd111ddeeddd11dffd111ddeeddd11dffeeeeeeeeeeee1effddddddeedddd1dffddddddeeddddddffddddddeeddddddffeeeeeeeeeeeeeef",
        "ppfddddeeeeeeddddffdddddeeeedddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddededffddedddeeddeeedffddedddeedd111dffeeeeeeeeee111effddedddeedd111dffd111ddeeddd11dffd111ddeeddd11dffeeeeeeeeeeee1effddddddeedddd1dffddddddeeddddddffddddddeeddddddffeeeeeeeeeeeeeef",
        "ppdddddddddddddddddddeddddddddddddddddddddedddddddeeeeeeeeeeeeeeeedddddddddddeddddddedddddddddddddddddddddddedddddeeeeeeeeeeeeeeeedddddedddddddddddddddddddddeddddddddddddddddddddeeeeeeeeeeeeeeeedddddddddeddddddddedddddddddddddddddddddddddddddeeeeeeeeeeeeeeee",
        "ppffffeeeeeeeefffffdde44444444eddffde4444444444edffe4eeeeeeeeee4efe44e44e44e44e44ee44e44e44e44e44ee44eeeeeeeeee44ee44e44e44e44e44ee44e44e44e44e44ee44eeeeeeeeee44ee44e44e44e44e44ee44e44e44e44e44efe4eeeeeeeeee4effde4444444444edffdde44444444eddfffffeeeeeeeeffff",
        "ppfddddeeeeeeddddffdddddeeeedddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddddddffddededeeddddddffddededeeddddddffeee1eeeeeeeeeeffdd1d1deeddddddffdd1d1deeddddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddddddffddddddeeddddddffddddddeeddddddffeeeeeeeeeeeeeef",
        "ppfddddeeeeeeddddffdddddeeeedddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddddddffddededeeddddddffddededeeddddddffeee1eeeeeeeeeeffdd1d1deeddddddffdd1d1deeddddddffddddddeeddddddffeeeeeeeeeeeeeeffddddddeeddddddffddddddeeddddddffddddddeeddddddffeeeeeeeeeeeeeef",
        "c"
    ], [ // e - furnace
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111fffffffffffffffff",
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111fffffffffffffffff",
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbfffffffffffffffff",
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbfffffffffffffffff",
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111ff11111111111111fffffffffffffffff",
        "ppfffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbffffffffbbbffbbffffffffffbbffbbffffffffffbbffbbffffffffffbbffbbbbbbbbbbbbbbffffffffffffffffffbbbbbbbbbbbbbbffbbbbbbbbbbbbbbffbbbffffffffbbbffbbffffffffffbbffbbffffffffffbbffbbffffffffffbbfffffffffffffffff",
        "a"
    ], [ // f - grass block
        "pp777777777777777777777e77777777777e777e7e7777e77eecee7eee7e7eeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "pp777777777777777777777e77777777777e777e7e7777e77eecee7eee7e7eeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "pp7767767677766776767777777776766776766677777767777677777677676777777777677777776677777777676776777777677766777776667777767767677777777777777666777776677767677767777777767777667667777666766777777777776777777777777677777677767777777776777677776766777677776767",
        "pp777777777777777777777e77777777777e777e7e7777e77eecee7eee7e7eeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "pp777777777777777777777e77777777777e777e7e7777e77eecee7eee7e7eeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "a"
    ], [ // g - dirt block
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "ppeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeeeceeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeebeeeeeeeee",
        "a"
    ], [ // h - oak leaves
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "pp7077600070000607707706006607760600706770776770777700077077677077777007607700607777706760670660070706007700666066700706770776006677677677007007707666707070006070600606607700700070770000076700677077077060670067706707606000077060066600077707067770070670700067",
        "a"
    ], [ // i - finish
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "hh2222222224444442245555422451154224511542245555422444444222222222",
        "a"
    ]
]

function hexToNum(c) {
    const code = c.charCodeAt(0);

    // '0'–'9'
    if (code <= 57) return code - 48;

    // 'A'–'F'
    if (code <= 70) return code - 55;

    // 'a'–'f'
    return code - 87;
}

const charToIndex = []

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.?"
const BASE = chars.length; // 86


const traceRayReturn = [0, 0, 0, 0, 0, 0, 0, 0]
const traceRayNoReturn = [-1]
let renderX = 0
let renderY = 0
let renderZ = 0
const rayBoxIntersectionReturn = [0, 0]
let aabbHitsSolidReturn = [0,0,0]
const fVec = [0, 0, 0]
const rVec = [0, 0, 0]
const uVec = [0, 0, 0]
let sxTable = []
let syTable = []



function varsInit() {
    for (let i = 0; i < chars.length; ++i) {
        charToIndex[chars.charCodeAt(i)] = i
    }

    for (let t = 0; t < textures.length; ++t) {
        texData[t] = []
        for (let f = 5; f >= 0; --f) {
            const row = textures[t][f]
            texData[t][5 - f] = []   // keep output in normal order
            const len = row.length - 2
            for (let i = 0; i < len; i++) {
                texData[t][5 - f][i] = hexToNum(row[row.length - 1 - i])
            }
        }
    }

    for (let v = 0; v < textures.length; ++v) {
        for (let f = 0; f < 6; ++f) {
            const row = textures[v][f]
            const w = charToIndex[row.charCodeAt(0)]
            const h = charToIndex[row.charCodeAt(1)]
            texW.push(w)
            texH.push(h)
        }
        const row = textures[v][6]
        const char = row.charCodeAt(0)
        const disp = charToIndex[char]
        texDisp.push(disp)
    }
        

    
    for (let z = 0; z < sizeZ; ++z)
        for (let y = 0; y < sizeY; ++y)
            for (let x = 0; x < sizeX; ++x)
                voxels[x + y * sizeX + z * XY] = charToIndex[slices[z][y].charCodeAt(x)]

    for (let x = 0; x < screenW; x++) {
        sxTable[x] = (x / screenW) * 2 - 1
    }
    for (let y = 0; y < screenH; y++) {
        syTable[screenH - y - 1] = (y / screenH) * 2 - 1
    }
}

function rayBoxIntersection(
    ox, oy, oz,
    dx, dy, dz,
    minX, minY, minZ,
    maxX, maxY, maxZ
) {

    let tmin = -Infinity
    let tmax = Infinity

    // X slab
    if (dx !== 0) {
        let tx1 = (minX - ox) / dx
        let tx2 = (maxX - ox) / dx
        if (tx1 > tx2) { let t = tx1; tx1 = tx2; tx2 = t }
        if (tx1 > tmin) tmin = tx1
        if (tx2 < tmax) tmax = tx2
        if (tmax < tmin) return null
    } else if (ox < minX || ox > maxX) {
        return null
    }

    // Y slab
    if (dy !== 0) {
        let ty1 = (minY - oy) / dy
        let ty2 = (maxY - oy) / dy
        if (ty1 > ty2) { let t = ty1; ty1 = ty2; ty2 = t }
        if (ty1 > tmin) tmin = ty1
        if (ty2 < tmax) tmax = ty2
        if (tmax < tmin) return null
    } else if (oy < minY || oy > maxY) {
        return null
    }

    // Z slab
    if (dz !== 0) {
        let tz1 = (minZ - oz) / dz
        let tz2 = (maxZ - oz) / dz
        if (tz1 > tz2) { let t = tz1; tz1 = tz2; tz2 = t }
        if (tz1 > tmin) tmin = tz1
        if (tz2 < tmax) tmax = tz2
        if (tmax < tmin) return null
    } else if (oz < minZ || oz > maxZ) {
        return null
    }

    // return as [tEntry, tExit] to avoid object allocation
    rayBoxIntersectionReturn[0] = tmin
    rayBoxIntersectionReturn[1] = tmax
    return rayBoxIntersectionReturn
}

function computeHitUV(
    dist,
    x, y, z,
    ox, oy, oz,
    dx, dy, dz,
    face, voxelType
) {

    // Compute exact hit point
    const hx = ox + dx * dist
    const hy = oy + dy * dist
    const hz = oz + dz * dist

    let u = 0
    let v = 0

    switch (face) {
        case 0: // -X
        case 1: // +X
            u = hz - z
            v = hy - y
            break

        case 2: // -Y
        case 3: // +Y
            u = hx - x
            v = hz - z
            break

        case 4: // -Z
        case 5: // +Z
            u = hx - x
            v = hy - y
            break
    }

    // Clamp to [0,1]
    if (u < 0) u = 0
    if (u > 1) u = 1
    if (v < 0) v = 0
    if (v > 1) v = 1

    traceRayReturn[0] = face
    traceRayReturn[1] = dist
    traceRayReturn[2] = u
    traceRayReturn[3] = v
    traceRayReturn[4] = voxelType
    traceRayReturn[5] = x
    traceRayReturn[6] = y
    traceRayReturn[7] = z

    return traceRayReturn
}

function traceRay(
    ox, oy, oz,
    dx, dy, dz,
    maxDist
) {

    // --- 1. Slab intersection (fast reject) ---
    const slab = rayBoxIntersection(
        ox, oy, oz,
        dx, dy, dz,
        0, 0, 0,
        sizeX, sizeY, sizeZ
    )
    if (!slab) return traceRayNoReturn

    const tEntry = slab[0]
    const tExit = slab[1]

    if (tExit < 0) return traceRayNoReturn

    const startT = tEntry > 0 ? tEntry : 0
    const limitT = tExit < maxDist ? tExit : maxDist
    if (startT > limitT) return traceRayNoReturn

    const oX = ox
    const oY = oy
    const oZ = oz

    // --- 2. Move origin to entry point ---
    ox += dx * startT
    oy += dy * startT
    oz += dz * startT

    // --- 3. Compute starting voxel ---
    let x = ox | 0
    let an = ox - x
    if ((an < 0 ? -an : an) < 1e-12 && dx < 0) x--
    let y = oy | 0
    an = oy - y
    if ((an < 0 ? -an : an) < 1e-12 && dy < 0) y--
    let z = oz | 0
    an = oz - z
    if ((an < 0 ? -an : an) < 1e-12 && dz < 0) z--

    if (x < 0) x = 0
    if (y < 0) y = 0
    if (z < 0) z = 0
    if (x >= sizeX) x = sizeX - 1
    if (y >= sizeY) y = sizeY - 1
    if (z >= sizeZ) z = sizeZ - 1

    const stepX = dx > 0 ? 1 : -1
    const stepY = dy > 0 ? 1 : -1
    const stepZ = dz > 0 ? 1 : -1

    const invDx = dx !== 0 ? 1 / dx : 1e9
    const invDy = dy !== 0 ? 1 / dy : 1e9
    const invDz = dz !== 0 ? 1 / dz : 1e9

    const nextX = stepX > 0 ? x + 1 : x
    let tMaxX = (nextX - ox) * invDx
    const nextY = stepY > 0 ? y + 1 : y
    let tMaxY = (nextY - oy) * invDy
    const nextZ = stepZ > 0 ? z + 1 : z
    let tMaxZ = (nextZ - oz) * invDz


    const tDeltaX = invDx < 0 ? -invDx : invDx
    const tDeltaY = invDy < 0 ? -invDy : invDy
    const tDeltaZ = invDz < 0 ? -invDz : invDz

    let idx = x + y * sizeX + z * XY

    // --- 4. Check voxel at entry point ---
    if (startT > 0 && voxels[idx] != 0) {
        let face = -1
        const EPS = 1e-6

        an = ox - sizeX
        if ((ox < 0 ? -ox : ox) < EPS && dx > 0) face = 1   // -X
        if ((an < 0 ? -an : an) < EPS && dx < 0) face = 0   // +X

        an = oy - sizeY
        if ((oy < 0 ? -oy : oy) < EPS && dy > 0) face = 3   // -Y
        if ((an < 0 ? -an : an) < EPS && dy < 0) face = 2   // +Y

        an = oz - sizeZ
        if ((oz < 0 ? -oz : oz) < EPS && dz > 0) face = 5   // -Z
        if ((an < 0 ? -an : an) < EPS && dz < 0) face = 4   // +Z

        return computeHitUV(startT, x, y, z, oX, oY, oZ, dx, dy, dz, face, voxels[idx])
    }

    let tLocal = 0

    // --- 5. Main DDA loop ---
    let face = -1

    while (startT + tLocal <= limitT) {

        if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
            face = (stepX > 0) ? 1 : 0
            x += stepX
            idx += stepX
            tLocal = tMaxX
            tMaxX += tDeltaX
        } else if (tMaxY <= tMaxZ) {
            face = (stepY > 0) ? 3 : 2
            y += stepY
            idx += stepY * X
            tLocal = tMaxY
            tMaxY += tDeltaY
        } else {
            face = (stepZ > 0) ? 5 : 4
            z += stepZ
            idx += stepZ * XY
            tLocal = tMaxZ
            tMaxZ += tDeltaZ
        }

        if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return [-1]

        if (voxels[idx] != 0) {
            return computeHitUV(startT + tLocal, x, y, z, oX, oY, oZ, dx, dy, dz, face, voxels[idx])
        }
    }

    return traceRayNoReturn
}

class Player {
    x
    y
    z
    yaw
    pitch
    fov
    moveSpeed
    turnSpeed
    limit
    vy
    va
    onLand
    minW // negative W
    minH // negative H
    minL // negative L
    maxW // positive W
    maxH // positive H
    maxL // positive L

    constructor() {
        this.x = 2.5
        this.y = 2.5
        this.z = 3.5
        this.yaw = 0.001
        this.pitch = -0.3
        this.fov = 1.0
        this.moveSpeed = 4
        this.turnSpeed = 1.5
        this.limit = Math.PI / 2 - 0.01
        this.vy = 0
        this.va = 1
        this.onLand = false

        this.minW = 0.4
        this.minH = 1.1
        this.minL = 0.4
        this.maxW = 0.4
        this.maxH = 0.4
        this.maxL = 0.4
    }

    computeBasis() {
        const cp = Math.cos(this.pitch)
        const sp = Math.sin(this.pitch)
        const cy = Math.cos(this.yaw)
        const sy = Math.sin(this.yaw)

        // forward (normalized)
        fVec[0] = cp * cy
        fVec[1] = sp
        fVec[2] = cp * sy

        // right (normalized, horizontal)
        rVec[0] = -fVec[2]
        rVec[1] = 0
        rVec[2] = fVec[0]
        const rl = Math.sqrt(rVec[0] * rVec[0] + rVec[2] * rVec[2])
        rVec[0] /= rl
        rVec[2] /= rl

        // up = r × f (normalized automatically if r,f are)
        uVec[0] = rVec[1] * fVec[2] - rVec[2] * fVec[1]
        uVec[1] = rVec[2] * fVec[0] - rVec[0] * fVec[2]
        uVec[2] = rVec[0] * fVec[1] - rVec[1] * fVec[0]
    }

    forward() {
        const fx = Math.cos(this.pitch) * Math.cos(this.yaw)
        const fy = Math.sin(this.pitch)
        const fz = Math.cos(this.pitch) * Math.sin(this.yaw)
        
        fVec[0] = fx
        fVec[1] = fy
        fVec[2] = fz

        return fVec
    }

    right() {
        const f = this.forward().slice()

        rVec[0] = -f[2]
        rVec[1] = 0
        rVec[2] = f[0]

        return rVec
    }

    up() {
        const f = this.forward().slice()
        const r = this.right().slice()

        uVec[0] = r[1] * f[2] - r[2] * f[1]
        uVec[1] = r[2] * f[0] - r[0] * f[2]
        uVec[2] = r[0] * f[1] - r[1] * f[0]

        return uVec
    }

    update(dt) {
        const ax = this.x - this.minW
        const ay = this.y - this.minH
        const az = this.z - this.minL
        const bx = this.x + this.maxW
        const by = this.y + this.maxH
        const bz = this.z + this.maxL


        //this.onLand = isOnGround(ax, ay, az, bx, bz)
        // --- direction vectors ---
        const cf = Math.cos(this.pitch)
        const sf = Math.sin(this.pitch)


        const cy = Math.cos(this.yaw)
        const sy = Math.sin(this.yaw)

        let fx = cy
        let fz = sy

        

        // right = normalize(cross(forward, up(0,1,0)))
        let rx = -Math.sin(this.yaw)
        let rz = Math.cos(this.yaw)
        let ry = 10

        
        
        
        // --- movement input ---
        const move = this.moveSpeed * dt
        const turn = this.turnSpeed * dt

        let dx = 0, dy = 0, dz = 0

        if (Con.Walk.U) { dx += fx; dz += fz }
        if (Con.Walk.D) { dx -= fx; dz -= fz }
        if (Con.Walk.L) { dx -= rx; dz -= rz }
        if (Con.Walk.R) { dx += rx; dz += rz }
        if (Con.Other.A && this.onLand) this.vy = 1.8

        
        this.vy -= this.va * move
        dy = this.vy
        
        dx *= move
        dy *= move
        dz *= move




        // no movement -> early out
        if (!(dx === 0 && dy === 0 && dz === 0)) {
            const x = this.x, y = this.y, z = this.z

            const t = hitboxDirT(
                ax, ay, az,
                bx, by, bz,
                dx, dy, dz
            )

            this.x = x + t[0] * dx
            this.y = y + t[1] * dy
            this.z = z + t[2] * dz

            // --- vertical collision handling ---
            if (dy !== 0) {
                if (t[3] & 2) {        // hit Y axis
                    if (dy < 0) this.onLand = true
                    this.vy = 0
                } else {
                    // moved vertically but no collision
                    this.onLand = false
                }
            }
        }

        // Clamp player inside world bounds
        if (this.x - this.minW < 0) this.x = this.minW
        if (this.y - this.minH < 0) this.y = this.minH
        if (this.z - this.minL < 0) this.z = this.minL

        if (this.x + this.maxW > sizeX) this.x = sizeX - this.maxW
        //if (this.y + this.maxH > sizeY) this.y = sizeY - this.maxH // dont clamp +Y bc its parkour
        if (this.z + this.maxL > sizeZ) this.z = sizeZ - this.maxL





        if (Con.Turn.L) this.yaw -= turn
        if (Con.Turn.R) this.yaw += turn
        if (Con.Turn.U) this.pitch += turn
        if (Con.Turn.D) this.pitch -= turn

        const limit = this.limit
        if (this.pitch > limit) this.pitch = limit
        if (this.pitch < -limit) this.pitch = -limit
    }
}
const player = new Player()
const fov = player.fov


const fpsDisplay = document.getElementById("fps-display");

// --- 0. Game State & Timer Initialization ---
let lastTime = 0;
let timeSinceStart = -1;
let hasFinished = false;
let bestTime = parseFloat(localStorage.getItem("bestTime")) || 0;

// Set your Finish Tile coordinates here
const FINISH_X = 4;
const FINISH_Y = 19;
const FINISH_Z = 11;

// DOM Element references for the HUD
const timerDisplay = document.getElementById("timer-display");
const bestDisplay = document.getElementById("best-display");

if (bestDisplay && bestTime) {
    bestDisplay.textContent = bestTime.toFixed(2);
}

// Build map voxels, textures, and lookups before frame 1
varsInit();

window.addEventListener('keydown', (e) => {
    // Check if Backspace (or X, E, Enter) is pressed
    if (e.key === 'Backspace' || e.key === 'x' || e.key === 'X') {
        resetGame();
    }
});

function resetGame() {
    player.x = 2.5;
    player.y = 2.5;
    player.z = 3.5;

    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
	
	player.yaw = 0.001
    player.pitch = -0.3

    // 3. Reset the real timer state variables
    timeSinceStart = -1; // -1 signifies the timer is primed/waiting
    hasFinished = false;

    // 4. Clear the HUD display visually
    if (timerDisplay) {
        timerDisplay.textContent = "0.00";
    }
}

// Corrected Little-Endian 32-bit Color Palette (0xAABBGGRR)
const paletteABGR = [
    0xFF000000, // 0: Black
    0xFFFFFFFF, // 1: White
    0xFF2121FF, // 2: Red        (was 0xFFFF2121)
    0xFFC493FF, // 3: Pink       (was 0xFFFF93C4)
    0xFF3581FF, // 4: Orange     (was 0xFFFF8135)
    0xFF09F6FF, // 5: Yellow     (was 0xFFFFF609)
    0xFF21BB12, // 6: Green      (was 0xFF12BB21)
    0xFF52DC78, // 7: Light Green(was 0xFF78DC52)
    0xFFAD3F00, // 8: Blue       (was 0xFF003FAD)
    0xFFFFF287, // 9: Light Blue (was 0xFF87F2FF)
    0xFFC42E8E, // 10: Purple    (was 0xFF8E2EC4)
    0xFF9F83A4, // 11: Lavender  (was 0xFFA4839F)
    0xFF6C405C, // 12: Dark Purple(was 0xFF5C406C)
    0xFFC4CDE5, // 13: Gray      (was 0xFFE5CDC4)
    0xFF3D4691, // 14: Dark Red  (was 0xFF91463D)
    0xFF000000  // 15: Black
];

// --- 2. Fallback Projection Lookup Tables ---
// (Populated automatically if not already set up globally)
if (typeof sxTable === 'undefined' || !sxTable.length) {
    window.sxTable = new Float32Array(screenW);
    window.syTable = new Float32Array(screenH);
    
    for (let x = 0; x < screenW; x++) {
        sxTable[x] = (x / screenW) - 0.5;
    }
    for (let y = 0; y < screenH; y++) {
        syTable[y] = 0.5 - (y / screenH);
    }
}

// Ensure player vector variables exist globally
if (typeof fVec === 'undefined') window.fVec = [0, 0, 1];
if (typeof rVec === 'undefined') window.rVec = [1, 0, 0];
if (typeof uVec === 'undefined') window.uVec = [0, 1, 0];

// --- 3. Corrected gameLoop Function ---
function gameLoop(now) {
    const dt = Math.min(0.15, Math.max(0, (now - (lastTime || now)) / 1000));
    lastTime = now;
	
	if (dt > 0 && fpsDisplay) fpsDisplay.textContent = (1 / dt).toFixed(2);
	

    if (typeof updateControls === 'function') updateControls();

    const isMoving = Con?.Walk?.U || Con?.Walk?.D || Con?.Walk?.L || Con?.Walk?.R ||
                     Con?.Turn?.U || Con?.Turn?.D || Con?.Turn?.L || Con?.Turn?.R ||
                     Con?.Other?.A || Con?.Other?.B;

    if (isMoving && timeSinceStart === -1 && !hasFinished) {
        timeSinceStart = 0;
    }

    if (Con?.Other?.B) {
        if (confirm("Reset best time?")) {
            localStorage.removeItem("bestTime");
            bestTime = 0;
            location.reload();
            return;
        }
    }

    player.update(dt);
    player.computeBasis();

    const f = fVec;
    const r = rVec;
    const u = uVec;

    // --- RAYCASTING RENDER ---
    for (let py = 0; py < screenH; ++py) {
        let sy = syTable[py];

        for (let px = 0; px < screenW; ++px) {
            let sx = sxTable[px];

            // FIX: Explicit local declarations prevent runtime errors
            const renderX = f[0] + r[0] * sx + u[0] * sy;
            const renderY = f[1] + r[1] * sx + u[1] * sy;
            const renderZ = f[2] + r[2] * sx + u[2] * sy;

            const hit = traceRay(
                player.x, player.y, player.z,
                renderX, renderY, renderZ,
                30
            );

            const face = hit[0];

            if (face > -1) {
                const voxel = hit[4];

                const base = voxel * 6 + face;
                const texw = texW[base] + 1;
                const texh = texH[base] + 1;

                const tx = (hit[2] * texw) | 0;
                const ty = (hit[3] * texh) | 0;

                const colIdx = texData[voxel][face][tx + ty * texw]

                pixels[py * screenW + px] = 
					paletteABGR[
						texData[voxel][face][
							(hit[2] * texw) | 0 +
							((hit[3] * texh) | 0) * texw
						]
					];
            } else {
                // Sky Background Color (Cyan-Blue)
                pixels[py * screenW + px] = 0xFF000000; 
            }
        }
    }

    // Flush frame buffer to screen
    ctx.putImageData(imgData, 0, 0);

    // --- HUD TIMER UPDATE ---
    if (timeSinceStart !== -1 && !hasFinished) {
        timeSinceStart += dt;
        if (typeof timerDisplay !== 'undefined' && timerDisplay) {
            timerDisplay.textContent = timeSinceStart.toFixed(2);
        }
    }

    // --- FINISH CHECK ---
    const px = player.x | 0;
    const py = player.y | 0;
    const pz = player.z | 0;

    if (px === FINISH_X && py === FINISH_Y && pz === FINISH_Z && !hasFinished) {
        hasFinished = true;
        const finalTime = timeSinceStart.toFixed(2);

        if (!bestTime || timeSinceStart < bestTime) {
            localStorage.setItem("bestTime", timeSinceStart);
        }

        alert("Finished! Final Time: " + finalTime + "s");
        return;
    }

    requestAnimationFrame(gameLoop);
}

// Start Game Loop
requestAnimationFrame(gameLoop);