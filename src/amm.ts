import { OrderType } from "./orders"

import { RouterV3Contract, RouterV3ContractConfig, routerv3ContractConfigToCell} from "./amm/RouterV3Contract";
import { ContractOpcodes } from "./amm/opCodes";
import { packJettonOnchainMetadata, unpackJettonOnchainMetadata } from "./amm/common/jettonContent";

import { contractDict } from "./contracts"
import { Address, beginCell, Cell, contractAddress, StateInit } from "@ton/core";
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider } from "./utils/MyNetworkProvider"

import { encodePriceSqrt } from "./amm/frontmath/frontMath"
import { PoolV3Contract } from "./amm/PoolV3Contract"

import { getJettonMetadata } from "./jettonCache"

/* Should make a class? */

export function ammOrderTypes(     
    IS_TESTNET : boolean
) : OrderType[]  
{
    return [
        {
            name: 'Deploy Router',
            fields: {
                amount: { name: 'TON Amount', type: 'TON', default : '0.4' },
                nonce : { name: 'Nonce', type: 'BigInt' }
            },
            makeMessage: async (values, multisigAddress : Address) => {
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
                    adminAddress : multisigAddress,
            
                    poolv3_code : poolCell,    
                    accountv3_code : accountCell,
                    position_nftv3_code : positionCell,     
                    nonce : values.nonce
                }
            
                const routerData: Cell = routerv3ContractConfigToCell(routerConfig);
                const routerStateInit: StateInit = { data: routerData,  code: routerCell }
                const routerAddress: Address = contractAddress(0, routerStateInit)

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
            name: 'Change Router Admin',
            fields: {
                router   : { name: 'Router', type: 'Address' },
                amount   : { name: 'TON Amount', type: 'TON', default : '0.4' },
                newAdmin : { name: 'New Admin', type: 'Address' }
            },
            makeMessage: async (values, multisigAddress : Address) => {
                

                return {
                    toAddress: {address: values.router.address, isTestOnly : true, isBounceable: false},
                    tonAmount: values.amount,
                    body: RouterV3Contract.changeAdminMessage(values.newAdmin.address)
                };
            }
        },


        {
            name: 'Deploy Pool',
            fields: {
                amount: { name: 'TON Amount',     type: 'TON'     , default : "0.4" },
                router: { name: 'Router Address', type: 'Address' },

                jetton0minter: { name: 'Jetton 0 minter', type: 'Address' },
                jetton1minter: { name: 'Jetton 1 minter', type: 'Address' },

                tickSpacing : { name: 'Tick Spacing', type: 'BigInt' , default : "1" },

                price1reserve : { name: 'price.reserve1', type: 'BigInt' , default : "1" },
                price0reserve : { name: 'price.reserve0', type: 'BigInt' , default : "1" },
                
                controller     : { name: 'Controller', type: 'Address' },
                nftName        : { name: 'NFT Name (empty for default)', type: 'String' },
                nftDescription : { name: 'NFT description(empty for default)', type: 'String' },
                nftImagePath   : { name: 'NFT Image URL', type: 'String' , default: "https://tonco.io/static/tonco-astro.png"},
                nftCoverPath   : { name: 'NFT Cover URL', type: 'String' , default: "https://tonco.io/static/tonco-cover.jpeg"},
                nftItemAttr    : { name: 'NFT Item Attributes', type: 'String', default: '[ {"trait_type": "Brand", "value": "TONCO" } ]'},

            },
            makeMessage: async (values, multisigAddress : Address) => {
                
                const routerAddress = values.router.address

                const jetton0MinterAddress = values.jetton0minter.address
                console.log(`Minter 0 ${jetton0MinterAddress}`)
                const jetton0 : JettonMinter = JettonMinter.createFromAddress(jetton0MinterAddress)
                const provider0 = new MyNetworkProvider(jetton0MinterAddress, IS_TESTNET)
                const jetton0Wallet = await jetton0.getWalletAddress(provider0, routerAddress)
                console.log(`Wallet 0 ${jetton0Wallet} of ${routerAddress}`)

                const jetton1MinterAddress = values.jetton1minter.address
                console.log(`Minter 1 ${jetton1MinterAddress}`)
                const jetton1 : JettonMinter = JettonMinter.createFromAddress(jetton1MinterAddress)
                const provider1 = new MyNetworkProvider(jetton1MinterAddress, IS_TESTNET)
                const jetton1Wallet = await jetton1.getWalletAddress(provider1, routerAddress)
                console.log(`Wallet 1 ${jetton1Wallet} of ${routerAddress}`)

                const metadata0 = await getJettonMetadata(jetton0MinterAddress, IS_TESTNET)
                const metadata1 = await getJettonMetadata(jetton1MinterAddress, IS_TESTNET)

                console.log(metadata0)
                console.log(metadata1)

                let swapIds = PoolV3Contract.orderJettonId(jetton0Wallet, jetton1Wallet)

                const reserve1 = BigInt(values.price1reserve)
                const reserve0 = BigInt(values.price0reserve)
                let price = (! swapIds) ? encodePriceSqrt(reserve1, reserve0) : encodePriceSqrt(reserve0, reserve1)

                let poolStringName = `${metadata0["symbol"]}-${metadata1["symbol"]}`
                let nftContentToPack : { [s: string]: string | undefined } =     {  
                    name   : "Pool Minter:" + poolStringName,
                    description : "TONCO Pool LP Minter for ", 
                    cover_image : values.nftCoverPath, 
                    image: values.nftImagePath 
                }
            
                const nftContentPacked: Cell = packJettonOnchainMetadata(nftContentToPack)
            
                const nftItemContentToPack : { [s: string]: string | undefined } =     {  
                    name        : values.nftName        != "" ? values.nftName        : "Pool " + poolStringName +" Position", 
                    description : values.nftDescription != "" ? values.nftDescription : "LP Position that corresponds to your liquidity in the pool " + poolStringName, 
                    image: values.nftImagePath,
                    attributes: values.nftItemAttr,
                }
                const nftItemContentPacked: Cell =  packJettonOnchainMetadata(nftItemContentToPack)

                const msg_body = RouterV3Contract.deployPoolMessage(
                    jetton0Wallet,
                    jetton1Wallet,
                    values.tickSpacing,
                    price,
                    true,
                    {                       
                        jetton0Minter : jetton0MinterAddress,
                        jetton1Minter : jetton1MinterAddress,
                        nftContentPacked : nftContentPacked,
                        nftItemContentPacked : nftItemContentPacked,
                        controllerAddress : values.controller.address,
                    }
                )

                return {
                    toAddress: values.router,
                    tonAmount: values.amount,
                    body: msg_body
                };
            }
        },

        {
            name: 'Change Pool Controller',
            fields: {
                pool:       {name: 'Pool Address'      , type: 'Address'},
                controller: {name: 'Controller Address', type: 'Address'},
                amount:     {name: 'TON Amount'        , type: 'TON'},
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const msg_body = PoolV3Contract.reinitMessage({controller : values.controller.address})
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                }
            }
        },
        {
            name: 'Change Pool TickSpacing',
            fields: {
                pool:        { name: 'Pool Address', type: 'Address' },
                tickSpacing: { name: 'Tick Spacing', type: 'BigInt'},
                amount:      { name: 'TON Amount',   type: 'TON'},
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const msg_body = PoolV3Contract.reinitMessage({tickSpacing : values.tickSpacing})
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                }
            }
        },
        {
            name: 'Change Pool Price',
            fields: {
                pool:           { name: 'Pool Address',   type: 'Address' },
                price1reserve : { name: 'price.reserve1', type: 'BigInt' , default : "1" },
                price0reserve : { name: 'price.reserve0', type: 'BigInt' , default : "1" },
                amount:         { name: 'TON Amount',     type: 'TON'},
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const reserve1 = BigInt(values.price1reserve)
                const reserve0 = BigInt(values.price0reserve)
                const msg_body = PoolV3Contract.reinitMessage({sqrtPriceX96 : encodePriceSqrt(reserve1, reserve0)})
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                }
            }
        },     
        {
            name: 'Change Pool Fee',
            fields: {
                pool:        { name: 'Pool Address', type: 'Address' },
                activeFee:   { name: 'Active Fee'  , type: 'BigInt' },
                protocolFee: { name: 'Protocol Fee', type: 'BigInt' },
                amount:      { name: 'TON Amount'  , type: 'TON' },
            },
            makeMessage: async (values, multisigAddress : Address) => {
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: PoolV3Contract.messageSetFees(
                        Number(values.protocolFee), 
                        Number(values.activeFee), 
                        Number(values.activeFee)
                    )
                }
            }
        },
        {
            name: 'Change NFT Content',
            fields: {
                pool: {
                    name: 'Pool Address',
                    type: 'Address'
                },                
                amount: {
                    name: 'TON Amount',
                    type: 'TON'
                },
                nftName        : { name: 'NFT Name (empty for default)', type: 'String' },
                nftDescription : { name: 'NFT description(empty for default)', type: 'String' },
                nftImagePath   : { name: 'NFT Image URL', type: 'String' , default: "https://tonco.io/static/tonco-astro.png"},
                nftCoverPath   : { name: 'NFT Cover URL', type: 'String' , default: "https://tonco.io/static/tonco-cover.jpeg"},
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const msg_body = beginCell()
                    .storeUint(ContractOpcodes.POOLV3_COLLECT_PROTOCOL, 32) // OP code
                    .storeUint(0, 64) // query_id          
                .endCell();

                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                };
            }
        },
        {
            name: 'Change NFT Item',
            fields: {
                pool: {
                    name: 'Pool Address',
                    type: 'Address'
                },
                activeFee: {
                    name: 'Active Fee',
                    type: 'BigInt'
                },
                protocolFee: {
                    name: 'Protocol Fee',
                    type: 'BigInt'
                },
                amount: {
                    name: 'TON Amount',
                    type: 'TON'
                },
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const msg_body = beginCell()
                    .storeUint(ContractOpcodes.POOLV3_COLLECT_PROTOCOL, 32) // OP code
                    .storeUint(0, 64) // query_id          
                .endCell();

                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                };
            }
        },
        {
            name: 'Collect Pool Protocol Fee',
            fields: {
                pool:   { name: 'Pool Address',  type: 'Address' },
                amount: { name: 'TON Amount',    type: 'TON'     },
            },
            makeMessage: async (values, multisigAddress : Address) => {
                const msg_body = beginCell()
                    .storeUint(ContractOpcodes.POOLV3_COLLECT_PROTOCOL, 32) // OP code
                    .storeUint(0, 64) // query_id          
                .endCell();

                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: msg_body
                };
            }
        },
        {
            name: '--------------------',
            fields: {},
            makeMessage: async (values, multisigAddress : Address) => {
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: beginCell().endCell()
                };
            }
        }
    ]
}