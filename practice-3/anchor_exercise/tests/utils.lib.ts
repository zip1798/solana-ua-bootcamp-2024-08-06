import { randomBytes } from "crypto";
import { type Program, BN } from "@coral-xyz/anchor";


export const getRandomBigNumber = (size: number = 8) => {
    return new BN(randomBytes(size));
};
  
export function areBnEqual(a: unknown, b: unknown): boolean | undefined {
    const isABn = a instanceof BN;
    const isBBn = b instanceof BN;
  
    if (isABn && isBBn) {
      return a.eq(b);
    } else if (isABn === isBBn) {
      return undefined;
    } else {
      return false;
    }
}