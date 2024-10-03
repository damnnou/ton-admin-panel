import { Address, beginCell, comment } from "@ton/core";
import { OrderType } from "./orders"
import { JettonMinter, LOCK_TYPES, lockTypeToInt } from "./jetton/JettonMinter";
import { MyNetworkProvider } from "./utils/MyNetworkProvider";
import { JettonWallet } from "./jetton/JettonWallet";

import { checkJettonMinterAdmin, checkJettonMinterNextAdmin } from "./index"

import { AMOUNT_TO_SEND, DEFAULT_AMOUNT, DEFAULT_INTERNAL_AMOUNT, MakeMessageResult } from "./orders"


export function jettonOrderTypes(     
    IS_TESTNET : boolean
) : OrderType[]  
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