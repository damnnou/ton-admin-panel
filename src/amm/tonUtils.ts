import { Address, Cell } from "@ton/core"

export const BLACK_HOLE_ADDRESS  : Address = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c")
export const BLACK_HOLE_ADDRESS1 : Address = Address.parse("EQAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEOSs")
export const BLACK_HOLE_ADDRESS2 : Address = Address.parse("EQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAc3j")


export function getDailyStorageFees(bits: bigint, cells: bigint )
{
    const STORE_BIT_PRICE  = 1n
    const STORE_CELL_PRICE = 500n
    let storageDayFee = (BigInt(bits) * STORE_BIT_PRICE + BigInt(cells) * STORE_CELL_PRICE) * (60n * 60n * 24n) / (2n ** 16n)
    return storageDayFee;
}

export function addrToShard(input : Address) : number {
    return input.hash.readUInt16BE(0);
}

export function matchingBits16(v1 : number, v2: number) {
    for (let i = 1; i <= 16; i++) {
        let mask = 1 << (16 - i)
        if ((v1 & mask) != (v2 & mask)) {
            return i - 1
        }
    }
    return 16;
}



export function getCellStats(cell : Cell) {

    let slice = cell.beginParse()
    let depth = 0;
    let bits = slice.remainingBits;
    let cells = 1;
    while (slice.remainingRefs != 0) {
        let refStats = getCellStats(slice.loadRef())
        bits += refStats.bits
        cells += refStats.cells
        depth = Math.max(refStats.depth, depth)
    }
    depth += 1
    return {depth, bits, cells}
}



export function getUniqSubcells(cell : Cell, hashes : Set<Buffer> = new Set<Buffer>())  {
    let slice = cell.beginParse()
    hashes.add(cell.hash())
    while (slice.remainingRefs != 0) {
        getUniqSubcells(slice.loadRef(), hashes)
    }   
    return hashes.size
}
