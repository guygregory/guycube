import { GanCubeConnection, GanCubeCommand, GanCubeEvent, GanCubeMove } from './gan-cube-protocol';
/**
 * Type representing function interface to implement custom MAC address provider
 * @param device Current BluetoothDevice selected by user.
 * @param isFallbackCall Flag indicating this is final and last resort call for MAC address.
 *                       If this flag is not set, custom provider can return null instead of MAC,
 *                       in such case library will try to read MAC automatically.
 */
type MacAddressProvider = (device: BluetoothDevice, isFallbackCall?: boolean) => Promise<string | null>;
/**
 * Initiate new connection with the GAN Smart Cube device
 * @param customMacAddressProvider Optional custom provider for cube MAC address
 * @returns Object representing connection API and state
 */
declare function connectGanCube(customMacAddressProvider?: MacAddressProvider): Promise<GanCubeConnection>;
export type { MacAddressProvider, GanCubeConnection, GanCubeCommand, GanCubeEvent, GanCubeMove };
export { connectGanCube };
//# sourceMappingURL=gan-smart-cube.d.ts.map