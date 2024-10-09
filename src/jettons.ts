import { Address, beginCell, Cell, comment, fromNano, MessageRelaxed } from "@ton/core";
import { OrderType } from "./orders"
import { intToLockType, JettonMinter, LOCK_TYPES, lockTypeToDescription, lockTypeToInt } from "./jetton/JettonMinter";
import { MyNetworkProvider } from "./utils/MyNetworkProvider";
import { JettonWallet } from "./jetton/JettonWallet";

import { checkJettonMinterAdmin, checkJettonMinterNextAdmin } from "./index"

import { DEFAULT_AMOUNT, DEFAULT_INTERNAL_AMOUNT, MakeMessageResult } from "./orders"
import { assert, formatAddressAndUrl, sanitizeHTML } from "./utils/utils";


export const pTonMinterAddress = Address.parse("EQBlde83gVhXQKGogwCxKbiyB37N5K0mX4YcC9XTR1iFX1iO")

export const jettonList = [
    /* That is a hack */
    {
        "name": "Router:Current",
        "minter": "kQBO-T0NCODKT87McOAK2Vb-Whx_jLFHU5NCDBJYkBcsiuTm"
    },
    {
      "name": "ALG_USD",
      "minter": "EQD8Hzc0JD808OAnCsnCea2_Fq4cNAiAhGo5KaXM-zt8HV5Q"
    },
    {
      "name": "ALG_ETH",
      "minter": "EQACEhh_dJzp3PPyEwwTfTy7Ub_f6Dt5FAKZq_t1Fqe2vaL2"
    },
    {
      "minter": "EQD9FPFbmlCMMyjKGDPQWvllCLUdjjxIFvu9UvL3H_WECs7o",
      "name": "A Coin",
      "wallet": "EQBcBGH6h8m0lZTmJnOJ_I82qYav74v2BpQSstMdgU8WQ_oL"
    },
    {
      "minter": "EQCDldcdLpTdm2BTcQS1DtU0Mf-GMywWkcuI2M6M3NBhwj8U",
      "name": "BTC",
      "wallet": "EQCnulYOsZT1Fqi-DF8iOWDY9avgm101AVZAzZVtIktQ8j91"
    },
    {
      "minter": "EQAVtn9uSMPZ4TXdhVNtlKpIJwNY56iD6ngn5bpMoUJDDcWO",
      "name": "USDC",
      "wallet": "EQBVXn8BYKm93XluQ0U9mrTUY_V5BKo5G0LDI1Q-TPLJxtZ-"
    },
    {
      "minter": "EQDeH8DU3t3-EmNvJQl2YnOvLMLTfODvhbTNsawu4UuZmG0n",
      "name": "USD",
      "wallet": "EQDerKwiEx1LGT28kdgVULNB87qpF9U2FAEvaHK_9ImFGeRo"
    },
    {
      "minter": "EQD-M4OwggbSkuzKGwVH0nYkVIibPGOOuIJUDvb9Po51u_bZ",
      "name": "ETH",
      "wallet": "EQDYWx6eFP4ODtN4jeUua07EbW_sEljqJGix5wngvzIw12Mj"
    },
    {
      "minter": "EQDDr_Jzy1Kj5tR3MdXkaeB6xKvldfSci8pswvzjEHoEMsYY",
      "name": "F3",
      "wallet": "EQA2si6bwFsZ8h6ObS1MglXcVUOQd1IVsvi6vsNjuS866xoZ"
    },
    {
      "minter": "EQBVdCFNMz19_KKpXS8elAMzf5xcxuEtuF-RWh2ALmfqsyDh",
      "name": "F18",
      "wallet": "EQBdJa4UZ2YEcAQNgySLnbJB8HSt-EHVdBWKKeU-MpVE2z9P"
    },
    {
      "minter": "EQBVdCFNMz19_KKpXS8elAMzf5xcxuEtuF-RWh2ALmfqsyDh",
      "name": "F18",
      "wallet": "EQBdJa4UZ2YEcAQNgySLnbJB8HSt-EHVdBWKKeU-MpVE2z9P"
    },
    {
      "minter": "EQD00XKMrx_6OaGfgOeMUl0pe0rvTQyuxi85pPbTAueQ70mB",
      "name": "F6",
      "wallet": "EQCGMuLk9pCi4llVL9xpwXE478crHowsnVOOiDjJgdCJU3DY"
    }
  ]




export class JettonOrders {


    static getOrderTypes( IS_TESTNET : boolean) : OrderType[]  
    {
        return [
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
                makeMessage: async (values, multisigAddress : Address) => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
                    const jettonMinterAddress: Address = values.jettonMinterAddress.address;
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
                    return {
                        toAddress: values.jettonMinterAddress,
                        tonAmount: DEFAULT_AMOUNT,
                        body: JettonMinter.mintMessage(values.toAddress.address, values.amount, values.jettonMinterAddress.address, multisigAddress, null, 0n, DEFAULT_INTERNAL_AMOUNT)
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
                    return {
                        toAddress: values.jettonMinterAddress,
                        tonAmount: DEFAULT_AMOUNT,
                        body: JettonMinter.forceBurnMessage(values.amount, values.fromAddress.address, multisigAddress, DEFAULT_INTERNAL_AMOUNT)
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
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
                makeMessage: async (values, multisigAddress : Address): Promise<MakeMessageResult> => {
                    return {
                        toAddress: values.jettonMinterAddress,
                        tonAmount: DEFAULT_AMOUNT,
                        body: JettonMinter.lockWalletMessage(values.userAddress.address, lockTypeToInt(values.newStatus), DEFAULT_INTERNAL_AMOUNT)
                    }
                }
            },
        ]
    }

    static async parseActionBody (msg: MessageRelaxed, isTestnet : boolean): Promise<string> 
    {
        const cell: Cell = msg.body

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

        throw new Error('Unsupported action')
    }

}