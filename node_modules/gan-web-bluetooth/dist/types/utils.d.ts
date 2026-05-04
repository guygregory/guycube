import { GanCubeMove } from './gan-cube-protocol';
/**
 * Return current host clock timestamp with millisecond precision
 * Use monotonic clock when available
 * @returns Current host clock timestamp in milliseconds
 */
declare const now: () => number;
/**
 * Use linear regression to fit timestamps reported by cube hardware with host device timestamps
 * @param cubeMoves List representing window of cube moves to operate on
 * @returns New copy of move list with fitted cubeTimestamp values
 */
declare function cubeTimestampLinearFit(cubeMoves: Array<GanCubeMove>): Array<GanCubeMove>;
/**
 * Calculate time skew degree in percent between cube hardware and host device
 * @param cubeMoves List representing window of cube moves to operate on
 * @returns Time skew value in percent
 */
declare function cubeTimestampCalcSkew(cubeMoves: Array<GanCubeMove>): number;
/**
 *
 * Convert Corner/Edge Permutation/Orientation cube state to the Kociemba facelets representation string
 *
 * Example - solved state:
 *   cp = [0, 1, 2, 3, 4, 5, 6, 7]
 *   co = [0, 0, 0, 0, 0, 0, 0, 0]
 *   ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
 *   eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
 *   facelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
 * Example - state after F R moves made:
 *   cp = [0, 5, 2, 1, 7, 4, 6, 3]
 *   co = [1, 2, 0, 2, 1, 1, 0, 2]
 *   ep = [1, 9, 2, 3, 11, 8, 6, 7, 4, 5, 10, 0]
 *   eo = [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
 *   facelets = "UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB"
 *
 * @param cp Corner Permutation
 * @param co Corner Orientation
 * @param ep Egde Permutation
 * @param eo Edge Orientation
 * @returns Cube state in the Kociemba facelets representation string
 *
 */
declare function toKociembaFacelets(cp: Array<number>, co: Array<number>, ep: Array<number>, eo: Array<number>): string;
export { now, cubeTimestampLinearFit, cubeTimestampCalcSkew, toKociembaFacelets, };
//# sourceMappingURL=utils.d.ts.map