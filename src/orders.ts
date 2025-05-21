import { Address, Cell, fromNano, MessageRelaxed, StateInit, toNano } from "@ton/core";
import { AddressInfo, assert, formatAddressAndUrl, sanitizeHTML } from "./utils/utils";

import { AMMOrders } from "./ammOrders";
import { JettonOrders } from "./jettonOrders";

export const AMOUNT_TO_SEND = toNano('0.2'); // 0.2 TON
export const DEFAULT_AMOUNT = toNano('0.1'); // 0.1 TON
export const DEFAULT_INTERNAL_AMOUNT = toNano('0.05'); // 0.05 TON

export type FieldType = 'TON' | 'Jetton' | 'Address' | 'URL' | 'Status' | 'String' | 'BigInt' | 'PositiveBigInt' | 'NaturalBigInt';

export interface ValidatedValue {
    value?: any
    error?: string
}

export interface OrderField {
    name: string
    type: FieldType
    default? : string
}

export interface MakeMessageResult {
    toAddress: AddressInfo
    tonAmount: bigint
    init? : StateInit
    body: Cell
}

export interface OrderType {
    name: string;
    description? : string;
    fields: { [key: string]: OrderField };
    check?: (values: { [key: string]: any }) => Promise<ValidatedValue>;
    makeMessage: (values: { [key: string]: any }, multisigAddress : Address) => Promise<MakeMessageResult | MakeMessageResult []>;
}


export async function parseActionBody (msg: MessageRelaxed, isTestnet : boolean): Promise<string> 
{
    try {
        return await AMMOrders.parseActionBody(msg, isTestnet)
    } catch {}

    try {    
        return await JettonOrders.parseActionBody(msg, isTestnet)
    } catch {}
    throw new Error('Unsupported action')
}