import { Address, Cell, fromNano, StateInit, toNano } from "@ton/core";
import { AddressInfo, assert, formatAddressAndUrl, sanitizeHTML } from "./utils/utils";
import { intToLockType, JettonMinter, lockTypeToDescription } from "./jetton/JettonMinter";
import { ContractOpcodes } from "./amm/opCodes";
import { RouterV3Contract } from "./amm/RouterV3Contract";
import { getApproxFloatPrice } from "./amm/frontmath/frontMath";


export const AMOUNT_TO_SEND = toNano('0.2'); // 0.2 TON
export const DEFAULT_AMOUNT = toNano('0.1'); // 0.1 TON
export const DEFAULT_INTERNAL_AMOUNT = toNano('0.05'); // 0.05 TON

export type FieldType = 'TON' | 'Jetton' | 'Address' | 'URL' | 'Status' | 'String' | 'BigInt';

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
    fields: { [key: string]: OrderField };
    check?: (values: { [key: string]: any }) => Promise<ValidatedValue>;
    makeMessage: (values: { [key: string]: any }, multisigAddress : Address) => Promise<MakeMessageResult>;
}

/* Cut this function in parts */

export async function parseActionBody (cell: Cell, isTestnet : boolean): Promise<string> 
{
    try {
        const slice = cell.beginParse();
        if (slice.remainingBits === 0 && slice.remainingRefs == 0) {
            return "Send Toncoins from multisig without comment";
        }
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const op = slice.loadUint(32);
        if (op == 0) {
            const text = slice.loadStringTail();
            return `Send Toncoins from multisig with comment "${sanitizeHTML(text)}"`;
        }
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseMintMessage(slice);
        assert(parsed.internalMessage.forwardPayload.remainingBits === 0 && parsed.internalMessage.forwardPayload.remainingRefs === 0, 'Mint forward payload not supported');
        const toAddress = await formatAddressAndUrl(parsed.toAddress, isTestnet)
        return `Mint ${parsed.internalMessage.jettonAmount} jettons (in units) to ${toAddress}; ${fromNano(parsed.tonAmount)} TON for gas`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseTopUp(slice);
        return `Top Up`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseChangeAdmin(slice);
        const newAdminAddress = await formatAddressAndUrl(parsed.newAdminAddress, isTestnet)
        return `Change Admin to ${newAdminAddress}`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseClaimAdmin(slice);
        return `Claim Admin`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseChangeContent(slice);
        return `Change metadata URL to "${sanitizeHTML(parsed.newMetadataUrl)}"`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseTransfer(slice);
        if (parsed.customPayload) throw new Error('Transfer custom payload not supported');
        assert(parsed.forwardPayload.remainingBits === 0 && parsed.forwardPayload.remainingRefs === 0, 'Transfer forward payload not supported');
        const toAddress = await formatAddressAndUrl(parsed.toAddress, isTestnet)
        return `Transfer ${parsed.jettonAmount} jettons (in units) from multisig to user ${toAddress};`;
    } catch (e) {
    }


    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseCallTo(slice, JettonMinter.parseSetStatus);
        const userAddress = await formatAddressAndUrl(parsed.toAddress, isTestnet)
        const lockType = intToLockType(parsed.action.newStatus);
        return `Lock jetton wallet of user ${userAddress}. Set status "${lockType}" - "${lockTypeToDescription(lockType)}"; ${fromNano(parsed.tonAmount)} TON for gas`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseCallTo(slice, JettonMinter.parseTransfer);
        if (parsed.action.customPayload) throw new Error('Force transfer custom payload not supported');
        assert(parsed.action.forwardPayload.remainingBits === 0 && parsed.action.forwardPayload.remainingRefs === 0, 'Force transfer forward payload not supported');
        const fromAddress = await formatAddressAndUrl(parsed.toAddress, isTestnet)
        const toAddress = await formatAddressAndUrl(parsed.action.toAddress, isTestnet)
        return `Force transfer ${parsed.action.jettonAmount} jettons (in units) from user ${fromAddress} to ${toAddress}; ${fromNano(parsed.tonAmount)} TON for gas`;
    } catch (e) {
    }

    try {
        const slice = cell.beginParse();
        const parsed = JettonMinter.parseCallTo(slice, JettonMinter.parseBurn);
        if (parsed.action.customPayload) throw new Error('Burn custom payload not supported');
        const userAddress = await formatAddressAndUrl(parsed.toAddress, isTestnet)
        return `Force burn ${parsed.action.jettonAmount} jettons (in units) from user ${userAddress}; ${fromNano(parsed.tonAmount)} TON for gas`;
    } catch (e) {
    }

    try {
       let p = RouterV3Contract.unpackDeployPoolMessage(cell)

        const jetton0MinterS = await formatAddressAndUrl(p.jetton0Minter, isTestnet)
        const jetton1MinterS = await formatAddressAndUrl(p.jetton1Minter, isTestnet)

        const jetton0WalletS = await formatAddressAndUrl(p.jetton0WalletAddr, isTestnet)
        const jetton1WalletS = await formatAddressAndUrl(p.jetton1WalletAddr, isTestnet)


        const controllerS = await formatAddressAndUrl(p.controllerAddress, isTestnet)

        return `Create New Pool For<br/>` + 
        `  Minter1: ${jetton0MinterS}<br/>` + 
        `  Wallet1: ${jetton0WalletS}<br/>` + 

        `  Minter2: ${jetton1MinterS}<br/>` + 
        `  Wallet2: ${jetton1WalletS}<br/>` + 

        `  Tick Spacing : ${p.tickSpacing}<br/>` +
        `  Price : ${p.sqrtPriceX96} (${getApproxFloatPrice(p.sqrtPriceX96)}) <br/>` +

        `  Controller :  ${controllerS}<br/>`;
    } catch (e) {
    }

    

    throw new Error('Unsupported action')

}