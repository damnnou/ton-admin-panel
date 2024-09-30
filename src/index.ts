import {Address, beginCell, Cell, comment, contractAddress, fromNano, SendMode, StateInit, storeStateInit, toNano} from "@ton/core";
import {THEME, TonConnectUI} from '@tonconnect/ui'
import {
    AddressInfo,
    addressToString,
    equalsMsgAddresses,
    makeAddressLink,
    validateUserFriendlyAddress
} from "./utils/utils";
import {checkMultisig, LastOrder, MultisigInfo} from "./multisig/MultisigChecker";
import {checkMultisigOrder, MultisigOrderInfo} from "./multisig/MultisigOrderChecker";
import {JettonMinter, LOCK_TYPES, LockType, lockTypeToDescription, lockTypeToInt} from "./jetton/JettonMinter";
import {Multisig} from "./multisig/Multisig";
import {toUnits} from "./utils/units";
import {checkJettonMinter} from "./jetton/JettonMinterChecker";
import {MyNetworkProvider, sendToIndex} from "./utils/MyNetworkProvider";
import {Order} from "./multisig/Order";
import {JettonWallet} from "./jetton/JettonWallet";

import {RouterV3Contract, RouterV3ContractConfig, routerv3ContractConfigToCell} from "./amm/RouterV3Contract";
import { ContractOpcodes } from "./amm/opCodes";
import { embedJettonData } from "./amm/nftContent";
import { packJettonOnchainMetadata } from "./amm/common/jettonContent";


// UI COMMON

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);

const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

const toggle = (element: HTMLElement, isVisible: boolean): void => {
    element.style.display = isVisible ? 'flex' : 'none';
}

const YOU_BADGE: string = ` <div class="badge">It's you</div>`

// URL STATE

const clearUrlState = (): void => {
    if (window.history.state !== '') {
        window.history.pushState('', 'TON Multisig', '#');
    }
}

const pushUrlState = (multisigAddress: string, orderId?: bigint): void => {
    let url = multisigAddress;
    if (orderId !== undefined) {
        url += '/' + orderId;
    }
    if (window.history.state !== url) {
        window.history.pushState(url, 'TON Multisig - ' + url, '#' + url);
    }
}

// TESTNET, LANGUAGE

const browserLang: string = navigator.language;
const lang: 'ru' | 'en' = (browserLang === 'ru-RU') || (browserLang === 'ru') || (browserLang === 'be-BY') || (browserLang === 'be') || (browserLang === 'kk-KZ') || (browserLang === 'kk') ? 'ru' : 'en';

const IS_TESTNET: boolean = window.location.href.indexOf('testnet=true') > -1;

if (IS_TESTNET) {
    $('.testnet-badge').style.display = 'block';
    document.body.classList.add('testnet-padding');
}

export const formatContractAddress = (address: Address): string => {
    return address.toString({bounceable: true, testOnly: IS_TESTNET});
}

// SCREEN

type ScreenType =
    'startScreen'
    | 'importScreen'
    | 'multisigScreen'
    | 'newOrderScreen'
    | 'orderScreen'
    | 'newMultisigScreen'
    | 'loadingScreen';

let currentScreen: ScreenType = 'startScreen';

const showScreen = (name: ScreenType): void => {
    const screens = ['startScreen', 'importScreen', 'multisigScreen', 'newOrderScreen', 'orderScreen', 'newMultisigScreen', 'loadingScreen']
    currentScreen = name;
    for (const screen of screens) {
        toggle($('#' + screen), screen === name);
    }

    switch (currentScreen) {
        case 'startScreen':
            clearMultisig();
            clearOrder();
            clearUrlState();
            break;
        case 'importScreen':
            ($('#import_input') as HTMLInputElement).value = '';
            break;
        case 'newOrderScreen':
            newOrderClear();
            break;
        case 'newMultisigScreen':
            newMultisigClear();
            break;
    }
}

// TONCONNECT

let myAddress: Address | null;

const tonConnectUI = new TonConnectUI({
    manifestUrl: 'https://multisig.ton.org/tonconnect-manifest.json',
    buttonRootId: 'tonConnectButton'
});

tonConnectUI.uiOptions = {
    uiPreferences: {
        theme: THEME.LIGHT
    }
};

const tonConnectUnsubscribe = tonConnectUI.onStatusChange(info => {
    if (info === null) { // wallet disconnected
        myAddress = null;
    } else if (info.account) {
        myAddress = Address.parseRaw(info.account.address);
    }

    if (currentMultisigAddress && currentMultisigInfo) {
        renderCurrentMultisigInfo();
    }

    if (currentOrderId && currentOrderInfo) {
        renderCurrentOrderInfo();
    }
});

// START SCREEN

$('#createMultisigButton').addEventListener('click', () => {
    showNewMultisigScreen('create');
});

$('#importMultisigButton').addEventListener('click', () => {
    showScreen('importScreen');
});

// IMPORT SCREEN

$('#import_okButton').addEventListener('click', () => {
    const address = ($('#import_input') as HTMLInputElement).value;
    const error = validateUserFriendlyAddress(address, IS_TESTNET);
    if (error) {
        alert(error);
    } else {
        setMultisigAddress(address);
    }
});

$('#import_backButton').addEventListener('click', () => {
    showScreen('startScreen')
});

// MULTISIG SCREEN

const MULTISIG_CODE = Cell.fromBase64("te6cckECEgEABJUAART/APSkE/S88sgLAQIBYgIDAsrQM9DTAwFxsJJfA+D6QDAi10nAAJJfA+AC0x8BIMAAkl8E4AHTPwHtRNDT/wEB0wcBAdTTBwEB9ATSAAEB0SiCEPcYUQ+64w8FREPIUAYBy/9QBAHLBxLMAQHLB/QAAQHKAMntVAQFAgEgDA0BnjgG0/8BKLOOEiCE/7qSMCSWUwW68uPw4gWkBd4B0gABAdMHAQHTLwEB1NEjkSaRKuJSMHj0Dm+h8uPvHscF8uPvIPgjvvLgbyD4I6FUbXAGApo2OCaCEHUJf126jroGghCjLFm/uo6p+CgYxwXy4GUD1NEQNBA2RlD4AH+OjSF49HxvpSCRMuMNAbPmWxA1UDSSNDbiUFQT4w1AFVAzBAoJAdT4BwODDPlBMAODCPlBMPgHUAahgSf4AaBw+DaBEgZw+DaggSvscPg2oIEdmHD4NqAipgYioIEFOSagJ6Bw+DgjpIECmCegcPg4oAOmBliggQbgUAWgUAWgQwNw+DdZoAGgHL7y4GT4KFADBwK4AXACyFjPFgEBy//JiCLIywH0APQAywDJcCH5AHTIywISygfL/8nQyIIQnHP7olgKAssfyz8mAcsHUlDMUAsByy8bzCoBygAKlRkBywcIkTDiECRwQImAGIBQ2zwRCACSjkXIWAHLBVAFzxZQA/oCVHEjI+1E7UXtR59byFADzxfJE3dQA8trzMztZ+1l7WR0f+0RmHYBy2vMAc8X7UHt8QHy/8kB+wDbBgLiNgTT/wEB0y8BAdMHAQHT/wEB1NH4KFAFAXACyFjPFgEBy//JiCLIywH0APQAywDJcAH5AHTIywISygfL/8nQG8cF8uBlJvkAGrpRk74ZsPLgZgf4I77y4G9EFFBW+AB/jo0hePR8b6UgkTLjDQGz5lsRCgH6AtdM0NMfASCCEPE4Hlu6jmqCEB0M+9O6jl5sRNMHAQHUIX9wjhdREnj0fG+lMiGZUwK68uBnAqQC3gGzEuZsISDCAPLgbiPCAPLgbVMwu/LgbQH0BCF/cI4XURJ49HxvpTIhmVMCuvLgZwKkAt4BsxLmbCEw0VUjkTDi4w0LABAw0wfUAvsA0QFDv3T/aiaGn/gIDpg4CA6mmDgID6AmkAAIDoiBqvgoD8EdDA4CAWYPEADC+AcDgwz5QTADgwj5QTD4B1AGoYEn+AGgcPg2gRIGcPg2oIEr7HD4NqCBHZhw+DagIqYGIqCBBTkmoCegcPg4I6SBApgnoHD4OKADpgZYoIEG4FAFoFAFoEMDcPg3WaABoADxsMr7UTQ0/8BAdMHAQHU0wcBAfQE0gABAdEjf3COF1ESePR8b6UyIZlTArry4GcCpALeAbMS5mwhUjC68uBsIX9wjhdREnj0fG+lMiGZUwK68uBnAqQC3gGzEuZsITAiwgDy4G4kwgDy4G1SQ7vy4G0BkjN/kQPiA4AFZsMn+CgBAXACyFjPFgEBy//JiCLIywH0APQAywDJcAH5AHTIywISygfL/8nQgEQhCAmMFqAYchWwszwXcsN9YFccUdYcFZ8q18EnjQLz1klHzYNH/nQ==");
const MULTISIG_ORDER_CODE = Cell.fromBase64('te6cckEBAQEAIwAIQgJjBagGHIVsLM8F3LDfWBXHFHWHBWfKtfBJ40C89ZJR80AoJo0=');

let currentMultisigAddress: string | undefined = undefined;
let currentMultisigInfo: MultisigInfo | undefined = undefined;
let updateMultisigTimeoutId: any = -1;

const clearMultisig = (): void => {
    currentMultisigAddress = undefined;
    currentMultisigInfo = undefined;
    clearTimeout(updateMultisigTimeoutId);
}

const renderCurrentMultisigInfo = (): void => {
    const {
        tonBalance,
        threshold,
        signers,
        proposers,
        allowArbitraryOrderSeqno,
        nextOderSeqno,
        lastOrders
    } = currentMultisigInfo;

    // Render Multisig Info

    $('#multisig_tonBalance').innerText = fromNano(tonBalance) + ' TON';

    $('#multisig_threshold').innerText = threshold + '/' + signers.length;

    $('#multisig_orderId').innerText = allowArbitraryOrderSeqno ? 'Arbitrary' : nextOderSeqno.toString();

    // Signers

    let signersHTML = '';
    for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        const addressString = makeAddressLink(signer);
        signersHTML += (`<div>#${i + 1} — ${addressString}${equalsMsgAddresses(signer.address, myAddress) ? YOU_BADGE : ''}</div>`);
    }
    $('#multisig_signersList').innerHTML = signersHTML;

    // Proposers

    if (proposers.length > 0) {
        let proposersHTML = '';
        for (let i = 0; i < proposers.length; i++) {
            const proposer = proposers[i];
            const addressString = makeAddressLink(proposer)
            proposersHTML += (`<div>#${i + 1} — ${addressString}${equalsMsgAddresses(proposer.address, myAddress) ? YOU_BADGE : ''}</div>`);
        }
        $('#multisig_proposersList').innerHTML = proposersHTML;
    } else {
        $('#multisig_proposersList').innerHTML = 'No proposers';
    }

    // Render Last Orders

    const formatOrderType = (lastOrder: LastOrder): string => {
        switch (lastOrder.type) {
            case 'new':
                return 'New order';
            case 'execute':
                return 'Execute order';
            case 'pending':
                return 'Pending order';
            case 'executed':
                return 'Executed order'
        }
        throw new Error('unknown order type ' + lastOrder.type);
    }

    const formatOrder = (lastOrder: LastOrder): string => {
        if (lastOrder.errorMessage) {
            if (lastOrder.errorMessage.startsWith('Contract not active')) return ``;
            if (lastOrder.errorMessage.startsWith('Failed')) {
                return `<div class="multisig_lastOrder" order-id="${lastOrder.order.id}" order-address="${addressToString(lastOrder.order.address)}"><span class="orderListItem_title">Failed Order #${lastOrder.order.id}</span> — Execution error</div>`;
            }
            return `<div class="multisig_lastOrder" order-id="${lastOrder.order.id}" order-address="${addressToString(lastOrder.order.address)}"><span class="orderListItem_title">Invalid Order #${lastOrder.order.id}</span> — ${lastOrder.errorMessage}</div>`;
        } else {
            const isExpired = lastOrder.orderInfo ? (new Date()).getTime() > lastOrder.orderInfo.expiresAt.getTime() : false;
            const actionText = isExpired ? 'Expired order ' : formatOrderType(lastOrder);
            let text = `<span class="orderListItem_title">${actionText} #${lastOrder.order.id}</span>`;

            if (lastOrder.type === 'pending' && !isExpired) {
                text += ` — ${lastOrder.orderInfo.approvalsNum}/${lastOrder.orderInfo.threshold}`;
            }

            if (lastOrder.type === 'pending' && myAddress) {
                const myIndex = lastOrder.orderInfo.signers.findIndex(signer => signer.address.equals(myAddress));
                if (myIndex > -1) {
                    const mask = 1 << myIndex;
                    const isSigned = lastOrder.orderInfo.approvalsMask & mask;

                    text += isSigned ? ' — You approved' : ` — You haven't approved yet`;
                }
            }

            return `<div class="multisig_lastOrder" order-id="${lastOrder.order.id}" order-address="${addressToString(lastOrder.order.address)}">${text}</div>`;
        }
    }

    let lastOrdersHTML = '';
    let wasPending = false;
    let wasExecuted = false;

    for (const lastOrder of lastOrders) {
        if (lastOrder.type == 'executed') {
            if (!wasExecuted) {
                lastOrdersHTML += '<div class="label">Old orders:</div>'
                wasExecuted = true;
            }
        } else if (lastOrder.type === 'pending') {
            if (!wasPending) {
                lastOrdersHTML += '<div class="label">Pending orders:</div>'
                wasPending = true;
            }
        }

        lastOrdersHTML += formatOrder(lastOrder);
    }

    $('#mainScreen_ordersList').innerHTML = lastOrdersHTML;

    $$('.multisig_lastOrder').forEach(div => {
        div.addEventListener('click', (e) => {
            const attributes = (e.currentTarget as HTMLElement).attributes;
            const orderAddressString = attributes.getNamedItem('order-address').value;
            const orderId = BigInt(attributes.getNamedItem('order-id').value);
            setOrderId(orderId, orderAddressString);
        })
    });
}

const updateMultisig = async (multisigAddress: string, isFirst: boolean): Promise<void> => {
    try {
        // Load

        const multisigInfo = await checkMultisig(Address.parseFriendly(multisigAddress), MULTISIG_CODE, MULTISIG_ORDER_CODE, IS_TESTNET, 'aggregate', isFirst);

        // Render if still relevant

        if (currentMultisigAddress !== multisigAddress) return;
        currentMultisigInfo = multisigInfo;

        renderCurrentMultisigInfo();
        toggle($('#multisig_content'), true);
        toggle($('#multisig_error'), false);

    } catch (e) {
        console.error(e);

        // Render error if still relevant
        if (currentMultisigAddress !== multisigAddress) return;
        if (isFirst || !e?.message?.startsWith('Timeout')) {
            toggle($('#multisig_content'), false);
            toggle($('#multisig_error'), true);
            $('#multisig_error').innerText = e.message;
        }
    }

    clearTimeout(updateMultisigTimeoutId);
    updateMultisigTimeoutId = setTimeout(() => updateMultisig(multisigAddress, false), 5000);

    if (isFirst) {
        showScreen('multisigScreen');
    }
}

const setMultisigAddress = async (newMultisigAddress: string, queuedOrderId?: bigint): Promise<void> => {
    showScreen('loadingScreen');
    clearMultisig();

    currentMultisigAddress = newMultisigAddress;
    localStorage.setItem('multisigAddress', newMultisigAddress);
    pushUrlState(newMultisigAddress, queuedOrderId);

    const multisigAddress = Address.parseFriendly(currentMultisigAddress);
    multisigAddress.isBounceable = true;
    multisigAddress.isTestOnly = IS_TESTNET;
    $('#mulisig_address').innerHTML = makeAddressLink(multisigAddress);

    await updateMultisig(newMultisigAddress, true);
}

$('#multisig_logoutButton').addEventListener('click', () => {
    localStorage.removeItem('multisigAddress');
    clearMultisig();
    showScreen('startScreen');
});

$('#multisig_createNewOrderButton').addEventListener('click', () => {
    showScreen('newOrderScreen');
});

$('#multisig_updateButton').addEventListener('click', () => {
    showNewMultisigScreen('update');
});

// ORDER SCREEN

let currentOrderId: bigint | undefined = undefined;
let currentOrderInfo: MultisigOrderInfo | undefined = undefined;
let updateOrderTimeoutId: any = -1;

const clearOrder = (): void => {
    currentOrderId = undefined;
    currentOrderInfo = undefined;
    clearTimeout(updateOrderTimeoutId);
}
const updateApproveButton = (isApproving: boolean, isLastApprove: boolean): void => {
    if (isLastApprove) {
        $('#order_approveButton').innerText = isApproving ? 'Executing..' : 'Execute';
    } else {
        $('#order_approveButton').innerText = isApproving ? 'Approving..' : 'Approve';
    }
    ($('#order_approveButton') as HTMLButtonElement).disabled = isApproving;
}

const renderCurrentOrderInfo = (): void => {
    const {
        tonBalance,
        actions,
        isExecuted,
        approvalsNum,
        approvalsMask,
        threshold,
        signers,
        expiresAt
    } = currentOrderInfo;

    const isExpired = (new Date()).getTime() > expiresAt.getTime();

    $('#order_tonBalance').innerText = fromNano(tonBalance) + ' TON';
    $('#order_executed').innerText = isExecuted ? 'Yes' : 'Not yet';
    $('#order_approvals').innerText = approvalsNum + '/' + threshold;
    $('#order_expiresAt').innerText = (isExpired ? '❌ EXPIRED - ' : '') + expiresAt.toString();

    let isApprovedByMe = false;
    let signersHTML = '';
    for (let i = 0; i < signers.length; i++) {
        const signer = signers[i];
        const addressString = makeAddressLink(signer);
        const mask = 1 << i;
        const isSigned = approvalsMask & mask;
        if (myAddress && isSigned && signer.address.equals(myAddress)) {
            isApprovedByMe = true;
        }
        signersHTML += (`<div>#${i + 1} — ${addressString} — ${isSigned ? '✅' : '❌'}${equalsMsgAddresses(signer.address, myAddress) ? YOU_BADGE : ''}</div>`);
    }
    $('#order_signersList').innerHTML = signersHTML;

    let actionsHTML = '';
    for (const action of actions) {
        actionsHTML += action;
    }

    if (actions.length === 0) {
        $('#order_actionsTitle').innerText = 'No actions';
    } else if (actions.length === 1) {
        $('#order_actionsTitle').innerText = 'One action:';
    } else {
        $('#order_actionsTitle').innerText = actions.length + ' actions:';
    }
    $('#order_actions').innerHTML = actionsHTML;

    let approvingTime = Number(localStorage.getItem(currentMultisigAddress + '_' + currentOrderId + '_approve'));

    if (Date.now() - approvingTime > 120000 && !isApprovedByMe) {
        approvingTime = 0;
        localStorage.removeItem(currentMultisigAddress + '_' + currentOrderId + '_approve');
    }

    updateApproveButton(!!approvingTime, approvalsNum === threshold - 1);

    toggle($('#order_approveButton'), !isExecuted && !isExpired && !isApprovedByMe);
    toggle($('#order_approveNote'), !isExecuted && !isExpired && !isApprovedByMe);
}

const updateOrder = async (orderAddress: AddressInfo, orderId: bigint, isFirstTime: boolean): Promise<void> => {
    try {
        // Load

        const orderInfo = await checkMultisigOrder(orderAddress, MULTISIG_ORDER_CODE, currentMultisigInfo, IS_TESTNET, isFirstTime);

        // Render  if still relevant
        if (currentOrderId !== orderId) return;
        currentOrderInfo = orderInfo;

        renderCurrentOrderInfo();
        toggle($('#order_content'), true);
        toggle($('#order_error'), false);

    } catch (e) {
        console.error(e);

        // Render error if still relevant
        if (currentOrderId !== orderId) return;
        if (isFirstTime || !e?.message?.startsWith('Timeout')) {
            toggle($('#order_content'), false);
            toggle($('#order_error'), true);
            $('#order_error').innerText = e.message;
        }
    }

    clearTimeout(updateOrderTimeoutId);
    updateOrderTimeoutId = setTimeout(() => updateOrder(orderAddress, orderId, false), 5000);

    if (isFirstTime) {
        showScreen('orderScreen');
    }
}

const setOrderId = async (newOrderId: bigint, newOrderAddress?: string): Promise<void> => {
    if (!currentMultisigInfo) throw new Error('setOrderId: no multisig info');

    showScreen('loadingScreen');
    clearOrder();
    currentOrderId = newOrderId;
    pushUrlState(currentMultisigAddress, newOrderId);

    if (newOrderAddress === undefined) {
        const tempOrder = Order.createFromConfig({
            multisig: Address.parseFriendly(currentMultisigAddress).address,
            orderSeqno: newOrderId
        }, MULTISIG_ORDER_CODE);

        newOrderAddress = formatContractAddress(tempOrder.address);
    }

    $('#order_id').innerText = '#' + currentOrderId;

    const orderAddress = Address.parseFriendly(newOrderAddress);
    orderAddress.isBounceable = true;
    orderAddress.isTestOnly = IS_TESTNET;
    $('#order_address').innerHTML = makeAddressLink(orderAddress);

    await updateOrder(orderAddress, newOrderId, true);
}

$('#order_backButton').addEventListener('click', () => {
    pushUrlState(currentMultisigAddress);
    clearOrder();
    showScreen('multisigScreen');
});

$('#order_approveButton').addEventListener('click', async () => {
    if (!currentMultisigAddress) throw new Error('approve !currentMultisigAddress');
    if (!currentOrderInfo) throw new Error('approve !currentOrderInfo');

    const multisigAddress = currentMultisigAddress;
    const orderInfo = currentOrderInfo;

    if (!myAddress) {
        alert('Please connect wallet');
        return;
    }

    const mySignerIndex = orderInfo.signers.findIndex(address => address.address.equals(myAddress));

    if (mySignerIndex == -1) {
        alert('You are not signer');
        return;
    }

    const orderAddressString = addressToString(orderInfo.address);
    const amount = DEFAULT_AMOUNT.toString();
    const payload = beginCell().storeUint(0, 32).storeStringTail('approve').endCell().toBoc().toString('base64');

    console.log({orderAddressString, amount})

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60, // 1 minute
        messages: [
            {
                address: orderAddressString,
                amount: amount,
                payload: payload,  // raw one-cell BoC encoded in Base64
            }
        ]
    }

    updateApproveButton(true, orderInfo.approvalsNum === orderInfo.threshold - 1);
    localStorage.setItem(multisigAddress + '_' + orderInfo.orderId + '_approve', Date.now().toString());

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
    } catch (e) {
        console.error(e);
        localStorage.removeItem(multisigAddress + '_' + orderInfo.orderId + '_approve');

        if (currentMultisigAddress === multisigAddress && currentOrderId === orderInfo.orderId) {
            updateApproveButton(false, orderInfo.approvalsNum === orderInfo.threshold - 1);
        }
    }
});

// NEW ORDER

type FieldType = 'TON' | 'Jetton' | 'Address' | 'URL' | 'Status' | 'String' | 'BigInt';

interface ValidatedValue {
    value?: any;
    error?: string;
}

const validateValue = (fieldName: string, value: string, fieldType: FieldType): ValidatedValue => {
    const makeError = (s: string): ValidatedValue => {
        return {error: fieldName + ': ' + s};
    }

    const makeValue = (x: any): ValidatedValue => {
        return {value: x};
    }

    const parseBigInt = (inputAmount: string): ValidatedValue => {
        try {
            const units = BigInt(inputAmount);

            if (units <= 0) {
                return makeError('Enter positive amount');
            }

            return makeValue(units);
        } catch (e: any) {
            return makeError('Invalid amount');
        }
    }

    const parseAmount = (inputAmount: string, decimals: number): ValidatedValue => {
        try {
            const units = toUnits(inputAmount, decimals);

            if (units <= 0) {
                return makeError('Enter positive amount');
            }

            return makeValue(units);
        } catch (e: any) {
            return makeError('Invalid amount');
        }
    }

    if (value === null || value === undefined || value === '') {
        return makeError(`Empty`);
    }

    switch (fieldType) {
        case 'TON':
            return parseAmount(value, 9);

        case 'Jetton':
            return parseBigInt(value);

        case 'BigInt':
            return parseBigInt(value);

        case 'Address':
            if (!Address.isFriendly(value)) {
                return makeError('Invalid Address');
            }
            const address = Address.parseFriendly(value);
            if (address.isTestOnly && !IS_TESTNET) {
                return makeError("Please enter mainnet address");
            }
            return makeValue(address);

        case 'URL':
            if (!value.startsWith('https://')) {
                return makeError('Invalid URL');
            }
            return makeValue(value);

        case 'String':
            return makeValue(value);

        case 'Status':
            if (LOCK_TYPES.indexOf(value) > -1) {
                return makeValue(value);
            } else {
                return makeError('Invalid status. Please use: ' + LOCK_TYPES.join(', '));
            }
    }
}

interface OrderField {
    name: string;
    type: FieldType;
}

interface MakeMessageResult {
    toAddress: AddressInfo;
    tonAmount: bigint;
    init? : StateInit;
    body: Cell;
}

interface OrderType {
    name: string;
    fields: { [key: string]: OrderField };
    check?: (values: { [key: string]: any }) => Promise<ValidatedValue>;
    makeMessage: (values: { [key: string]: any }) => Promise<MakeMessageResult>;
}

const AMOUNT_TO_SEND = toNano('0.2'); // 0.2 TON
const DEFAULT_AMOUNT = toNano('0.1'); // 0.1 TON
const DEFAULT_INTERNAL_AMOUNT = toNano('0.05'); // 0.05 TON

const checkJettonMinterAdmin = async (values: { [key: string]: any }): Promise<ValidatedValue> => {
    try {
        const multisigInfo = currentMultisigInfo;

        const jettonMinterInfo = await checkJettonMinter(values.jettonMinterAddress, IS_TESTNET, false);

        if (!multisigInfo.address.address.equals(jettonMinterInfo.adminAddress)) {
            return {error: "Multisig is not admin of this jetton"};
        }

        return {value: jettonMinterInfo};
    } catch (e: any) {
        console.error(e);
        return {error: 'Jetton-minter check error'};
    }
}

const checkJettonMinterNextAdmin = async (values: { [key: string]: any }): Promise<ValidatedValue> => {
    try {
        const multisigInfo = currentMultisigInfo;

        const jettonMinterInfo = await checkJettonMinter(values.jettonMinterAddress, IS_TESTNET, true);

        if (!jettonMinterInfo.nextAdminAddress || !multisigInfo.address.address.equals(jettonMinterInfo.nextAdminAddress)) {
            return {error: "Multisig is not next-admin of this jetton"};
        }

        return {value: jettonMinterInfo};
    } catch (e: any) {
        console.error(e);
        return {error: 'Jetton-minter check error'};
    }
}

const checkExistingOrderId = async (orderId: bigint): Promise<ValidatedValue> => {
    try {
        const orderAddress = await currentMultisigInfo.multisigContract.getOrderAddress(currentMultisigInfo.provider, orderId);
        const result = await sendToIndex('account', {address: orderAddress.toRawString()}, IS_TESTNET);
        if (result.status === 'uninit') {
            return {value: true};
        } else {
            return {error: `Order ${orderId} already exists`};
        }
    } catch (e) {
        console.error(e);
        return {error: 'Possibly connectivity error'};
    }
}

let contractDict : {[key: string] : string} = {} 
contractDict["PoolV3Contract"]        = "b5ee9c7241027701001684000114ff00f4a413f4bcf2c80b0102016202580202ca032a0201200425020120052404f3d906380492f827000e8698180b8d8492f82706d9e7d201800e98f90c108220e1cf6dd474b98b6117c237c80fc23fc80de79703590638059c8adf186f07c2bc684300000000000000000000000000000000000000000000000000000000000000000026382f9683290c10802f3a34bdd718110c1081902d6dedd47506080901fed33f31d300fa40d300fa40d317d39fd300d4d4f40430f84252b0c705f85752c0c705b1f2e052099307f8779137e2059303f8789133e203f87e03f87f236eb39c03d0fa4001f879fa4030f87a9133e2208211000276a3bef2e05d208290fffd8963efd1fc6a506488495d951d5263988d26b9f2e05e01f86801f870f856c0000703548e8720f872db3cf8719130e2f8498210d53276dbc8cb1fcb3fc9f849a4f869db3c82082dc6c05970db3c482221026410245f04f8575210c705f8585220c705b1f2e05270f870f8498210d53276dbc8cb1fcb3fc9f849a4f869db3c70598040db3c2221048e8f3210245f04f8575210c705f8585220c705b1f2e05271f870f8498210d53276dbc8cb1fcb3fc9f849a4f869db3c70598040db3ce02182106bdcbeb8bae302218210530b5f2cba22210a0b02a6316c22f8575220c705f8585230c705b1f2e052d33f31d30fd30fd30f3022812710b922812710b9b021812710b9b0f2e05502f864f863f865f8498210d53276dbc8cb1fcb3fc9f849a4f869db3c70598040db3c2221043ce3022182104468de77bae302218210d3f8a538bae302218210d73ac09dba0c0e0f1001fe316c22d33fd33fd37fd217d21730f8555240bef2d067f828f85df85f41301650337004c88308cf40c902c8cb3f23cf165003cf1612cc8100b0cf40ccc922c8cb0112f400f400cb00c97001f90074c8cb0212ca07cbffc9d0f851f84af84b2451374133f01d01c8cbffcbffc9821046ca335ac8cb1f16cb3f5006cf1612cb7f0d0118ca17ca17ccc970598040db3c2101fc316c22d33ffa40fa00fa00fa00fa00d37fd217d21730f8421ac705f2e052f828f85c1028027002c88010cf40c9c85003cf1601cf16ccc921c8cb0113f40012f400cb00c9207001f90074c8cb0212ca07cbffc9d082103ebe5431c8cb1f19cb3f5006fa025004fa0258fa0201fa02cb7f12ca1713ca17c97050338040db3c1b02dc316c22d33f30f85712c705f2e052f84cf84d70f86c70f86d21c20021c200b18ec7c822fa02f846cf1621fa02f847cf16c97071f8498100cb8210f93bb43fc8cb1f18cb3ff857cf1617cb1f16cb3f15cb0014cb0013cc02f02d70f84202c9128040db3cf849a4f869925f03e2db3c21220440e302f850c0008f0e44306c2121821081702ef8bae30fe03420821081702ef8ba1114161702fc316c22d33ffa40d33fd37fd217d217d37fd430d0d3ffd3ff30f828f85df85f529050337004c88308cf40c902c8cb3f23cf165003cf1612cc8100b0cf40ccc922c8cb0112f400f400cb00c97001f90074c8cb0212ca07cbffc9d01ac705f2e067705302a32654463054496ef02c24c2009133e30da05099a0f85106c8cb3f1213002e323a547431f02820c000f2f4546665f02930a302a3502a02c85220cb7f14ca1712ca1714ca17c9c827fa02f846cf1622fa02f847cf16c97120f8498100c98210f93bb43fc8cb1f1bcb3f5009cf1619cb1f17cb3f17cb0015cb0015cc13cc5043f02d70f84203c941308040db3cf849a4f86901ba95f856a5f876dedb3c212201fe31d33ffa00fa00fa4030f828f85c2259027002c88010cf40c9c85003cf1601cf16ccc921c8cb0113f40012f400cb00c97001f90074c8cb0212ca07cbffc9d015c705f2e052c858fa02f846cf1601fa02f847cf16c970712180668210f93bb43fc8cb1f16cb3f5006cf1614cb1f14cb3f12cb0012cb00cc70f84202c9128040150104db3c2101ec018210a7fb58f8ba8ee6d33ffa40fa40d430d0fa0030f8425250c705f2e0527020f8465240c7059231329bf84714c705926c129131e2e2c801fa02f846cf1601fa02f847cf16c970712180668210f93bb43fc8cb1f17cb3f5005cf1615cb1f13cb3f13cb00cb00cc7001c9128040db3ce05b840ff2f0210222e3028210a7fb58f8bae3025f03840ff2f0181d02fe303101d33ffa00fa00fa40d37fd217d21730f828f85c2559027002c88010cf40c9c85003cf1601cf16ccc921c8cb0113f40012f400cb00c97001f90074c8cb0212ca07cbffc9d018c705f2e0525343f02e7074fb02547061f0285327bb5327bbb021c000b08e8f30547283f02920c00093395f04e30d93395f04e222c20022191c01fe5172a15161a1f851f84af84b26513d4133f01df828f85df855f85f50337004c88308cf40c902c8cb3f23cf165003cf1612cc8100b0cf40ccc922c8cb0112f400f400cb00c9207001f90074c8cb0212ca07cbffc9d0f851f85505c8cbff14cbff14cb3f5006fa025004fa0213ca17c9f8498210d5ecca2ac8cb1f52b0cb3f281a0158cf1617cb7f15ca171aca1714cb3f12ccc98208e4e1c0552070db3cf849a4f869f855a4f875f856a4f87641401b002e778018c8cb055005cf165005fa0213cb6bccccc901fb0003c2c200b18ec3c823fa02f846cf1622fa02f847cf16c97071f8498210f93bb43fc8cb1f18cb3f5004cf1617cb1f15cb3fcb0014cb0012cc02f02df849a4f86970f84202c9128306db3c8e94345b8210d53276dbc8cb1fcb3fc970598306db3ce2db3c21212203fc02d33ffa40fa40d430d0fa00d39ffa0030f8425280c705f2e05272f8465250c7059730332170f02e719ff84715c70597337022f02e7003de03e220c002f2d0568100c8f00c07aa0ff8416f13a904820804054ca1f8416f12817530a1b6087054590029544930285447302e02ed44ed45ed478aed67ed65ed64787fed118a1e1f20001e3120c0609530328100e693f2f002e2004a54632014f02b01a301a322985205b993f2c060de985215b993f2c060dee21056104544030202d8ed41edf101f2ff03935003a09303a002e2f84bf84af851f852f853c8cb7fcb9fca17cbffcbffc9c822fa02f846cf1624fa02f847cf16c97120f8498210f93bb43fc8cb1f1acb3f5008cf1615cb1f17cb3f15cb0012cb0014cc12ccc959f02d70598040db3cf849a4f869db3c2122002c718018c8cb055004cf165004fa0212cb6accc901fb0001f4f85ff85ef85df85cc8ccccccccc9f85bc8f400c9c8f859cf16f85acf16c9f856f855f854f853f852f851f850c8cb00ca17cb9fcb7fcb17cb3fcb3ff857cf16f858cf16ccc9f84df84cf84bf84ac8cbffcbffcb7fcb7ff84efa02f84ffa02c9f849f848f845f844f843c8f842cf16cb0fcb0fcb0ff846cf16f84723001acf16cb17cb3fccccccccc9ed5400adb8e0a8e000de09f0c3f05cde27a60f2a430201a3751c3263f08203a67eb2e0df0bf0c3f08203a67eb2e2df0bf0c3a60fd0430201bd74050201bb7425631c2df08203a67eb2e6df0bf0c3f08203a67eb2e4df0bf0c3bc6102016e26290201202728003f2083fc9d86086a41886a208203627a08aa4108aa0068406a4129211fc06a412000c1093e16e0063d031be866b4fff49ff4fff4ffcc1c658c1c151c0008388c1b08897e16e0063d031be866b4fff49ff4fff4ffcc1c658c1c151c0008388c1b08949a6fa5d490e8548ca85637d415ae661489685485a8414137c4a85400e85668562860004d55dbc921023de01aa5f5323a124c200f2e05d029b02a98cc20091a4de01a906e002a98401a90480201482b380201202c330201202d300201202e2f0031176f248408f7a6c0a860d7ea633080246937b800a86a6d17e0001d0830402568dc3c07e8e4dc7c07f8a00201203132001d0830402568dc3c0828e4dc7c0838a000db3b68bb7ec870002497c0f800aa97d4c4edea00e38d48b12ce3851480e814c0afa6cc44aa633080246937b6cc780c244cb89484ea41162de808312cfcb816aa41882d80e040282efcb816b80c48712cfcb81694c06f3cb8169480a844aa633080246937882d80e040282efcb816a00201203437020120353600772385e0d7d62dea6108312cfcb816a8082d80e040282efcb816b820d7d62dea6308712cfcb816b0c0246937972f3cb816a8482d80e040282efcb816a0002908f0803cb81748b0803cb81424dc7c08f81c7c09200029423c200f2e05d22c200f2e0509370f024e070f023802012039530201203a410201203b3e04d31c151c0cafa55b0ca0403738092083fc9d862e655b0ca040373808e08203627a2f255b0ca04037783e1214942a4230c0255b0ca04037b83e1214902a4230c0255b0ca04037b83e14496e63c2cc48f6cf08f6cf08fc084077be1454942efe14496e6c38c03e1454902ee04a4a3c3d02225bf85222db3c22f02123db3cf85223f0224a4a02288f0b3003db3c02db3c01f0220193346c21e201704a4a01f114c86e7cb816c8a083fc9d862fbcb816c8608203627a2efcb8170830c03cb81408be16e0063d031be866b4fff49ff4fff4ffcc1c658c1c151c00083889be16e0063d031be866b4fff49ff4fff4ffcc1c658c1c151c0008389462a8144ea85466a81452a83e123c0714d42f1488af2c6557c3604038383e15203f01f682009c40be955f0d8100dfe0f85152d0bbf8512db9b097f853500ba0f873913ae223c0008e1435355bf85b188018f45a30f87bf8545007a1f8748e23506503c8cbff12ca7fcbffcbfff85b41908018f442f87bf8540791709171e217a0f874e223c0008e13135f0332f85b8018f45a30f87bf85401a1f874e30e70400042500503c8cbff12ca7fcbffcbfff85b128018f442f87bf8540191709171e2a0f87402f75eda2edfb20fe2030705303c300f2e057258e17238211000276a3bcf2e05df8525240be946c42db31e05b8e27238290fffd8963efd1fc6a506488495d951d5263988d26b9f2e05ef8525240bb946c42db31e05be22270f852f85122f8532992f84a92f84be29d26c3005359bdb0f8075290bcb08ae8373706f873018425203faf807fe2030534a9af85b52508018f47b6fa59af85b52508018f4786fa5e220b38e10312d95820ff276189582080d89e8e201de21db3c2f94530db60994530db608e2f84528103c52e2db3c5122a01ea150cda1f844c2008e11f84452c0a8812710a90451cca1509ca008de27c2009851b7a9d47f16a005913be2520aba4a434703ea5343be22c2ff7053018e2a3181271024a15250812710a984239654778671f01f9654787671f020e25cbe9231279654698326f025e28e243022975476705280f020975477605280f01fe225a321be91279825a354698026f026e212e25380ba05e30f20b324a35280bcb0943622a306de5216bd15b0444546004224b324b3b1983154708671f01f01de04b323b1993154428670f0200604923637e2004024b324b3b1983154780671f02001de04b323b1983154272670f01f06923637e2002e933021a19f3181271021a12259a98cc30091a4dee2413001ea8e613336018e522b912192f84ae22c92f84b9122e22655207054700026c700b39f5f0402d3ffd27fd3ffd3ff300555209136e214a15024a1541201504403c8cbff12ca7fcbffcbfff85b41308018f442f87b2b91a3de12a0019130e22a9203a59103e28e8e5f035250bd8e853323db3c03de03e2034801f2208211000276a3bef2e05d208290fffd8963efd1fc6a506488495d951d5263988d26b9f2e05e20aa1f2020c10192307f93b603a5e2208306be9520a68112ad96807f21a112ace201a680aa3f709320c10e8e155120a8ab7e20ab7f803f24a15210ac13b102ad02a4e8303182403627a301d71055774c85a820490178826a8f6481ab7f045a5af012a19d003aaaa1ab7f018270db2df09e81959a81455e260799a0632fa0ab7f5cba9230318e8a20db3c5003bb9130e031e24a02f620820ff27618bef2e05b2082080d89e8bbf2e05c5300c100933020a3de2071b0c3008e128270fffcb933bd6fad37aa2d162d1a59400192837fe22172b0c3008e158270fff97272373d413259a46990580e213aa8ab7fde2174b0c3008e158270fff2e50f5f656932ef12357cf3c7fdcca8ab7fde2178b0c300e3004b4c002a8270ffe5caca7e10e4e61c3624eaa0941cd0a8ab7f01fc218010b0c3008e158270ffcb9843d60f6159c9db58835c926644a8ab7fde218020b0c3008e158270ff973b41fa98c081472e6896dfb254c0a8ab7fde218040b0c3008e158270ff2ea16466c96a3843ec78b326b52861a8ab7fde218306b0c3008e158270fe5dee046a99a2a811c461f1969c3053a8ab7fde218307b0c3004d02fc8e158270fcbe86c7900a88aedcffc83b479aa3a4a8ab7fde218308b0c3008e158270f987a7253ac413176f2b074cf7815e54a8ab7fde218309b0c3008e158270f3392b0822b70005940c7a398e4b70f3a8ab7fde21830ab0c3008e158270e7159475a2c29b7443b29c7fa6e889d9a8ab7fde21830bb0c300e30021830cb04e4f002a8270d097f3bdfd2022b8845ad8f792aa5825a8ab7f02fec3008e158270a9f746462d870fdf8a65dc1f90e061e5a8ab7fde21830db0c3008e15827070d869a156d2a1b890bb3df62baf32f7a8ab7fde21830eb0c3008e15827031be135f97d08fd981231505542fcfa6a8ab7fde21830fb0c3008e15827009aa508b5b7a84e1c677de54f3e99bc9a8ab7fde218310b0c300e3002183115051002882685d6af8dedb81196699c329225ee604a8ab7f0098b0c3008e1382602216e584f5fa1ea926041bedfe98a8ab7fde018312b0c3008e118250048a170391f7dc42444e8fa2a8ab7fde01c2009584ff01a904de20ab1f01a9381fc00091709171e2a00070f872f871258e1102f86a22c20097f84c5003a0f86c9132e28e1102f86b22c20097f84d5003a0f86d9132e2e203c300c0ff91a192a101e2010201205457020120555600313e147e12be12c411c40dbc074128486a6d1fd6a8562a6d1fe0004d0870bffcb81a4830bffcb81a7e1396287e1bbe13c0687e1bfe13b0bffcb81abe13f0bffcb81aa00031421c2fff2e06921c2fff2e069f84e58a0f86ef84f01a0f86f802012059680201205a610201205b600201485c5d0111ad95ed9e7c24780e40750201485e5f016da4a5b679f051f0b804e0059100219e819390a0079e2c039e2d99924391960227e80025e801960192e003f200e991960425940f97ff93a1750005a6ba63010db5a59b679e05707502012062650201486364010daca3ed9e7c2840750119ae9bed9e78067c20b7897815c0750201206667018bb1e8f6cf3e0a3e177e17d04c140cdc013220c233d03240b232cfc8f3c59400f3c584b320402c33d0333248b232c044bd003d0032c0325c007e401d3232c084b281f2fff2742075010db25276cf3e16e075020120696e0201206a6b0115b60b7b679f0abf0bdf0850750201486c6d010daf746d9e78144075010dacaf6d9e781640750201206f72020148707101ddaea76d9e3780383780472e9260004d7c2da938400c7a3c37d2cd7c2da938400c7a3d37d2f110471b1c80e9ffe93fe9ffe9ff981460004c2d912cb7818937c64c122a9837828937c6710152104203df4c182cb7c637802c386f0352a33303c93610f1600013600058f318b62137c640750169af406d9e7c217c2bfc237c23fc2cfc2d7c287c247c21fc227c22fc28fc297c29fc257c25fc267c26fc2afc277c27fc2b7c2a7c24c07502012073740111b1ae76cf3e173e176075010db3abf6cf3c07607501f4ed44d0fa4001f862d30f01f863d30f01f864d30f01f865fa4001f866fa4001f867d31701f868d33f01f869d401d0d3ff01f86ad3ff01f86bd37f01f86cd37f01f86dfa0001f86efa0030f86fd401d0d30001f870d21701f871d39f01f872d37f01f873d31701f874d33f01f875d33f01f876fa4001f877fa4001760054f878d430d0fa4001f879fa4030f87ad401d0f40430f87bd430d0d401f87cd401f87dd401f87ed430f87f01cb27cd"    
contractDict["RouterV3Contract"]      = "b5ee9c7241022001000687000114ff00f4a413f4bcf2c80b01020162021204c4d020c700925f04e001d0d3030171b0925f04e0ed44d0d30001f861fa4001f862d33f01f863d401f864d401f865d430f866fa403001d31fd33f2282102e3034efbae302228210f93bb43fbae302342182107362d09cbae302303221821042a0fb43ba03070a1004fe32333302fa40fa40d317d39fd300d4d4d430d0fa40fa40fa4030f842500cc705f2e06ff844f845f846104b103a24f90124f901bf20c2008e8610354444db3c8e8710344555db3c12e27020c8cb0114f400f40012cb00c901217001f90074c8cb0212ca07cbffc9d021c300f2e07001c2009ac85009cf165007cf16c9e30e291d1d04050018c85008cf165008cf16c9106701b6d749c20291719170e2f843718210441c39edc8cb1f1ccb3f1bcb00f842cf16cb00500acf1615cb1713cb9fcb00cccc14f40012cb3fc97050338040db3cf843a4f863f846f845f844f843f841c8cb00f842cf16cb3fccccccc9ed5406002e778018c8cb055005cf165005fa0213cb6bccccc901fb0003f43234fa40d31fd33f31d30001c000925f06e0d430d0fa00fa40fa00fa4030f844f845f846255134413324f90124f901bf20c2008e8610354444db3c8e8710344555db3c12e27020c8cb0114f400f40012cb00c901307001f90074c8cb0212ca07cbffc9d05007c705f2e06f82090b076070804025c20024c200b01d1d0802a2975b17a1ab000670923238e223c2008eb47054491527702082100f8a7ea5c8cb1f16cb3f5003fa0221cf1601cf1613cb0001fa02cb005240cb1fc92372b128034444db3c01926c22e221c200925f07e30d0f0901601026704004702082100f8a7ea5c8cb1f16cb3f5003fa0221cf1601cf1613cb0001fa02cb0014cb1fc90372b14130db3c0f0270313301fa00fa4022c200f2e06e20c702925f05e0d430d020c701925f05e0d31ffa40228210a7fb58f8bae3020282104468de77bae3025f060b0c03f46c12d39ffa00fa4030f844f845f846290407552024f90124f901bf20c2008e8610354444db3c8e8710344555db3c12e27020c8cb0114f400f40012cb00c901307001f90074c8cb0212ca07cbffc9d0c85006fa0212cb9f01fa0258cf16c98210a7fb58f8c8cb1f15cb3f01cf1658cf1612cc7001c9128040db3c1d1d0f04fe01fa00fa00d37fd217d21730f844f845f8462b5139413324f90124f901bf20c2008e8610354444db3c8e8710344555db3c12e27020c8cb0114f400f40012cb00c901307001f90074c8cb0212ca07cbffc9d082104468de77c8cb1f1bcb3f5007cf1608f90105f90115bc9e5065fa0270fa0201fa025004fa02e30e12cb7f121d1d0d0e00240670fa025005fa025004fa025003fa0210230118ca17ca177001c9128040db3c0f002c718018c8cb055004cf165004fa0212cb6accc901fb0001568e9a3182101dcd6500f84258c705f2e06f5cbcf2e071a1f84270db3ce030318210d53276dbbadc840ff2f0110028708018c8cb055003cf165003fa02cb6ac901fb0002012013140045bf85476a268698000fc30fd2000fc31699f80fc31ea00fc326a00fc32ea187c337c2140201201516014dbb329ed44d0d30001f861fa4001f862d33f01f863d401f864d401f865d430f866f845f846db3c81d020158171c020120181b02037b60191a004bb73da89a1a60003f0c3f48003f0c5a67e03f0c7a803f0c9a803f0cba861f0cdf089f08bf08d00043b09da89a1a60003f0c3f48003f0c5a67e03f0c7a803f0c9a803f0cba861f0cdf083002c3ac6176a268698000fc30fd2000fc31699f80fc31ea00fc326a00fc32ea187c337c227c22fc23127c80927c80df9061004743081aa2226d9e4743881a22aaed9e097138106465808a7a007a000965806480983800fc803a646581096503e5ffe4e8401d1d02a5b1abfb513434c0007e187e90007e18b4cfc07e18f5007e1935007e19750c3e19be113e117e11893e40493e406fc8308023a1840d511136cf23a1c40d115576cf04b89c083232c0453d003d0004b2c032404c201d1d03f6f828c8c9c8c904c8cc13cc13ccccc96dc8f400c9c88d0860000000000000000000000000000000000000000000000000000000000000000004cf168d0860000000000000000000000000000000000000000000000000000000000000000004cf16c9c88101d1cf4089cf1689cf16ccc9c8810308cf40c97071801e1e1e1f004380000000000000000000000000000000000000000000000000000000000000000010004a5300c8500acf1619cb0f18cb0f17cb0f5008cf165006cf1614cb1715cb3f13cccc12ccccc94e93ab4d"
contractDict["AccountV3Contract"]     = "b5ee9c7241020901000197000114ff00f4a413f4bcf2c80b01020162020803f6d0eda2edfb3221c700925f03e0d0d303ed44d0fa4001f861fa4001f862d430d0fa0001f863fa0001f864fa0001f865fa0030f8660171b0925f03e0fa403001d31fd33ff8425240c705915be30df84112c7058ea2821042a0fb43ba8e97208208989680bcf2e0538208989680a1f84170db3cdb31e030915be2840f03060702ee2282103ebe5431ba8f6b6c32fa00fa00fa00fa00d37fd217d21730f8435007a0f863f8445005a0f86402f865f86620c200f843f845beb0f844f846beb08eb2821081702ef8c8cb1f14cb3ff843fa02f844fa02f841cf1613cb7f12ca17ca17c9f84201db3c70f86370f86470f86570f866925f04e2e05b0405002c718018c8cb055003cf1670fa0212cb6accc98306fb000042c8f843fa02f844fa02f845fa02f846fa02c9c8f841cf16f842cf16ccc9ed54db310028708018c8cb055003cf165003fa02cb6ac901fb000004f2f00065a0a273da89a1f48003f0c3f48003f0c5a861a1f40003f0c7f40003f0c9f40003f0cbf40061f0cdf083f085f087f089f08bf08d72175381"
contractDict["PositionNFTV3Contract"] = "b5ee9c724102180100039d000114ff00f4a413f4bcf2c80b0102016202100202cc030d020148040c02f543221c700925f03e0d0d3030171b0925f03e0fa40fa4031fa003171d721fa0031fa003073a9b400f00b02d31fd33f228210d5ecca2aba8e2e345b32f84258c705f2e195fa4001f863d37f01f865d21701f866d21701f867d430d0d3ff01f868d3ff30f869f00ce02282105fcc3d14bae3023434821046ca335aba8050802b032f84313c705f2e191fa40fa40d20031fa00702481014d01fa443058baf2f420d749c200f2e2c406820afaf080a121945315a0a1de22d70b01c300209206a19136e220c2fff2e19221923630e30d03926c31e30df863f00c0607007a821005138d91c8f843cf165008cf1671250449135447a0708010c8cb055007cf165005fa0215cb6a12cb1fcb3f226eb39458cf17019132e201c901fb00007c702381014d01fa443058baf2f4138210d53276db50046d71708010c8cb055007cf165005fa0215cb6a12cb1fcb3f226eb39458cf17019132e201c901fb000110e3025f03840ff2f00901fc01fa40d37fd217d217d430d0d3ffd3ff30f84217c705f2e052f84315c705f2e191f84612baf2e199f847baf2e199f845c000f2d198f84501b608f849f848c8cbffcbffc9f847f846f845f8418210d73ac09dc8cb1f19cb3ff843cf1618cb3f17cb7f16ca1715ca175210cb7f14ccc9f8455004a1f865f868f8698040f8450a011ec00093308306de70f8425adb3cf00c0b002c718018c8cb055004cf165004fa0212cb6accc901fb00006f420c498308b36e616e8cf168e296d21c10099802d5003cb0701a358de9c017aa90ca630586f0221c000e631986f2202cb07216e12e630e280201200e0f0065f76a268699f80fc30fd2000fc317d2000fc31ea00fc3269bf80fc32e90b80fc33690b80fc33ea186869ff80fc3469ff987c34c0055d7c24fc246465ffe5ffe4fc23fc237c22fc227c20e4659ffc21678b7c21e78b6665bfe50be50be664f6aa402012011140201201213001db8a38f00bf845f846f847f848f8498000db9e19f00bf8438020120151701fbb8fcff00bf844d0d30731f4043070c8cb078bf4c5020506f736974696f6e3a205b208cf16f846f0028b4202d3e208cf16f847f0028b3205d208cf16f845f002c970c8cb07cc82f0c9046f7a37ad0ea7cee73355984fa5428982f8b37c8f7bcec91f7ac71a7cd104588307f443f849f848f847f846f84570c8cb0716f400816003615cb7f14ca1713ca1712cbffcbffc9f845c300f841f842f8435503000dba8c2f00bf842868418000"



const orderTypes: OrderType[] = [

    {
        name: 'Deploy Router',
        fields: {
            amount: {
                name: 'TON Amount',
                type: 'TON'
            },
            nonce: {
                name: 'Nonce',
                type: 'BigInt'
            }
        },
        makeMessage: async (values) => {
            let buffer;
            buffer = Buffer.from(contractDict["PoolV3Contract"], "hex")
            let poolCell : Cell = Cell.fromBoc(buffer)[0]

            buffer = Buffer.from(contractDict["RouterV3Contract"], "hex")
            let routerCell : Cell = Cell.fromBoc(buffer)[0]

            buffer = Buffer.from(contractDict["AccountV3Contract"], "hex")
            let accountCell : Cell = Cell.fromBoc(buffer)[0]

            buffer = Buffer.from(contractDict["AccountV3Contract"], "hex")
            let positionCell : Cell = Cell.fromBoc(buffer)[0]


            let routerConfig : RouterV3ContractConfig = {
                active : true,
                adminAddress : currentMultisigInfo.address.address,
        
                poolv3_code : poolCell,    
                accountv3_code : accountCell,
                position_nftv3_code : positionCell,     
                nonce : values.nonce
            }
        
            const routerData: Cell = routerv3ContractConfigToCell(routerConfig);
            const routerStateInit: StateInit = { data: routerData,  code: routerCell }
            const routerAddress: Address = contractAddress(0, routerStateInit)
            
            /*const stateInitCell = beginCell();
            storeStateInit({
                code: routerCell as any,
                data: routerData as any
            })(stateInitCell as any);*/

            console.log(`We would deploy router to ${routerAddress}`)

            return {
                toAddress: {address: routerAddress, isTestOnly : true, isBounceable: false},
                tonAmount: values.amount,
                init: routerStateInit,
                body: beginCell().endCell()
            };
        }
    },

    {
        name: 'Deploy Pool',
        fields: {
            amount: {
                name: 'TON Amount',
                type: 'TON'
            },
            router: { name: 'Router Address', type: 'Address' },

            jetton0minter: { name: 'Jetton 0 minter', type: 'Address' },
            jetton1minter: { name: 'Jetton 1 minter', type: 'Address' },

            tickSpacing : { name: 'Tick Spacing', type: 'BigInt' },

            price1reserve : { name: 'price.reserve1', type: 'BigInt' },
            price2reserve : { name: 'price.reserve2', type: 'BigInt' },
            
            controller: { name: 'Operator', type: 'Address' },

        },
        makeMessage: async (values) => {
            
            let routerAddress = values.router.address

            let jetton0MinterAddress = values.jetton0minter.address
            console.log(`Minter 0 ${jetton0MinterAddress}`)
            let jetton0 : JettonMinter = JettonMinter.createFromAddress(jetton0MinterAddress)
            const provider0 = new MyNetworkProvider(jetton0MinterAddress, IS_TESTNET)
            let jetton0Wallet = await jetton0.getWalletAddress(provider0, routerAddress)
            console.log(`Wallet 0 ${jetton0Wallet} of ${routerAddress}`)

            let jetton1MinterAddress = values.jetton1minter.address
            console.log(`Minter 1 ${jetton1MinterAddress}`)
            let jetton1 : JettonMinter = JettonMinter.createFromAddress(jetton1MinterAddress)
            const provider1 = new MyNetworkProvider(jetton1MinterAddress, IS_TESTNET)
            let jetton1Wallet = await jetton1.getWalletAddress(provider1, routerAddress)
            console.log(`Wallet 1 ${jetton1Wallet} of ${routerAddress}`)

            let nftContentToPack : { [s: string]: string | undefined } =     {  
                name   : "Pool Minter:",
                description : "TONCO Pool LP Minter for ", 
                cover_image : "https://pimenovalexander.github.io/resources/icons/TONCO_1500x500.jpeg", 
                image: "https://pimenovalexander.github.io/resources/icons/TONCO_FACE_256x256.png" 
            }
        
            //const poolJetton0 = pool.getPoolOrderJetton(0)
            //const poolJetton1 = pool.getPoolOrderJetton(1)
            
            const nftContentPacked: Cell = embedJettonData(packJettonOnchainMetadata(nftContentToPack),
                    "TST1", Number(9), 
                    "TST2", Number(9)            
            )
        
            const nftItemContentToPack : { [s: string]: string | undefined } =     {  
                name   : "Pool Position", 
                description : "LP Position that corresponds to your liquidity in the pool ", 
                image: "https://pimenovalexander.github.io/resources/icons/TONCO_FACE_256x256.png",
                attributes: '[ {"trait_type": "Brand", "value": "TONCO" } ]',
            }
            const nftItemContentPacked: Cell =  packJettonOnchainMetadata(nftItemContentToPack)

            const msg_body = beginCell()
                .storeUint(ContractOpcodes.ROUTERV3_CREATE_POOL, 32) // OP code
                .storeUint(0, 64) // query_id        
                .storeAddress(jetton0Wallet)
                .storeAddress(jetton1Wallet)
                .storeUint(values.tickSpacing , 24)
                .storeUint(79228162514264337593543950336n, 160)
                .storeUint(1, 1) // Activate pool
                .storeRef(nftContentPacked)
                .storeRef(nftItemContentPacked)
                .storeRef(beginCell()
                    .storeAddress(jetton0MinterAddress)
                    .storeAddress(jetton1MinterAddress)
                    .storeAddress(values.controller.address)
                .endCell())
            .endCell();

            return {
                toAddress: values.router,
                tonAmount: values.amount,
                body: msg_body
            };
        }
    },

    {
        name: 'Transfer TON',
        fields: {
            amount: {
                name: 'TON Amount',
                type: 'TON'
            },
            toAddress: {
                name: 'Destination Address',
                type: 'Address'
            },
            comment: {
                name: 'Comment',
                type: 'String'
            }
        },
        makeMessage: async (values) => {
            return {
                toAddress: values.toAddress,
                tonAmount: values.amount,
                body: values.comment.length > 0 ? comment(values.comment) : beginCell().endCell()
            };
        }
    },

    {
        name: 'Transfer Jetton',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            amount: {
                name: 'Jetton Amount (in units)',
                type: 'Jetton'
            },
            toAddress: {
                name: 'To Address',
                type: 'Address'
            }
        },
        makeMessage: async (values): Promise<MakeMessageResult> => {
            const jettonMinterAddress: Address = values.jettonMinterAddress.address;
            const multisigAddress = currentMultisigInfo.address.address;
            const jettonMinter = JettonMinter.createFromAddress(jettonMinterAddress);
            const provider = new MyNetworkProvider(jettonMinterAddress, IS_TESTNET);

            const jettonWalletAddress = await jettonMinter.getWalletAddress(provider, multisigAddress);

            return {
                toAddress: {address: jettonWalletAddress, isBounceable: true, isTestOnly: IS_TESTNET},
                tonAmount: DEFAULT_AMOUNT,
                body: JettonWallet.transferMessage(values.amount, values.toAddress.address, multisigAddress, null, 0n, null)
            }
        }
    },

    {
        name: 'Mint Jetton',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            amount: {
                name: 'Jetton Amount (in units)',
                type: 'Jetton'
            },
            toAddress: {
                name: 'To Address',
                type: 'Address'
            }
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.mintMessage(values.toAddress.address, values.amount, values.jettonMinterAddress.address, currentMultisigInfo.address.address, null, 0n, DEFAULT_INTERNAL_AMOUNT)
            };
        }
    },

    {
        name: 'Change Jetton Admin',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            newAdminAddress: {
                name: 'New Admin Address',
                type: 'Address'
            },
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.changeAdminMessage(values.newAdminAddress.address)
            };
        }
    },

    {
        name: 'Claim Jetton Admin',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
        },
        check: checkJettonMinterNextAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.claimAdminMessage()
            }
        }
    },

    {
        name: 'Top-up Jetton Minter',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            amount: {
                name: 'TON Amount',
                type: 'TON'
            },
        },
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: values.amount,
                body: JettonMinter.topUpMessage()
            }
        }
    },

    {
        name: 'Change Jetton Metadata URL',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            newMetadataUrl: {
                name: 'New Metadata URL',
                type: 'URL'
            }
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.changeContentMessage({
                    uri: values.newMetadataUrl
                })
            };
        }
    },

    {
        name: 'Force Burn Jetton',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            amount: {
                name: 'Jetton Amount (in units)',
                type: 'Jetton'
            },
            fromAddress: {
                name: 'User Address',
                type: 'Address'
            }
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.forceBurnMessage(values.amount, values.fromAddress.address, currentMultisigInfo.address.address, DEFAULT_INTERNAL_AMOUNT)
            };
        }
    },

    {
        name: 'Force Transfer Jetton',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            amount: {
                name: 'Jetton Amount (in units)',
                type: 'Jetton'
            },
            fromAddress: {
                name: 'From Address',
                type: 'Address'
            },
            toAddress: {
                name: 'To Address',
                type: 'Address'
            }
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.forceTransferMessage(values.amount, values.toAddress.address, values.fromAddress.address, values.jettonMinterAddress.address, null, 0n, null, DEFAULT_INTERNAL_AMOUNT)
            }
        }
    },

    {
        name: 'Set status for Jetton Wallet',
        fields: {
            jettonMinterAddress: {
                name: 'Jetton Minter Address',
                type: 'Address'
            },
            userAddress: {
                name: 'User Address',
                type: 'Address'
            },
            newStatus: {
                name: `New Status (${LOCK_TYPES.join(', ')})`,
                type: 'Status'
            }
        },
        check: checkJettonMinterAdmin,
        makeMessage: async (values): Promise<MakeMessageResult> => {
            return {
                toAddress: values.jettonMinterAddress,
                tonAmount: DEFAULT_AMOUNT,
                body: JettonMinter.lockWalletMessage(values.userAddress.address, lockTypeToInt(values.newStatus), DEFAULT_INTERNAL_AMOUNT)
            }
        }
    },
]

const getOrderTypesHTML = (): string => {
    let html = '';
    for (let i = 0; i < orderTypes.length; i++) {
        const orderType = orderTypes[i];
        html += `<option value="${i}">${orderType.name}</option>`;
    }
    return html;
}

const newOrderTypeSelect: HTMLSelectElement = $('#newOrder_typeInput') as HTMLSelectElement;
newOrderTypeSelect.innerHTML = getOrderTypesHTML();

const renderNewOrderFields = (orderTypeIndex: number): void => {
    const orderType = orderTypes[orderTypeIndex];

    let html = '';

    for (let fieldId in orderType.fields) {
        if (orderType.fields.hasOwnProperty(fieldId)) {
            const field = orderType.fields[fieldId];
            html += `<div class="label">${field.name}:</div>`

            if (field.type === 'Status') {
                html += `<select id="newOrder_${orderTypeIndex}_${fieldId}">`
                for (let i = 0; i < LOCK_TYPES.length; i++) {
                    const lockType: LockType = LOCK_TYPES[i] as LockType;
                    html += `<option value="${lockType}">${lockTypeToDescription(lockType)}</option>`;
                }
                html += `</select>`
            } else {
                html += `<input id="newOrder_${orderTypeIndex}_${fieldId}">`
            }
        }
    }

    $('#newOrder_fieldsContainer').innerHTML = html;
}

newOrderTypeSelect.addEventListener('change', (e) => {
    renderNewOrderFields(newOrderTypeSelect.selectedIndex)
});

renderNewOrderFields(0);

let newOrderMode: 'fill' | 'confirm' = 'fill';
let transactionToSent: {
    orderId: bigint,
    multisigAddress: Address,
    message: { address: string, amount: string, stateInit?: string, payload?: string }
} | undefined = undefined;

const getNewOrderId = (): string => {
    if (!currentMultisigInfo) return '';

    let highestOrderId = -1n;
    currentMultisigInfo.lastOrders.forEach(lastOrder => {
        if (lastOrder.order.id > highestOrderId) {
            highestOrderId = lastOrder.order.id;
        }
    });
    return highestOrderId === -1n ? '' : (highestOrderId + 1n).toString();
}

const newOrderClear = () => {
    setNewOrderMode('fill');
    transactionToSent = undefined;

    newOrderTypeSelect.selectedIndex = 0;
    renderNewOrderFields(0);

    ($('#newOrder_orderId') as HTMLInputElement).value = getNewOrderId();
}

const updateNewOrderButtons = (isDisabled: boolean) => {
    ($('#newOrder_createButton') as HTMLButtonElement).disabled = isDisabled;
    ($('#newOrder_backButton') as HTMLButtonElement).disabled = isDisabled;
}

const setNewOrderDisabled = (isDisabled: boolean) => {
    const orderTypeIndex = newOrderTypeSelect.selectedIndex;
    const orderType = orderTypes[orderTypeIndex];

    newOrderTypeSelect.disabled = isDisabled;

    ($('#newOrder_orderId') as HTMLInputElement).disabled = isDisabled

    for (let fieldId in orderType.fields) {
        if (orderType.fields.hasOwnProperty(fieldId)) {
            const input: HTMLInputElement = $(`#newOrder_${orderTypeIndex}_${fieldId}`) as HTMLInputElement;
            input.disabled = isDisabled;
        }
    }

    updateNewOrderButtons(isDisabled);
}
const setNewOrderMode = (mode: 'fill' | 'confirm') => {
    if (mode == 'fill') {
        setNewOrderDisabled(false);
        $('#newOrder_createButton').innerHTML = 'Create';
        $('#newOrder_backButton').innerHTML = 'Back';
    } else {
        setNewOrderDisabled(true);
        $('#newOrder_createButton').innerHTML = 'Send Transaction';
        $('#newOrder_backButton').innerHTML = 'Cancel';
    }
    newOrderMode = mode;
}

$('#newOrder_createButton').addEventListener('click', async () => {
    if (!myAddress) {
        alert('Please connect wallet');
        return;
    }

    // Confirm & Send Transaction

    if (newOrderMode === 'confirm') {
        if (!transactionToSent) throw new Error('');

        try {
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 60, // 1 minute
                messages: [
                    transactionToSent.message
                ]
            });
            if (currentMultisigAddress === formatContractAddress(transactionToSent.multisigAddress)) {
                setOrderId(transactionToSent.orderId);
            }
        } catch (e) {
            console.error(e);
        }
        return;
    }

    const orderId = getBigIntFromInput($('#newOrder_orderId') as HTMLInputElement);
    if (orderId === null || orderId === undefined || orderId < 0) {
        alert('Invalid Order ID');
        return;
    }

    const orderTypeIndex = newOrderTypeSelect.selectedIndex;
    const orderType = orderTypes[orderTypeIndex];

    const values: { [key: string]: any } = {};

    for (let fieldId in orderType.fields) {
        if (orderType.fields.hasOwnProperty(fieldId)) {
            const field = orderType.fields[fieldId];
            const input: HTMLInputElement = $(`#newOrder_${orderTypeIndex}_${fieldId}`) as HTMLInputElement;
            const value = input.value;
            const validated = validateValue(field.name, value, field.type);
            if (validated.error) {
                alert(validated.error)
                return;
            }
            values[fieldId] = validated.value;
        }
    }

    setNewOrderDisabled(true);

    const orderIdChecked = await checkExistingOrderId(orderId);
    if (orderIdChecked.error) {
        alert(orderIdChecked.error)
        setNewOrderMode('fill')
        return;
    }

    if (orderType.check) {
        const checked = await orderType.check(values);
        if (checked.error) {
            alert(checked.error)
            setNewOrderMode('fill')
            return;
        }
    }

    const messageParams = await orderType.makeMessage(values);

    const myProposerIndex = currentMultisigInfo.proposers.findIndex(address => address.address.equals(myAddress));
    const mySignerIndex = currentMultisigInfo.signers.findIndex(address => address.address.equals(myAddress));

    if (myProposerIndex === -1 && mySignerIndex === -1) {
        alert('Error: you are not proposer and not signer');
        setNewOrderMode('fill')
        return;
    }

    const isSigner = mySignerIndex > -1;

    const toAddress = messageParams.toAddress;
    const tonAmount = messageParams.tonAmount;
    const payloadCell = messageParams.body;
    const expireAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 1 month

    const actions = Multisig.packOrder([
        {
            type: 'transfer',
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            message: {
                info: {
                    type: 'internal',
                    ihrDisabled: false,
                    bounce: true,
                    bounced: false,
                    dest: toAddress.address,
                    value: {
                        coins: tonAmount
                    },
                    ihrFee: 0n,
                    forwardFee: 0n,
                    createdLt: 0n,
                    createdAt: 0                    
                },  
                init: messageParams.init ?? undefined,
                body: payloadCell
            }
        }
    ]);

    const message = Multisig.newOrderMessage(actions, expireAt, isSigner, isSigner ? mySignerIndex : myProposerIndex, orderId, 0n)
    const messageBase64 = message.toBoc().toString('base64');

    console.log({
        toAddress,
        tonAmount,
        payloadCell,
        message,
        orderId
    })

    const multisigAddressString = currentMultisigAddress;
    const amount = AMOUNT_TO_SEND.toString();

    transactionToSent = {
        multisigAddress: Address.parseFriendly(multisigAddressString).address,
        orderId: orderId,
        message: {
            address: multisigAddressString,
            amount: amount,
            payload: messageBase64,  // raw one-cell BoC encoded in Base64
        }
    };

    setNewOrderMode('confirm')
    updateNewOrderButtons(false);
});

$('#newOrder_backButton').addEventListener('click', () => {
    if (newOrderMode == 'fill') {
        showScreen('multisigScreen');
    } else {
        setNewOrderMode('fill');
    }
});

// NEW MULTISIG / EDIT MULTISIG

const getIntFromInput = (input: HTMLInputElement): null | number => {
    if (input.value === '') {
        return null;
    }
    try {
        const i = parseInt(input.value);
        if (isNaN(i)) {
            return null;
        }
        return i;
    } catch (e) {
        return null;
    }
}

const getBigIntFromInput = (input: HTMLInputElement): null | bigint => {
    if (input.value === '') {
        return null;
    }
    try {
        const i = BigInt(input.value);
        return i;
    } catch (e) {
        return null;
    }
}

const newMultisigTreshoildInput = $('#newMultisig_threshold') as HTMLInputElement;
const newMultisigOrderIdInput = $('#newMultisig_orderId') as HTMLInputElement;

let newMultisigMode: 'create' | 'update' = 'create';
let newMultisigStatus: 'fill' | 'confirm' = 'fill';

interface NewMultisigInfo {
    signersCount: number;
    proposersCount: number;
}

let newMultisigInfo: NewMultisigInfo | undefined = undefined;
let newMultisigTransactionToSend: {
    orderId?: bigint,
    multisigAddress: Address,
    message: { address: string, amount: string, stateInit?: string, payload?: string }
} | undefined = undefined;

const showNewMultisigScreen = (mode: 'create' | 'update'): void => {
    newMultisigMode = mode;
    showScreen('newMultisigScreen'); // show screen invokes newMultisigClear
}

const newMultisigClear = (): void => {
    newMultisigStatus = 'fill';
    newMultisigInfo = {
        signersCount: 0,
        proposersCount: 0
    };
    newMultisigTransactionToSend = undefined;

    $('#newMultisig_signersContainer').innerHTML = '';
    $('#newMultisig_proposersContainer').innerHTML = '';
    newMultisigOrderIdInput.value = getNewOrderId();
    newMultisigTreshoildInput.value = '';

    toggle($('#newMultisig_orderIdLabel'), newMultisigMode === 'update');
    toggle($('#newMultisig_orderId'), newMultisigMode === 'update');

    if (newMultisigMode === 'create') {
        addSignerInput(0);
        newMultisigInfo.signersCount = 1;
    } else {
        newMultisigInfo.signersCount = currentMultisigInfo.signers.length;
        for (let i = 0; i < newMultisigInfo.signersCount; i++) {
            addSignerInput(i, addressToString(currentMultisigInfo.signers[i]));
        }
        newMultisigInfo.proposersCount = currentMultisigInfo.proposers.length;
        for (let i = 0; i < newMultisigInfo.proposersCount; i++) {
            addProposerInput(i, addressToString(currentMultisigInfo.proposers[i]));
        }
        newMultisigTreshoildInput.value = currentMultisigInfo.threshold.toString();
    }

    updateNewMultisigDeleteButtons();
    updateNewMultisigStatus();
}

const updateNewMultisigDeleteButtons = () => {
    const deleteButton = $(`#newMultisig_deleteSigner0`);
    toggle(deleteButton, newMultisigInfo.signersCount > 1);
}

const addSignerInput = (i: number, value?: string): void => {
    const element = document.createElement('div');
    element.classList.add('address-input');
    element.innerHTML = `<div class="address-input-num">#${i + 1}.</div> <input id="newMultisig_signer${i}"><button id="newMultisig_deleteSigner${i}">—</button>`;
    $('#newMultisig_signersContainer').appendChild(element);
    ($(`#newMultisig_signer${i}`) as HTMLInputElement).value = value === undefined ? '' : value;
    element.querySelector(`#newMultisig_deleteSigner${i}`).addEventListener('click', onSignerDeleteClick);
}
const addProposerInput = (i: number, value?: string): void => {
    const element = document.createElement('div');
    element.classList.add('address-input');
    element.innerHTML = `<div class="address-input-num">#${i + 1}.</div> <input id="newMultisig_proposer${i}"><button id="newMultisig_deleteProposer${i}">—</button>`;
    $('#newMultisig_proposersContainer').appendChild(element);
    ($(`#newMultisig_proposer${i}`) as HTMLInputElement).value = value === undefined ? '' : value;
    element.querySelector(`#newMultisig_deleteProposer${i}`).addEventListener('click', onProposerDeleteClick);
}

const onSignerDeleteClick = (event: MouseEvent): void => {
    const button = event.target as HTMLButtonElement;
    const index = Number(button.id.slice('newMultisig_deleteSigner'.length));
    if (isNaN(index)) throw new Error();

    const signers: string[] = [];
    for (let i = 0; i < newMultisigInfo.signersCount; i++) {
        const input = $(`#newMultisig_signer${i}`) as HTMLInputElement;
        signers.push(input.value);
    }
    signers.splice(index, 1);
    newMultisigInfo.signersCount--;
    $('#newMultisig_signersContainer').innerHTML = '';
    for (let i = 0; i < newMultisigInfo.signersCount; i++) {
        addSignerInput(i, signers[i]);
    }

    updateNewMultisigDeleteButtons();
}
const onProposerDeleteClick = (event: MouseEvent): void => {
    const button = event.target as HTMLButtonElement;
    const index = Number(button.id.slice('newMultisig_deleteProposer'.length));
    if (isNaN(index)) throw new Error();

    const proposers: string[] = [];
    for (let i = 0; i < newMultisigInfo.proposersCount; i++) {
        const input = $(`#newMultisig_proposer${i}`) as HTMLInputElement;
        proposers.push(input.value);
    }
    proposers.splice(index, 1);
    newMultisigInfo.proposersCount--;
    $('#newMultisig_proposersContainer').innerHTML = '';
    for (let i = 0; i < newMultisigInfo.proposersCount; i++) {
        addProposerInput(i, proposers[i]);
    }
}

$('#newMultisig_addSignerButton').addEventListener('click', async () => {
    addSignerInput(newMultisigInfo.signersCount);
    newMultisigInfo.signersCount++;
    updateNewMultisigDeleteButtons();
});

$('#newMultisig_addProposerButton').addEventListener('click', async () => {
    addProposerInput(newMultisigInfo.proposersCount);
    newMultisigInfo.proposersCount++;
});

const updateNewMultisigStatus = (): void => {
    const isDisabled = newMultisigStatus === 'confirm';

    newMultisigOrderIdInput.disabled = isDisabled;
    newMultisigTreshoildInput.disabled = isDisabled;

    toggle($('#newMultisig_addSignerButton'), !isDisabled);
    toggle($('#newMultisig_addProposerButton'), !isDisabled);

    for (let i = 0; i < newMultisigInfo.signersCount; i++) {
        const input = $(`#newMultisig_signer${i}`) as HTMLInputElement;
        input.disabled = isDisabled;
        const deleteButton = $(`#newMultisig_deleteSigner${i}`);
        toggle(deleteButton, !isDisabled && (newMultisigInfo.signersCount > 1));
    }
    for (let i = 0; i < newMultisigInfo.proposersCount; i++) {
        const input = $(`#newMultisig_proposer${i}`) as HTMLInputElement;
        input.disabled = isDisabled;
        const deleteButton = $(`#newMultisig_deleteProposer${i}`);
        toggle(deleteButton, !isDisabled);
    }
    updateNewMultisigCreateButton(false);
}

$('#newMultisig_backButton').addEventListener('click', () => {
    if (newMultisigStatus === 'fill') {
        if (newMultisigMode === 'create') {
            showScreen('startScreen');
        } else {
            showScreen('multisigScreen');
        }
    } else {
        newMultisigStatus = 'fill';
        updateNewMultisigStatus();
    }
});

const updateNewMultisigCreateButtonTitle = () => {
    $('#newMultisig_createButton').innerText = newMultisigStatus === 'confirm' ? 'Confirm' : (newMultisigMode === 'update' ? 'Update' : 'Create');
}

const updateNewMultisigCreateButton = (isLoading: boolean): void => {
    ($('#newMultisig_createButton') as HTMLButtonElement).disabled = isLoading;
    if (isLoading) {
        ($('#newMultisig_createButton') as HTMLButtonElement).innerText = 'Checking..';
    } else {
        updateNewMultisigCreateButtonTitle();
    }
    $('#newMultisigScreen').style.pointerEvents = isLoading ? 'none' : 'auto';

}

$('#newMultisig_createButton').addEventListener('click', async () => {
    if (!myAddress) {
        alert('Please connect wallet');
        return;
    }

    // Confirm & Send Transaction

    if (newMultisigStatus === 'confirm') {
        try {
            const orderId = newMultisigTransactionToSend.orderId;
            const multisigAddress = newMultisigTransactionToSend.multisigAddress;

            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 60, // 1 minute
                messages: [
                    newMultisigTransactionToSend.message
                ]
            });

            if (newMultisigMode === 'update') {
                if (currentMultisigAddress === formatContractAddress(multisigAddress)) {
                    setOrderId(orderId);
                }
            } else {
                setMultisigAddress(formatContractAddress(multisigAddress));
            }
        } catch (e) {
            console.error(e);
        }

        return;
    }

    // Get parameters

    const threshold = getIntFromInput(newMultisigTreshoildInput);
    if (threshold === null || threshold === undefined || threshold <= 0 || threshold > newMultisigInfo.signersCount) {
        alert('Threshold count: not valid number');
        return;
    }

    let orderId: bigint | undefined = undefined;
    if (newMultisigMode === 'update') {
        orderId = getBigIntFromInput(newMultisigOrderIdInput);
        if (orderId === null || orderId === undefined || orderId < 0) {
            alert('Invalid order Id');
            return;
        }

        updateNewMultisigCreateButton(true);
        const orderIdChecked = await checkExistingOrderId(orderId);
        updateNewMultisigCreateButton(false);
        if (orderIdChecked.error) {
            alert(orderIdChecked.error)
            return;
        }
    }

    const addressMap: { [key: string]: boolean } = {};

    const signersAddresses: Address[] = [];
    for (let i = 0; i < newMultisigInfo.signersCount; i++) {
        const input = $(`#newMultisig_signer${i}`) as HTMLInputElement;
        if (input.value === '') {
            alert(`Signer ${i}: empty field`);
            return;
        }

        const addressString = input.value;
        const error = validateUserFriendlyAddress(addressString, IS_TESTNET);
        if (error) {
            alert(`Signer ${i}: ${error}`);
            return;
        }
        const address = Address.parseFriendly(addressString).address;
        if (addressMap[address.toRawString()]) {
            alert('Duplicate ' + addressString);
            return;
        }
        addressMap[address.toRawString()] = true;
        signersAddresses.push(address);
    }

    const proposersAddresses: Address[] = [];
    for (let i = 0; i < newMultisigInfo.proposersCount; i++) {
        const input = $(`#newMultisig_proposer${i}`) as HTMLInputElement;
        if (input.value === '') {
            alert(`Proposer ${i}: empty field`);
            return;
        }

        const addressString = input.value;
        const error = validateUserFriendlyAddress(addressString, IS_TESTNET);
        if (error) {
            alert(`Proposer ${i}: ${error}`);
            return;
        }
        const address = Address.parseFriendly(addressString).address;
        if (addressMap[address.toRawString()]) {
            alert('Duplicate ' + addressString);
            return;
        }
        addressMap[address.toRawString()] = true;
        proposersAddresses.push(address);
    }

    // Make Transaction

    if (newMultisigMode === 'create') {

        const newMultisig = Multisig.createFromConfig({
            threshold: threshold,
            signers: signersAddresses,
            proposers: proposersAddresses,
            allowArbitrarySeqno: true
        }, MULTISIG_CODE);

        const newMultisigAddress = newMultisig.address;
        const amount = toNano('1').toString() // 1 TON

        const stateInitCell = beginCell();
        storeStateInit({
            code: newMultisig.init.code as any,
            data: newMultisig.init.data as any
        })(stateInitCell as any);

        newMultisigTransactionToSend = {
            multisigAddress: newMultisigAddress,
            message:
                {
                    address: newMultisigAddress.toString({urlSafe: true, bounceable: true, testOnly: IS_TESTNET}),
                    amount: amount,
                    stateInit: stateInitCell.endCell().toBoc().toString('base64'),  // raw one-cell BoC encoded in Base64
                }

        }

        newMultisigStatus = 'confirm';
        updateNewMultisigStatus();

    } else {
        const myProposerIndex = currentMultisigInfo.proposers.findIndex(address => address.address.equals(myAddress));
        const mySignerIndex = currentMultisigInfo.signers.findIndex(address => address.address.equals(myAddress));

        if (myProposerIndex === -1 && mySignerIndex === -1) {
            alert('Error: you are not proposer and not signer');
            return;
        }

        const isSigner = mySignerIndex > -1;

        const expireAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 1 month

        const actions = Multisig.packOrder([
            {
                type: 'update',
                threshold: threshold,
                signers: signersAddresses,
                proposers: proposersAddresses
            }
        ]);

        const message = Multisig.newOrderMessage(actions, expireAt, isSigner, isSigner ? mySignerIndex : myProposerIndex, orderId, 0n)
        const messageBase64 = message.toBoc().toString('base64');

        const multisigAddressString = currentMultisigAddress;
        const amount = DEFAULT_AMOUNT.toString();

        newMultisigTransactionToSend = {
            multisigAddress: Address.parseFriendly(multisigAddressString).address,
            orderId: orderId,
            message: {
                address: multisigAddressString,
                amount: amount,
                payload: messageBase64,  // raw one-cell BoC encoded in Base64
            }
        };

        newMultisigStatus = 'confirm';
        updateNewMultisigStatus();
    }
});

// START

const tryLoadMultisigFromLocalStorage = () => {
    const multisigAddress: string = localStorage.getItem('multisigAddress');

    if (!multisigAddress) {
        showScreen('startScreen');
    } else {
        setMultisigAddress(multisigAddress);
    }
}

const parseAddressFromUrl = (url: string): undefined | AddressInfo => {
    if (!Address.isFriendly(url)) {
        return undefined;
    }
    return Address.parseFriendly(url);
}

const parseBigIntFromUrl = (url: string): undefined | bigint => {
    try {
        const orderId = BigInt(url);
        if (orderId < 0) return undefined;
        return orderId;
    } catch (e) {
        return undefined;
    }
}

interface ParsedUrl {
    multisigAddress?: AddressInfo;
    orderId?: bigint;
}

const parseUrl = (url: string): ParsedUrl => {
    if (url.indexOf('/') > -1) {
        const arr = url.split('/');
        if (arr.length !== 2) {
            return {};
        }
        const multisigAddress = parseAddressFromUrl(arr[0]);
        if (multisigAddress === undefined) {
            return {};
        }

        const orderId = parseBigIntFromUrl(arr[1]);
        if (orderId === undefined) {
            return {};
        }

        return {
            multisigAddress: multisigAddress,
            orderId: orderId
        };
    } else {
        return {
            multisigAddress: parseAddressFromUrl(url)
        };
    }
}

const processUrl = async () => {
    clearMultisig();
    clearOrder();

    const urlPostfix = window.location.hash.substring(1);

    if (urlPostfix) {
        const {multisigAddress, orderId} = parseUrl(urlPostfix);

        console.log(multisigAddress, orderId);

        if (multisigAddress === undefined) {
            alert('Invalid URL');
            showScreen('startScreen');
        } else {
            const newMultisigAddress = formatContractAddress(multisigAddress.address);
            await setMultisigAddress(newMultisigAddress, orderId);
            if (orderId !== undefined && (currentMultisigAddress === newMultisigAddress)) {
                await setOrderId(orderId, undefined);
            }
        }
    } else {
        tryLoadMultisigFromLocalStorage();
    }
}

processUrl();

window.onpopstate = () => processUrl();
