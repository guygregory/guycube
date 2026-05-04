/**
 * Common cube encrypter interface
 */
interface GanCubeEncrypter {
    /** Encrypt binary message buffer represented as Uint8Array */
    encrypt(data: Uint8Array): Uint8Array;
    /** Decrypt binary message buffer represented as Uint8Array */
    decrypt(data: Uint8Array): Uint8Array;
}
/**
 * Implementation for encryption scheme used in the GAN Gen2 Smart Cubes
 */
declare class GanGen2CubeEncrypter implements GanCubeEncrypter {
    private _key;
    private _iv;
    constructor(key: Uint8Array, iv: Uint8Array, salt: Uint8Array);
    /** Encrypt 16-byte buffer chunk starting at offset using AES-128-CBC */
    private encryptChunk;
    /** Decrypt 16-byte buffer chunk starting at offset using AES-128-CBC */
    private decryptChunk;
    encrypt(data: Uint8Array): Uint8Array;
    decrypt(data: Uint8Array): Uint8Array;
}
/**
 * Implementation for encryption scheme used in the GAN Gen3 cubes
 */
declare class GanGen3CubeEncrypter extends GanGen2CubeEncrypter {
}
/**
 * Implementation for encryption scheme used in the GAN Gen3 cubes
 */
declare class GanGen4CubeEncrypter extends GanGen2CubeEncrypter {
}
export type { GanCubeEncrypter };
export { GanGen2CubeEncrypter, GanGen3CubeEncrypter, GanGen4CubeEncrypter };
//# sourceMappingURL=gan-cube-encrypter.d.ts.map