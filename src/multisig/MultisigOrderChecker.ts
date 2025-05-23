import {
    AddressInfo,
    addressToString,
    assert,
    equalsAddressLists,
    formatAddressAndUrl,
    getAddressFormat, sanitizeHTML,
} from "../utils/utils";
import {AccountStorage, Address, Cell, Dictionary, fromNano, loadMessageRelaxed} from "@ton/core";
import {cellToArray, endParse} from "./Multisig";
import {Order, parseOrderData} from "./Order";
import {MultisigInfo} from "./MultisigChecker";
import {getAccountState, MyNetworkProvider, sendToIndex} from "../utils/MyNetworkProvider";
import {intToLockType, JettonMinter, lockTypeToDescription} from "../jetton/JettonMinter";
import {CommonMessageInfoRelaxedInternal} from "@ton/core/src/types/CommonMessageInfoRelaxed";
import { ContractOpcodes } from "../amm/opCodes";
import { parseActionBody } from "../orders";
import { AccountStateActive } from "@ton/core/dist/types/AccountState";

export interface MultisigOrderInfo {
    address: AddressInfo;
    tonBalance: bigint;
    orderId: bigint;
    isExecuted: boolean;
    approvalsNum: number;
    approvalsMask: number;
    threshold: number;
    signers: AddressInfo[];
    expiresAt: Date;
    actions: string[];
    stateInitMatches: boolean;
}

const checkNumber = (n: number) => {
    if (n === null) throw new Error('Invalid number');
    if (n === undefined) throw new Error('Invalid number');
    if (isNaN(n)) throw new Error('Invalid number');
    if (n < 0) throw new Error('Invalid number');
}

export const checkMultisigOrder = async (
    multisigOrderAddress: AddressInfo,
    multisigOrderCode: Cell,
    multisigInfo: MultisigInfo,
    isTestnet: boolean,
    needAdditionalChecks: boolean,
): Promise<MultisigOrderInfo> => {

    // Account State and Data

    //const result = await sendToIndex('account', {address: addressToString(multisigOrderAddress)}, isTestnet);
    //assert(result.status === 'active', "Contract not active. If you have just created an order it should appear within ~30 seconds.");
    //assert(Cell.fromBase64(result.code).equals(multisigOrderCode), 'The contract code DOES NOT match the multisig-order code from this repository');
    //const tonBalance = result.balance;
    //const data = Cell.fromBase64(result.data);
    const result : AccountStorage = await getAccountState(multisigOrderAddress.address, isTestnet)
    console.log(result)
    assert(result.state.type === 'active', "Contract not active. If you have just created a multisig it should appear within ~30 seconds.");
    const state = (result.state as AccountStateActive).state
    assert(state.code.equals(multisigOrderCode), 'The contract code DOES NOT match the multisig code from this repository');
    const tonBalance = result.balance.coins;

    const parsedData = parseOrderData(state.data);

    checkNumber(parsedData.threshold);
    assert(parsedData.threshold > 0, "Threshold not positive")
    assert(parsedData.threshold <= parsedData.signers.length, "Invalid threshold")
    checkNumber(parsedData.approvalsMask);
    checkNumber(parsedData.approvalsNum);
    assert(parsedData.approvalsNum <= parsedData.signers.length, "Invalid approvalsNum ")
    checkNumber(parsedData.expirationDate);

    const signersFormatted = [];
    for (const signer of parsedData.signers) {
        signersFormatted.push(await getAddressFormat(signer, isTestnet));
    }

    // Check in multisig

    assert(parsedData.multisigAddress.equals(multisigInfo.address.address), "Multisig address does not match");


    const multisigOrderToCheck = Order.createFromConfig({
        multisig: multisigInfo.address.address,
        orderSeqno: parsedData.orderSeqno
    }, multisigOrderCode);

    assert(multisigOrderToCheck.address.equals(multisigOrderAddress.address), "Fake multisig-order");

    if (!parsedData.isExecuted) {
        assert(multisigInfo.threshold <= parsedData.threshold, "Multisig threshold do not match order threshold");
        assert(equalsAddressLists(multisigInfo.signers.map(a => a.address), parsedData.signers), "Multisig signers do not match order signers");
    }

    if (needAdditionalChecks) {
        // Get-methods

        const provider = new MyNetworkProvider(multisigOrderAddress.address, isTestnet);
        const multisigOrderContract: Order = Order.createFromAddress(multisigOrderAddress.address);
        const getData = await multisigOrderContract.getOrderDataStrict(provider);

        assert(getData.multisig.equals(parsedData.multisigAddress), "Invalid multisigAddress");
        assert(getData.order_seqno === parsedData.orderSeqno, "Invalid orderSeqno");
        assert(getData.threshold === parsedData.threshold, "Invalid threshold");
        assert(getData.executed === parsedData.isExecuted, "Invalid isExecuted");
        assert(equalsAddressLists(getData.signers, parsedData.signers), "Invalid signers");
        assert(getData._approvals === BigInt(parsedData.approvalsMask), "Invalid approvalsMask");
        assert(getData.approvals_num === parsedData.approvalsNum, "Invalid approvalsNum");
        assert(getData.expiration_date === BigInt(parsedData.expirationDate), "Invalid expirationDate");
        assert(getData.order.hash().equals(parsedData.order.hash()), "Invalid order");
    }

    // StateInit

    const multisigOrderAddress3 = Order.createFromConfig({
        multisig: parsedData.multisigAddress,
        orderSeqno: parsedData.orderSeqno
    }, multisigOrderCode);

    const stateInitMatches = multisigOrderAddress3.address.equals(multisigOrderAddress.address);

    // Actions

    const actions = Dictionary.loadDirect(Dictionary.Keys.Uint(8), Dictionary.Values.Cell(), parsedData.order);

   

    let parsedActions: string[] = [];

    const actionsKeys = actions.keys();
    for (let key of actionsKeys) {
        let actionString = `<div class="label">Action #${key}:</div>`;

        const action = actions.get(key);
        const slice = action!.beginParse();
        const actionOp = slice.loadUint(32);
        if (actionOp === 0xf1381e5b) { // send message
            const sendMode = slice.loadUint(8);

            let sendModeString = [];
            let allBalance = false;

            if (sendMode & 1) {
                sendModeString.push('Pays fees separately');
            }
            if (sendMode & 2) {
                sendModeString.push('Ignore sending errors');
            }
            if (sendMode & 128) {
                allBalance = true;
                sendModeString.push('CARRY ALL BALANCE');
            }
            if (sendMode & 64) {
                sendModeString.push('Carry all the remaining value of the inbound message');
            }
            if (sendMode & 32) {
                sendModeString.push('DESTROY ACCOUNT');
            }


            const actionBody = slice.loadRef();
            endParse(slice);
            const messageRelaxed = loadMessageRelaxed(actionBody.beginParse());
            console.log(messageRelaxed);

            const info: CommonMessageInfoRelaxedInternal = messageRelaxed.info as any;

            const destAddress = await formatAddressAndUrl(info.dest, isTestnet);
            actionString += `<div>Send ${allBalance ? 'ALL BALANCE' : fromNano(info.value.coins)} TON to ${destAddress}</div>`
            actionString += `<div class="action_desc">${await parseActionBody(messageRelaxed, isTestnet)}</div>`
            if (sendMode) {
                actionString += `<div>Send mode: ${sendModeString.join(', ')}.</div>`
            }

        } else if (actionOp === 0x1d0cfbd3) { // update_multisig_params
            const newThreshold = slice.loadUint(8);
            const newSigners = cellToArray(slice.loadRef());
            const newProposers = slice.loadUint(1) ? cellToArray(slice.loadRef()) : [];
            endParse(slice);

            assert(newSigners.length > 0, 'Invalid new signers')
            assert(newThreshold > 0, 'Invalid new threshold')
            assert(newThreshold <= newSigners.length, 'Invalid new threshold')

            actionString += `<div>Update Multisig Params</div>`
            actionString += `<div>New threshold : ${newThreshold.toString()}</div>`

            actionString += '<div>New signers:</div>'
            for (let i = 0; i < newSigners.length; i++) {
                const signer = newSigners[i];
                const addressString = await formatAddressAndUrl(signer, isTestnet)
                actionString += (`<div>#${i + 1} - ${addressString}</div>`);
            }

            actionString += '<div>New proposers:</div>'
            if (newProposers.length > 0) {
                for (let i = 0; i < newProposers.length; i++) {
                    const proposer = newProposers[i];
                    const addressString = await formatAddressAndUrl(proposer, isTestnet)
                    actionString += (`<div>#${i + 1} - ${addressString}</div>`);
                }
            } else {
                actionString += '<div>No proposers</div>'
            }

        } else {
            throw new Error('Unknown action')
        }

        parsedActions.push(actionString);
    }

    return {
        address: multisigOrderAddress,
        tonBalance,
        orderId: parsedData.orderSeqno,
        isExecuted: parsedData.isExecuted,
        approvalsNum: parsedData.approvalsNum,
        approvalsMask: parsedData.approvalsMask,
        threshold: parsedData.threshold,
        signers: signersFormatted,
        expiresAt: new Date(parsedData.expirationDate * 1000),
        actions: parsedActions,
        stateInitMatches
    }

}