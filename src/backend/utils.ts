export function bigintToLowAndHigh(num: bigint): [number, number] {
    num = BigInt.asUintN(64, num);
    return [Number(num & BigInt(0xffffffff)), Number(num >> BigInt(32))];
}
