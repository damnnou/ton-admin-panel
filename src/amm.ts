import { OrderType } from "./orders"

import { RouterV3ContractConfig, routerv3ContractConfigToCell} from "./amm/RouterV3Contract";
import { ContractOpcodes } from "./amm/opCodes";
import { embedJettonData } from "./amm/nftContent";
import { packJettonOnchainMetadata } from "./amm/common/jettonContent";

import { contractDict } from "./contracts"
import { Address, beginCell, Cell, contractAddress, StateInit } from "@ton/core";
import { JettonMinter } from "./jetton/JettonMinter";
import { MyNetworkProvider } from "./utils/MyNetworkProvider";

/* Should make a class? */

export function ammOrderTypes(     
    IS_TESTNET : boolean
) : OrderType[]  
{
    return [
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
                price2reserve : { name: 'price.reserve0', type: 'BigInt' },
                
                controller: { name: 'Operator', type: 'Address' },
                nftName        : { name: 'NFT Name', type: 'String' },
                nftDescription : { name: 'NFT description', type: 'String' },
                nftImagePath   : { name: 'NFT Image URL', type: 'String' },
                nftCoverPath   : { name: 'NFT Cover URL', type: 'String' }

            },
            makeMessage: async (values, multisigAddress : Address) => {
                
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
                    cover_image : "https://tonco.io/static/tonco-cover.jpeg", 
                    image: "https://tonco.io/static/tonco-astro.png" 
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
                    image: "https://tonco.io/static/tonco-astro.png",
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
            name: 'Change Pool Controller',
            fields: {
                pool: {
                    name: 'Pool Address',
                    type: 'Address'
                },
                controller: {
                    name: 'Controller Address',
                    type: 'Address'
                },
                amount: {
                    name: 'TON Amount',
                    type: 'TON'
                },
            },
            makeMessage: async (values, multisigAddress : Address) => {
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: beginCell().endCell()
                };
            }
        },
        {
            name: 'Change Pool TickSpacing',
            fields: {
                pool: {
                    name: 'Pool Address',
                    type: 'Address'
                },
                tickSpacing: {
                    name: 'Tick Spacing',
                    type: 'BigInt'
                },
                amount: {
                    name: 'TON Amount',
                    type: 'TON'
                },
            },
            makeMessage: async (values, multisigAddress : Address) => {
                return {
                    toAddress: values.pool,
                    tonAmount: values.amount,
                    body: beginCell().endCell()
                };
            }
        },
        {
            name: 'Collect Pool Protocol Fee',
            fields: {
                pool: {
                    name: 'Pool Address',
                    type: 'Address'
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
            name: 'Change Pool Fee',
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
    ]
}