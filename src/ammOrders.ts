import { OrderType } from "./orders"

import { RouterV3Contract, routerv3ContractCellToConfig, RouterV3ContractConfig, routerv3ContractConfigToCell} from "./amm/RouterV3Contract-V1";
import { RouterV3Contract as RouterV3ContractV1_5 } from "./amm/RouterV3Contract";

import { ContractOpcodes } from "./amm/opCodes";
import { packJettonOnchainMetadata, unpackJettonOnchainMetadata } from "./amm/common/jettonContent";

import { ContractDict } from "./contracts"
import { Address, beginCell, Cell, contractAddress, ExternalAddress, fromNano, MessageRelaxed, StateInit } from "@ton/core";
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider } from "./utils/MyNetworkProvider"

import { encodePriceSqrt, FEE_DENOMINATOR, getApproxFloatPrice, TickMath } from "./amm/frontmath/frontMath"
import {  nftContentPackedDefault, PoolV3Contract, poolv3StateInitConfig } from "./amm/PoolV3Contract-V1"
import {  nftItemContentPackedDefault, PoolV3Contract as PoolV3ContractV1_5 } from "./amm/PoolV3Contract"

import { PoolFactoryContractConfig, poolFactoryContractConfigToCell } from "./amm/PoolFactoryContract"

import { getJettonMetadata, UnpackedMetadata } from "./jettonCache"
import { formatAddressAndUrl } from "./utils/utils"
import { poolSnippet } from "./snippets/poolSnippets"

import { PTonMinterV2 } from "./amm/common/PTonMinterV2" 

import { setDeployedJson } from "./index"
import { getJettonList, getPTonMinterAddress } from "./deployed";

import { getEmojiHash } from "./utils/visualHash"
import BigNumber from "bignumber.js";
import { BLACK_HOLE_ADDRESS } from "./amm/tonUtils";


function xorBuffers(buffers: Buffer[]): Buffer {
    const length = buffers[0].length;
    const result = Buffer.alloc(length);
  
    for (let i = 0; i < length; i++) {
        // Perform XOR for each corresponding byte from the buffers
        for (let j = 0; j < buffers.length; j++)
            result[i] = result[i] ^ buffers[j][i]
    }  
    return result;
}
 

export class AMMOrders {


    static prepareNFTContent () {
        
    }

    static getOrderTypes( IS_TESTNET : boolean ) : OrderType[]  
    {
        return [
            {
                name: `Deploy Router v=${ContractDict.emojiHash} (compiled ${ContractDict.date})`,
                fields: {
                    amountTW: { name: 'TON for pTon Wallet Deploy', type: 'TON', default : '0.05' },
                    amountRD: { name: 'TON Amount for Router'     , type: 'TON', default : '0.085' },
                    poolAdmin:   { name: 'Pool Admin Contract'    , type: 'Address' },                    
                    poolFactory: { name: 'Pool Factory Contract'  , type: 'Address', default : BLACK_HOLE_ADDRESS.toString()},    
                    timelockDelay : { name: 'Time Lock Delay', type: 'PositiveBigInt', default: IS_TESTNET ? (5n * 60n).toString() : (1n * 24n * 60n * 60n).toString() },
                    flags : { name: 'Flags', type: 'NaturalBigInt', default: '1' },
                    nonce : { name: 'Nonce', type: 'NaturalBigInt' }
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    let buffer;
                    buffer = Buffer.from(ContractDict["PoolV3Contract"], "base64")
                    let poolCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(ContractDict["RouterV3Contract"], "base64")
                    let routerCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(ContractDict["AccountV3Contract"], "base64")
                    let accountCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(ContractDict["PositionNFTV3Contract"], "base64")
                    let positionCell : Cell = Cell.fromBoc(buffer)[0]


                    let routerConfig : RouterV3ContractConfig = {
                        adminAddress : multisigAddress,
                        poolAdminAddress   : values.poolAdmin.address,
                        poolFactoryAddress : values.poolFactory.address,
                        flags : values.flags, 
                        timelockDelay : values.timelockDelay,                 
                        poolv3_code : poolCell,    
                        accountv3_code : accountCell,
                        position_nftv3_code : positionCell,     
                        nonce : values.nonce
                    }
                
                    const routerData: Cell = routerv3ContractConfigToCell(routerConfig);
                    const routerStateInit: StateInit = { data: routerData,  code: routerCell }
                    const routerAddress: Address = contractAddress(0, routerStateInit)

                    console.log(" Pool Code Hash   :", "0x" + poolCell    .hash(0).toString("hex"))
                    console.log(" Router Code Hash :", "0x" + routerCell  .hash(0).toString("hex"))
                    console.log(" Account Code Hash:", "0x" + accountCell .hash(0).toString("hex"))
                    console.log(" NFT Code Hash    :", "0x" + positionCell.hash(0).toString("hex"))    

                    console.log(" Admin Address    :", "0x" + multisigAddress.toString())
                            
                    console.log(`We would deploy router to ${routerAddress}`)

                    return [
                    /* pTonWallet */
                    {
                        toAddress: {address: getPTonMinterAddress(IS_TESTNET), isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amountTW,
                        body: PTonMinterV2.messageDeployWallet({ownerAddress : routerAddress}, multisigAddress)
                    },
                    {
                        toAddress: {address: routerAddress, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amountRD,
                        init: routerStateInit,
                        body: beginCell().endCell()
                    }]
                }
            },
            {
                name: `Deploy Pool Factory`,
                fields: {
                    amount: { name: 'TON Amount for Factory'     , type: 'TON', default : '0.08' },
                    router: { name: 'Router', type: 'Address'},
                    nonce : { name: 'Nonce', type: 'PositiveBigInt' }
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    let poolFactoryCell  : Cell = Cell.fromBoc(Buffer.from(ContractDict.PoolFactoryContract, "base64"))[0]
                    let factoryOrderCell : Cell = Cell.fromBoc(Buffer.from(ContractDict.FactoryOrderContract, "base64"))[0]
                    

                    const attributes = [ {"trait_type": "DEX", "value": "TONCO" }]

                    const nftDescr = "%N%\nThis NFT represents a liquidity position in a TONCO " + " pool. The owner of this NFT can modify or claim the rewards.\n";

                    let nftContentToPack : { [s: string]: string | undefined } =     {  
                        name   : "Pool Minter",
                        description : "TONCO Pool LP Minter for", 
                        cover_image : "https://tonco.io/static/tonco-cover.png", 
                        image: "https://tonco.io/static/tonco-logo-nft.png" 
                    }
                    const nftContentPacked: Cell = packJettonOnchainMetadata(nftContentToPack)
                
                    const nftItemContentToPack : { [s: string]: string | undefined } =     {  
                        name        :  "Pool Position", 
                        description :  nftDescr, 
                        image: "https://tonco.io/static/tonco-logo-nft.png",
                        attributes: JSON.stringify(attributes)
                    }
                    const nftItemContentPacked: Cell =  packJettonOnchainMetadata(nftItemContentToPack)


                    let poolFactoryConfig : PoolFactoryContractConfig = {
                        adminAddress  : multisigAddress,  
                        routerAddress : values.router.address,  

                        orderCode : factoryOrderCell,
                        nftv3Content  : nftContentPacked,
                        nftv3itemContent : nftItemContentPacked
                       
                    }
                
                    const poolFactoryData: Cell = poolFactoryContractConfigToCell(poolFactoryConfig);
                    const poolFactoryStateInit: StateInit = { data: poolFactoryData,  code: poolFactoryCell }
                    const poolFactoryAddress: Address = contractAddress(0, poolFactoryStateInit)

                    console.log(" Pool Factory Code Hash   :", "0x" + poolFactoryCell.hash(0).toString("hex"))
                    console.log(" Admin Address    :", "0x" + multisigAddress.toString())
                            
                    console.log(`We would deploy Pool Factory to ${poolFactoryAddress}`)

                    return [{
                        toAddress: {address: poolFactoryAddress, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amountRD,
                        init: poolFactoryStateInit,
                        body: beginCell().endCell()
                    }]
                }
            },
            {
                name: 'Collect Router Excess Gas',
                fields: {
                    pool:   { name: 'Router Address',  type: 'Address' },
                    amount: { name: 'TON Amount',    type: 'TON'     , default : "0.11"},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = beginCell()
                        .storeUint(ContractOpcodes.ROUTERV3_RESET_GAS, 32) // OP code
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
                name: 'Change Router Admin, Flags, Code (Start. Timelocked)',
                fields: {
                    router   : { name: 'Router', type: 'Address' },
                    amount   : { name: 'TON Amount', type: 'TON', default : '0.1' },
                    newAdmin : { name: 'New Admin ("addr_none()" for unchanged)', type: 'Address' },
                    newFlags : { name: 'New Flags (negative for unchanged)', type: 'BigInt', default : "-1" },
                    newCode  : { name: "Code For the router from Contracts.ts will be used if you type here <font color='red'>Nothing is true; everything is permitted.</font> ", type: 'String', default : "If it ain't broke, don't fix it." }
                    
                },
                makeMessage: async (values, multisigAddress : Address) => {

                    let codeCell  = undefined
                    if (values.newCode == "Nothing is true; everything is permitted.") {
                        codeCell = Cell.fromBase64(ContractDict.RouterV3Contract) 
                    }

                    return {
                        toAddress: {address: values.router.address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: RouterV3Contract.changeAdminStartMessage({
                            newAdmin: values.newAdmin.address,
                            newFlags: values.newFlags >= 0 ? values.newFlags : undefined,
                            newCode : codeCell
                        })
                    };
                }
            },
            {
                name: 'Change Router Admin, Flags, Code (Commit)',
                fields: {
                    router   : { name: 'Router', type: 'Address' },
                    amount   : { name: 'TON Amount', type: 'TON', default : '0.1' },
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    return {
                        toAddress: {address: values.router.address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: RouterV3Contract.changeAdminCommitMessage()
                    };
                }
            },
            {
                name: 'Change Router Params (Pool Admin, Pool Factory, Throttling)',
                fields: {
                    router   : { name: 'Router', type: 'Address' },
                    amount   : { name: 'TON Amount', type: 'TON', default : '0.1' },                    
                    newPoolAdmin   : { name: 'New Pool Admin ( addr_none() for unchanged)' , type: 'Address' },
                    newPoolFactory : { name: 'New Pool Factory ( addr_none() for unchanged)', type: 'Address' }, 
                    throttlingRate : { name: 'Update 1 day mint throttling rate (< 0 for unchanged)', type : 'BigInt', default: "-1" },
                    lastKnownHour  : { name: 'Last known hour for throttling (< 0 for unchanged)', type : 'BigInt', default: "-1" }

                },
                makeMessage: async (values, multisigAddress : Address) => {

                    const options = {                        
                            newPoolAdmin      : values.newPoolAdmin.address ? values.newPoolAdmin.address : undefined  ,
                            newPoolFactory    : values.newPoolFactory.address ? values.newPoolFactory.address : undefined ,
                            newThrottlingRate : values.throttlingRate < 0 ? undefined : values.throttlingRate,
                            newLastHour       : values.lastKnownHour < 0 ? undefined : values.lastKnownHour            
                        }
                    console.log(options)

                    return {
                        toAddress: {address: values.router.address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: RouterV3Contract.changeRouterParamMessage(options)
                    };
                }
            },       
            {
                name: 'EMERGENCY MODE ONLY: Transfer Coins from Router',
                fields: {
                    router   : { name: 'Router', type: 'Address' },
                    amount   : { name: 'TON Amount', type: 'TON', default : '0.1' },                    
                    jetton0Minter : { name: 'Jetton', type: 'Address' },
                    jetton0Amount : { name: 'Jetton Amount (in nano)', type: 'BigInt' }, 
                    jetton1Minter : { name: 'Jetton', type: 'Address' },
                    jetton1Amount : { name: 'Jetton Amount (in nano)', type: 'BigInt' }, 
                    target   : { name: 'Receiver', type: 'Address' }, 
                    
                },
                makeMessage: async (values, multisigAddress : Address) => {

                    const jettonMinterAddress0 = values.jetton0Minter.address
                    console.log(`Minter 0 ${jettonMinterAddress0}`)
                    const jetton0 : JettonMinter = JettonMinter.createFromAddress(jettonMinterAddress0)
                    const provider0 = new MyNetworkProvider(jettonMinterAddress0, IS_TESTNET)
                    const jetton0Wallet = await jetton0.getWalletAddress(provider0, values.router.address)
             
                    const jettonMinterAddress1 = values.jetton1Minter.address
                    console.log(`Minter 1 ${jettonMinterAddress1}`)
                    const jetton1 : JettonMinter = JettonMinter.createFromAddress(jettonMinterAddress1)
                    const provider1 = new MyNetworkProvider(jettonMinterAddress1, IS_TESTNET)
                    const jetton1Wallet = await jetton1.getWalletAddress(provider1, values.router.address)
             
                    let msg_body = RouterV3Contract.emergencyRecoveryMessage({
                        target0: values.target.address,
                        target1: values.target.address,
                        exit_code : 0xDEADBEEFn,
                        seqno : 0xFFFFFFFFFFFFFFFFn,
                        jetton0Amount : values.jetton0Amount,
                        jetton0Wallet : jetton0Wallet,
                        jetton1Amount : values.jetton1Amount,                        
                        jetton1Wallet : jetton1Wallet
                    })

                    return {
                        toAddress: {address: values.router.address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: msg_body
                    
                    };
                }
            },      
            {
                name: 'Deploy Pool (from SuperAdmin)',
                fields: {
                    amount: { name: 'TON Amount',     type: 'TON'     , default : "0.2" },
                    router: { name: 'Router Address', type: 'Address' , default : getJettonList(IS_TESTNET)[0].minter.toString()},

                    jetton0minter: { name: 'Jetton 0 minter', type: 'Address' },
                    jetton1minter: { name: 'Jetton 1 minter', type: 'Address' },

                    tickSpacing : { name: 'Tick Spacing', type: 'BigInt' , default : "1" },

                    price1reserve : { name: 'price.reserve1', type: 'BigInt' , default : "1" },
                    price0reserve : { name: 'price.reserve0', type: 'BigInt' , default : "1" },
                                       
                    controller     : { name: 'Controller', type: 'Address', /*default: getJettonList(IS_TESTNET).find(entry => {entry.name == "REX Multisig"}).toString()*/ },

                    activeFee:   { name: 'Active Fee'  , type: 'BigInt', default : "30"   },
                    protocolFee: { name: 'Protocol Fee', type: 'BigInt', default : "1000" },

                    nftName        : { name: 'NFT Name (empty for default)', type: 'String' },
                    nftDescription : { name: 'NFT description(empty for default)', type: 'String' },
                    nftImagePath   : { name: 'NFT Image URL', type: 'String' , default: "https://tonco.io/static/tonco-logo-nft.png"},
                    nftCoverPath   : { name: 'NFT Cover URL', type: 'String' , default: "https://tonco.io/static/tonco-cover.png"},
                    nftItemAttr    : { name: 'NFT Item Attributes (empty for default)', type: 'String'},

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

                    const poolStringName = `${metadata0["symbol"]}-${metadata1["symbol"]}`
                    let nftContentToPack : { [s: string]: string | undefined } =     {  
                        name   : "Pool Minter:" + poolStringName,
                        description : "TONCO Pool LP Minter for " + poolStringName, 
                        cover_image : values.nftCoverPath, 
                        image: values.nftImagePath 
                    }

                    const config = poolv3StateInitConfig(
                        jetton0Wallet, 
                        jetton1Wallet,
                        /* Fix this. Should use codes from the blockchain */
                        Cell.fromBoc(Buffer.from(ContractDict.AccountV3Contract    , "base64"))[0], 
                        Cell.fromBoc(Buffer.from(ContractDict.PositionNFTV3Contract, "base64"))[0],
                        values.router.address
                    )

                    const poolContract = PoolV3Contract.createFromConfig(config, Cell.fromBoc(Buffer.from(ContractDict.PoolV3Contract, "base64"))[0])
                
                    const nftDescr = "%N%\nThis NFT represents a liquidity position in a TONCO "+ poolStringName +" pool. The owner of this NFT can modify or claim the rewards.\n" + 
                    `Pool Address: ${poolContract.address}\n` + 
                    `${metadata0["symbol"]} Master Address: ${jetton0MinterAddress.toString()}\n` + 
                    `${metadata1["symbol"]} Master Address: ${jetton1MinterAddress.toString()}\n`

                    //const nftDescr = "LP Position that corresponds to your liquidity in the pool " + poolStringName
                    const attributes = [ 
                        {"trait_type": "DEX", "value": "TONCO" },
                    //    {"trait_type": "jetton0", "value": "TONCO" },
                    //    {"trait_type": "jetton1", "value": "TONCO" },
                    ]

                    const nftContentPacked: Cell = packJettonOnchainMetadata(nftContentToPack)
                
                    const nftItemContentToPack : { [s: string]: string | undefined } =     {  
                        name        : values.nftName        != "" ? values.nftName        : "Pool " + poolStringName +" Position", 
                        description : values.nftDescription != "" ? values.nftDescription : nftDescr, 
                        image: values.nftImagePath,
                        attributes: (values.nftItemAttr == "") ? JSON.stringify(attributes): values.nftItemAttr,
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

                            protocolFee : Number(values.protocolFee),
                            lpFee       : Number(values.activeFee),
                            currentFee  : Number(values.activeFee)
                        }
                    )

                    return {
                        toAddress: values.router,
                        tonAmount: values.amount,
                        body: msg_body
                    }
                }
            },
            {
                name: 'Change Pool Arbiter (from SuperAdmin)',
                fields: {
                    pool:    {name: 'Pool Address'   , type: 'Address'},
                    arbiter: {name: 'Arbiter Address', type: 'Address'},
                    amount:  {name: 'TON Amount'     , type: 'TON', default:"0.1"},
                },
                makeMessage: async (values, multisigAddress : Address) => {

                    const poolAddress = values.pool.address
                    const poolContract = new PoolV3Contract(poolAddress)
                    const provider = new MyNetworkProvider(poolAddress, IS_TESTNET)
                    const state = await poolContract.getPoolStateAndConfiguration(provider)
                    if (state.arbiter_address == null) {
                        throw Error("Your pool is not V1.5")
                    }             

                    const msg_body = RouterV3ContractV1_5.deployPoolMessage(
                        state.jetton0_wallet, 
                        state.jetton1_wallet, 
                        state.tick_spacing, 
                        state.price_sqrt, 
                        state.pool_active,
                        {
                            arbiter_address : values.arbiter.address,
                            nftContentPacked : Cell.EMPTY,
                            nftItemContentPacked : Cell.EMPTY
                        }
                    )
                    return {
                        toAddress: {address: state.router_address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: msg_body
                    }
                }
            },
            {
                name: '------- Pool Operations -------------',
                fields: {},
                makeMessage: async (values, multisigAddress : Address) => {
                    return {
                        toAddress: values.pool,
                        tonAmount: values.amount,
                        body: beginCell().endCell()
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
                name: 'Change Pool Admin',
                  description: "<font color='red'>" +
                    "This action is executed from admin and changes it to new value <br/>\n" + 
                    "To undo this action you would need the control over the new admin address or redeploy pool from router::admin"+
                    "</font>",
                fields: {
                    pool:   {name: 'Pool Address' , type: 'Address'},
                    admin:  {name: 'Admin Address', type: 'Address'},
                    amount: {name: 'TON Amount'   , type: 'TON'},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = PoolV3Contract.reinitMessage({admin : values.admin.address})
                    return {
                        toAddress: values.pool,
                        tonAmount: values.amount,
                        body: msg_body
                    }
                }
            },
            {
                name: 'Pool Hard Lock (Change admin to Blackhole)',
                description: "<font color='red'>" +
                    "This action is executed from admin and changes it to Blackhole <br/>\n" + 
                    "To undo this action you would need to redeploy pool from router::admin"+
                    "</font>",
                fields: {
                    pool:       {name: 'Pool Address'      , type: 'Address'},
                    amount:     {name: 'TON Amount'        , type: 'TON', default: "0.1"},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = PoolV3Contract.reinitMessage({admin: BLACK_HOLE_ADDRESS})
                    return {
                        toAddress: values.pool,
                        tonAmount: values.amount,
                        body: msg_body
                    }
                }
            },
            {
                name: 'Pool Soft Lock (From Controller/Pool Admin)',
                fields: {
                    pool:       {name: 'Pool Address'      , type: 'Address'},
                    amount:     {name: 'TON Amount'        , type: 'TON', default: "0.1"},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = PoolV3Contract.messageLockPool()
                    return {
                        toAddress: values.pool,
                        tonAmount: values.amount,
                        body: msg_body
                    }
                }
            },
            {
                name: 'Pool Soft UnLock (From Controller/Pool Admin)',
                fields: {
                    pool:       {name: 'Pool Address'      , type: 'Address'},
                    amount:     {name: 'TON Amount'        , type: 'TON', default: "0.1"},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = PoolV3Contract.messageUnlockPool()
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
                    amount:         { name: 'TON Amount',     type: 'TON', default : "0.02" },
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const reserve1 : bigint = BigInt(values.price1reserve)
                    const reserve0 : bigint = BigInt(values.price0reserve)
                    const sqrtPriceX96 : bigint = encodePriceSqrt(reserve1, reserve0)
                    console.log("Sqrt price :", sqrtPriceX96)
                    const msg_body = PoolV3Contract.reinitMessage({sqrtPriceX96 : sqrtPriceX96})
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
                    pool:        { name: 'Pool Address', type: 'Address', default : "30"},
                    activeFee:   { name: 'Active Fee'  , type: 'BigInt' , default : "30"},
                    protocolFee: { name: 'Protocol Fee', type: 'BigInt' , default : "1000" },
                    amount:      { name: 'TON Amount'  , type: 'TON' , default : "0.03"},
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
                name: 'Change NFT Collection Content',
                fields: {
                    pool:   { name: 'Pool Address', type: 'Address' },                
                    amount: { name: 'TON Amount', type: 'TON' },
                    nftName        : { name: 'NFT Name (empty for unchanged)', type: 'String' },
                    nftDescription : { name: 'NFT description(empty for unchanged)', type: 'String' },
                    nftImagePath   : { name: 'NFT Image URL', type: 'String' , default: "https://tonco.io/static/tonco-logo-nft.png"},
                    nftCoverPath   : { name: 'NFT Cover URL', type: 'String' , default: "https://tonco.io/static/tonco-cover.png"},
                },
                makeMessage: async (values, multisigAddress : Address) => {

                    const pool = new PoolV3Contract(values.pool.address)
                    const poolProvider = new MyNetworkProvider(values.pool.address, IS_TESTNET)
                    const poolCollection = await pool.getNFTCollectionContent(poolProvider)

                    const nftContent : {[x: string] : string} = unpackJettonOnchainMetadata(poolCollection.nftv3_content)

                    if (values.nftName != "") 
                        nftContent.name = values.nftName
                    if (values.nftDescription != "") 
                        nftContent.description = values.nftDescription
                    if (values.nftImagePath != "") 
                        nftContent.image = values.nftImagePath
                    if (values.nftCoverPath != "")
                        nftContent.cover_image = values.nftCoverPath

                    console.log(nftContent)

                    const nftContentPacked  = packJettonOnchainMetadata(nftContent)
                    const msg_body = PoolV3Contract.reinitMessage(
                        {nftContentPacked : nftContentPacked}
                    )
                    return {
                        toAddress: values.pool,
                        tonAmount: values.amount,
                        body: msg_body
                    };
                }
            },
            {
                name: 'Change NFT Item Content',
                fields: {
                    pool:   { name: 'Pool Address', type: 'Address' },                
                    amount: { name: 'TON Amount', type: 'TON' },
                    nftName        : { name: 'NFT Name (empty for unchanged)', type: 'String' },
                    nftDescription : { name: 'NFT description(empty for unchanged)', type: 'String' },
                    nftImagePath   : { name: 'NFT Image URL', type: 'String' , default: "https://tonco.io/static/tonco-logo-nft.png"}
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
                    amount: { name: 'TON Amount',    type: 'TON'     , default : "0.11"},
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
                name: 'Collect Pool Excess Gas',
                fields: {
                    pool:   { name: 'Pool Address',  type: 'Address' },
                    amount: { name: 'TON Amount',    type: 'TON'     , default : "0.11"},
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    const msg_body = beginCell()
                        .storeUint(ContractOpcodes.POOLV3_RESET_GAS, 32) // OP code
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

    static renderNFTContent (nftUnpack: {[x : string] : string}): string
    {
        return (
        `  NFT Collection:  <br/>`  + 
        `  <div><img src="${nftUnpack["cover_image"]}"  width="256px"></div>` +            
        `  <div class="pair_line_s">`+
        `  <ol>`  + 
            `  <li> <b>Name:</b> ${nftUnpack["name"]} </li>`  + 
            `  <li> <b>Description:</b> ${nftUnpack["description"]} </li>`  + 
            `  <li> <b>Image:</b> <a href="${nftUnpack["image"]}"      >${nftUnpack["image"]}      </a> </li>`  + 
            `  <li> <b>Cover Image:</b> <a href="${nftUnpack["cover_image"]}">${nftUnpack["cover_image"]}</a> </li>`  + 
        `  </ol>` +
        `  <div><img src="${nftUnpack["image"]}" width="128px" ></div>` +
        `  </div> `
        );
    }
    

    static async parseActionBody (msg: MessageRelaxed, isTestnet : boolean): Promise<string> 
    {
        let value = "?"
        if (msg.info.type == 'internal') {
            value = fromNano(msg.info.value.coins)
        }


        if (msg.init) {
            const routerAddress = msg.info.dest as Address
            const targetAddrS = await formatAddressAndUrl(routerAddress, isTestnet)

            const routerCodeCell = msg.init.code
            const config : RouterV3ContractConfig = routerv3ContractCellToConfig(msg.init.data)

            const adminAddrS = await formatAddressAndUrl(config.adminAddress, isTestnet)
            const poolFactoryAddrS = await formatAddressAndUrl(config.poolFactoryAddress, isTestnet)
            const flags = config.flags ?? 0
            const nonce = config.nonce ?? 0
            
            let pTonWallet : Cell = Cell.fromBoc(Buffer.from(ContractDict["pTonWallet"], "base64"))[0]
          
            /* */           
            const pTonMinterAddress = getPTonMinterAddress(isTestnet)
            const pTonMinter = PTonMinterV2.createFromAddress(pTonMinterAddress)
            const provider0 = new MyNetworkProvider(pTonMinterAddress, isTestnet)
            const pTonRouterWalletAddress = await  pTonMinter.getWalletAddress(provider0, routerAddress)

            const totalHash = xorBuffers([routerCodeCell.hash(0), config.poolv3_code.hash(0), config.accountv3_code.hash(0), config.position_nftv3_code.hash(0)])
            let shortHash = BigInt("0x" + totalHash.toString('hex')) % (2n ** 42n)
            const emojiHash = getEmojiHash(shortHash)

            const addressList = {
                router : routerAddress.toString(),   
                pTon : {
                    minter: pTonMinterAddress.toString(),
                    wallet: pTonRouterWalletAddress.toString()
                },
                code_base64 : {
                    router      : routerCodeCell             .toBoc().toString("base64"),
                    pool        : config.poolv3_code         .toBoc().toString("base64"),
                    account     : config.accountv3_code      .toBoc().toString("base64"),
                    positionnft : config.position_nftv3_code .toBoc().toString("base64"),
    
                    pTonMinter  : ContractDict["pTonMinter"],
                    pTonWallet  : ContractDict["pTonWallet"],           
                }, 
                code_hashes : {
                    router      : routerCodeCell             .hash().toString("hex"),
                    pool        : config.poolv3_code         .hash().toString("hex"),
                    account     : config.accountv3_code      .hash().toString("hex"),
                    positionnft : config.position_nftv3_code .hash().toString("hex"),
                    
                    emojiHash  : emojiHash
                }              
            }
    
            setDeployedJson(JSON.stringify(addressList, null, 2))


            return  `Spend ${value} TON <br/>` +            
                `Deploy contract to ${targetAddrS} <br>` + 
                `Admin:  ${adminAddrS} <br>` + 
                `PoolFactory:  ${poolFactoryAddrS} <br>` + 
                `Flags:  ${"0x" + flags.toString(16).padStart(16, "0")} <br>` + 
                `Timelock duration:  ${config.timelockDelay ? config.timelockDelay.toString() + "s" : "limited by contract (5m?)"} <br>` +
                `Nonce:  ${nonce} <br>` + 
                
                `<table>` +
                `<tr><td>Emoji hash:          <td/><font size="10">${emojiHash}</font><br></td></tr>` +
                `<tr><td>TONCO Release hash:  <td/><b><tt><font color="red">0x${totalHash.toString("hex")}</font></b></tt><br></td></tr>` +
                
                `<tr><td>Router Code hash:  <td/><b><tt>0x${routerCodeCell.hash(0).toString("hex")}             </b></tt><br></td></tr>` +
                `<tr><td>Pool Code hash:    <td/><b><tt>0x${config.poolv3_code.hash(0).toString("hex")}         </b></tt><br></td></tr>` +
                `<tr><td>Account Code hash: <td/><b><tt>0x${config.accountv3_code.hash(0).toString("hex")}      </b></tt><br></td></tr>` +
                `<tr><td>NFT Code hash:     <td/><b><tt>0x${config.position_nftv3_code.hash(0).toString("hex")} </b></tt><br></td></tr>` +
                `</table>` +
                `Nonce: ${config.nonce}`

            }

        const cell: Cell = msg.body
  
        try {
            let p = PTonMinterV2.unpackDeployWalletMessage(cell)
            const ownerAddressS = await formatAddressAndUrl(p.owner, isTestnet)

            return `Spend ${value} TON <br/>` +
                   `Order to deploy pTon Wallet for <br/>` + 
                   `Owner: ${ownerAddressS}`
        } catch (e) {
        }

        try {
            let p = RouterV3Contract.unpackChangeAdminStartMessage(cell)
            return `Order for a admin timelocked change for the Router <br/>` + 
                    `New Admin: ${(p.newAdmin) ? await formatAddressAndUrl(p.newAdmin, isTestnet) :  "unchanged"}</br>` +
                    `New Flags: ${(p.newFlags !== undefined) ? "0x" + p.newFlags.toString(16) : "unchanged"}</br>` +                     
                    ((p.newFlags) ? 
                    `&nbsp; Multihop    : ${(p.newFlags & 0x0001n) ? "ON" : "OFF" }  </br>` + 
                    `&nbsp; Shortcut    : ${(p.newFlags & 0x0002n) ? "ON" : "OFF" }  </br>` + 
                    `&nbsp; Direct Ton  : ${(p.newFlags & 0x0004n) ? "ON" : "OFF" }  </br>` + 
                    `&nbsp; Throttling  : ${(p.newFlags & 0x0008n) ? "ON" : "OFF" }  </br>` + 

                    `&nbsp; Emergency : ${(p.newFlags & 0x1000n) ? "ON" : "OFF" }  </br>`                      
                    : "" ) +
                    `New Code: ${p.newCode ? p.newCode.hash(0).toString("hex") : "unchanged" }</br>`                   
        } catch (e) {
        }

        try {
            let p = RouterV3Contract.unpackChangeAdminCommitMessage(cell)
            return `Order to commit admin changes after timelock for the Router <br/>` 
        } catch (e) {
        }


        try {
            let p = RouterV3Contract.unpackChangeRouterParamMessage(cell)
            const newPoolAdminS   = p.newPoolAdmin ?   await formatAddressAndUrl(p.newPoolAdmin, isTestnet) : "unchanged"
            const newPoolFactoryS = p.newPoolFactory ? await formatAddressAndUrl(p.newPoolFactory, isTestnet) : "unchanged"
            

            return `Order to change pool factory for the Router <br/>` +                   
                   `New Pool Admin:   ${newPoolAdminS} </br>` + 
                   `New Pool Factory: ${newPoolFactoryS} </br>` +
                   
                   `New Throttling Rate: ${p.newThrottlingRate ? p.newThrottlingRate : "unchanged" } </br>` +
                   `New Last Hour: ${p.newLastHour ? (p.newLastHour + " " + new Date(p.newLastHour * 60 * 60 * 1000).toString()) : "unchanged" } </br>` 
                   
        } catch (e) {
        }

        try {
            console.log("Checking for the deploy/reinit message")            
            let p = null
            let version = "none"
            let arbiterS = "not in message"

            try {
                p = RouterV3Contract.unpackDeployPoolMessage(cell)
                version = "V1"
            } catch {}

            if (p == null) {
                try {
                    p = RouterV3ContractV1_5.unpackDeployPoolMessage(cell)
                    version = "V1.5"
                    if (p.arbiterAddress) {
                        arbiterS = await formatAddressAndUrl(p.arbiterAddress, isTestnet)
                    }
                } catch {}
            }

            if (p == null) {
                throw Error ("Not a deploy message")
            }
    
            console.log("Unpacked message into", p)
            
            const jetton0MinterS = await formatAddressAndUrl(p.jetton0Minter, isTestnet)
            const jetton1MinterS = await formatAddressAndUrl(p.jetton1Minter, isTestnet)
    
            const jetton0WalletS = await formatAddressAndUrl(p.jetton0WalletAddr, isTestnet)
            const jetton1WalletS = await formatAddressAndUrl(p.jetton1WalletAddr, isTestnet)
    
    
            const controllerS = await formatAddressAndUrl(p.controllerAddress, isTestnet)            
           
           
            
            //const adminS      = await formatAddressAndUrl(p.adminAddress, isTestnet)
    
            let metadata0 : UnpackedMetadata = {"symbol" : "Not in request", "name" : "Not in request" ,"decimals" : "9", "image" : ""}
            let metadata1 : UnpackedMetadata = {"symbol" : "Not in request", "name" : "Not in request" ,"decimals" : "9", "image" : ""}
            
            if (p.jetton0Minter) {
                metadata0 = await getJettonMetadata(p.jetton0Minter, isTestnet)                       
            }
            if (p.jetton1Minter) {
                metadata1 = await getJettonMetadata(p.jetton1Minter, isTestnet)                       
            }        
           
            let order = PoolV3Contract.orderJettonId(p.jetton0WalletAddr, p.jetton1WalletAddr)
            let logicalJetton0Name = order ? metadata0["symbol"] : metadata1["symbol"]
            let logicalJetton1Name = order ? metadata1["symbol"] : metadata0["symbol"]
            let logicalDecimals0 = order ? metadata0["decimals"] : metadata1["decimals"]
            let logicalDecimals1 = order ? metadata1["decimals"] : metadata0["decimals"]

            const config = poolv3StateInitConfig(
                p.jetton0WalletAddr, 
                p.jetton1WalletAddr,
                /* Fix this. Should use codes from the blockchain */
                Cell.fromBoc(Buffer.from(ContractDict.AccountV3Contract    , "base64"))[0], 
                Cell.fromBoc(Buffer.from(ContractDict.PositionNFTV3Contract, "base64"))[0],
                msg.info.dest as Address
            )

            const poolContract = PoolV3Contract.createFromConfig(config, Cell.fromBoc(Buffer.from(ContractDict.PoolV3Contract, "base64"))[0])
            const poolContractAddressS =  await formatAddressAndUrl(poolContract.address, isTestnet)

            /* get router predition */
            let predictedPoolAddressS : string = "Can't fetch" 
            try {
                const router = new RouterV3Contract(msg.info.dest as Address) 
                const provider = new MyNetworkProvider(router.address, isTestnet)                                
                const predictedPoolAddress = await router.getPoolAddress(provider, p.jetton0WalletAddr, p.jetton1WalletAddr)
                predictedPoolAddressS =  await formatAddressAndUrl(predictedPoolAddress, isTestnet)
            } catch {}
 
            /* !!! We should check for injection in user data */
            let priceValue = getApproxFloatPrice(p.sqrtPriceX96) * (10 ** Number(logicalDecimals0)) / (10 ** Number(logicalDecimals1))
            let priceText = `1${logicalJetton0Name} =  ${priceValue}${logicalJetton1Name}`

            let baseFee     = p.lpFee    / FEE_DENOMINATOR * 100
            let activeFee   = p.currentFee / FEE_DENOMINATOR * 100
            let protocolFeeOfActive =  p.protocolFee / FEE_DENOMINATOR * 100
            let protocolFee = p.currentFee * p.protocolFee / (FEE_DENOMINATOR * FEE_DENOMINATOR) * 100

            let result =  `Create New Pool/Reinit old pool (contracts = ${version}) For<br/>` + 
            `  <b>Pool Address Guess:</b> ${poolContractAddressS} <br/>` +
            `  <b>Pool Address From Router</b> ${predictedPoolAddressS} <br/>` +
            `  <b>Minter1:</b> ${jetton0MinterS} &nbsp;<span><img src="${metadata0['image']}" width='24px' height='24px' > ${metadata0["symbol"]} - ${metadata0["name"]} [d:${metadata0["decimals"]}]</span><br/>` + 
            `  <b>Wallet1:</b> ${jetton0WalletS}<br/>` + 
            `  <br/>` +
            `  <b>Minter2:</b> ${jetton1MinterS} &nbsp;<span><img src="${metadata1['image']}" width='24px' height='24px' > ${metadata1["symbol"]} - ${metadata1["name"]} [d:${metadata1["decimals"]}]</span><br/>` + 
            `  <b>Wallet2:</b> ${jetton1WalletS}<br/>` + 
    
            `  Tick Spacing : ${p.tickSpacing}<br/>` +
            `  Price : ${p.sqrtPriceX96} ( ${priceText} ) <br/>` +
    
            `  Controller :  ${controllerS}<br/>` +
            `  Arbiter :  ${arbiterS}<br/>` +

            //`  Admin :  ${adminS}<br/>` +

            `<table>` +
            `<tr><td>Active fee   <td/> ${p.currentFee}  <td/> | <td/>${activeFee}   % <td/></tr>` + 
            `<tr><td>Base fee     <td/> ${p.lpFee}       <td/> | <td/>${baseFee}     % <td/></tr>` + 
            `<tr><td>Protocol Fee <td/> ${p.protocolFee} <td/> | <td/>of current Fee ${protocolFeeOfActive} %, of swap amount ${protocolFee} % <td/></tr>` + 
            `</table>`;

            if (p.nftContentPacked)                
            {
                if (p.nftContentPacked.refs.length == 0 && p.nftContentPacked.bits.length == 0)
                {
                    result += "NFT Content: Unchanged <br/>"
                } else {
                    const nftUnpack     = unpackJettonOnchainMetadata(p.nftContentPacked, false)            
                    result += (this.renderNFTContent(nftUnpack)) 
                }
            }

            if (p.nftItemContentPacked)
            {
                if (p.nftItemContentPacked.refs.length == 0 && p.nftItemContentPacked.bits.length == 0)
                {
                    result += "NFT Item: Unchanged <br/>"
                } else {
                    const nftItemUnpack = unpackJettonOnchainMetadata(p.nftItemContentPacked, false)
                    result +=
                    `          `+
                    `  <div class="pair_line_s">`+
                    `  <div>` +
                    `  NFT Item:  <br/>`  + 
                    `  <ol>`  + 
                        `  <li>  <b>Name:</b> ${nftItemUnpack["name"]} </li>`  + 
                        `  <li> <b>Description:</b> ${nftItemUnpack["description"]} </li>`  + 
                        `  <li> <b>Image:</b>  <a href="${nftItemUnpack["image"]}" >${nftItemUnpack["image"]} </a> </li>`  + 
                        `  <li> <b>Attributes:</b> ${nftItemUnpack["attributes"]} </li>`  + 
                    `  </ol>` +
                    `  </div>` +            
                    `  <div><img src="${nftItemUnpack["image"]}" width="128px" ></div>` +
                    `  </div> `+
                    `  <div><pre>`;
                }
            }
            
            if ((p.jetton0Minter) && (p.jetton1Minter))
            {
                result +=
`<div class="jsoncode">` +
`{
    "address": "${poolContract.address}",
    "name": "${metadata0["symbol"]}-${metadata1["symbol"]}",
    "tickSpacing": ${p.tickSpacing},
    "jetton0": "${p.jetton0Minter}",
    "jetton1": "${p.jetton1Minter}",
    "isSwapped": ${!order}
}` +
`</div>` + 
            `</pre></div>`
            }

            return result;

        } catch (e) {
        }
    
        try {
            let p = PoolV3Contract.unpackReinitMessage(cell)
            let unpackedCollection 
            if (p.nftContentPacked) {
                unpackedCollection = unpackJettonOnchainMetadata(p.nftContentPacked, false)                 
            }

            let unpackedItem             
            if (p.nftItemContentPacked) {
                unpackedItem = unpackJettonOnchainMetadata(p.nftContentPacked, false)                 
            }

            // unpackJettonOnchainMetadata(p.nftItemContentPacked) }
            let priceInfo
            if (p.sqrtPriceX96 != undefined) {
                priceInfo = `1 Jetton0 = ${getApproxFloatPrice(p.sqrtPriceX96)} Jetton1  (tick = ${TickMath.getTickAtSqrtRatio(p.sqrtPriceX96)})`
            }


            let result = `Change pool parameters:<br/>` 
            result += await poolSnippet(msg.info.dest! as Address, isTestnet)

            result += `</br>`+ 
            `<ol>` +
            `  <li>Pool Active/Locked : ${p.activate_pool == undefined ? "unchanged" : p.activate_pool } </li> ` +
            `  <li>Pool Tick Spacing  : ${p.tickSpacing == undefined ? "unchanged" : p.tickSpacing } </li> ` +
            `  <li>Pool Price  : ${p.sqrtPriceX96 == undefined ? "unchanged" : ("" + p.sqrtPriceX96.toString() + "  (" + priceInfo + ")" )} </li> ` +
            `  <li>Pool Controller : ${p.controller == undefined ? "unchanged" : p.controller } </li> ` +
            `  <li>Pool Admin      : ${p.admin      == undefined ? "unchanged" : p.admin      } </li> ` +
            `  <li>Pool Arbiter    : ${p.arbiter    == undefined ? "unchanged" : p.arbiter    } </li> ` +            
            `  <li>Pool Collection Metadata : ${p.nftContentPacked == undefined ? "unchanged" : "CHANGED:" +  (this.renderNFTContent(unpackedCollection))} </li> ` +
            `  <li>NFT Item Metadata : ${p.nftItemContentPacked == undefined ? "unchanged" : "CHANGED:" + unpackedItem.toString() } </li> ` +            
            `</ol>` 
            return result
    
        } catch (e) {
        }    
    
        try {
            let p = PoolV3Contract.unpackSetFeesMessage(cell)
    
            let baseFee     = p.lpFee    / FEE_DENOMINATOR * 100
            let activeFee   = p.currentFee / FEE_DENOMINATOR * 100
            let protocolFeeOfActive =  p.protocolFee / FEE_DENOMINATOR * 100
            let protocolFee = p.currentFee * p.protocolFee / (FEE_DENOMINATOR * FEE_DENOMINATOR) * 100
    
            console.log(`  Base Fee     : ${baseFee}%     Active Fee   : ${activeFee}%    Protocol Fee ${protocolFee}% `)    
    
            let result = `Change fees for:<br/>` 
            result += await poolSnippet(msg.info.dest as Address, isTestnet)

            result += `<br/>` +
            `<table>` +
            `<tr><td>Active fee   <td/> ${p.currentFee}  <td/> | <td/>${activeFee}   % <td/></tr>` + 
            `<tr><td>Base fee     <td/> ${p.lpFee}       <td/> | <td/>${baseFee}     % <td/></tr>` + 
            `<tr><td>Protocol Fee <td/> ${p.protocolFee} <td/> | <td/>of current Fee ${protocolFeeOfActive} %, of swap amount ${protocolFee} % <td/></tr>` + 
            `</table>`;

            return result;
    
        } catch (e) {
        }   
    
        try {
            let p = PoolV3Contract.unpackCollectProtocolMessage(cell)
            let dest = msg.info.dest as Address
            let destS = await formatAddressAndUrl(dest, isTestnet)

            let result = `Collect protocol fees for ${destS} <br/>`
            try {              
                let poolAddress  = msg.info.dest as Address
                const poolContract = new PoolV3Contract(poolAddress)
                const providerPool = new MyNetworkProvider(poolAddress, isTestnet)
                const state = await poolContract.getPoolStateAndConfiguration(providerPool)
                
                const metadata0 = await getJettonMetadata(state.jetton0_minter, isTestnet)
                const metadata1 = await getJettonMetadata(state.jetton1_minter, isTestnet)    
                
                const minter0AddressS = await formatAddressAndUrl(state.jetton0_minter, isTestnet)
                const minter1AddressS = await formatAddressAndUrl(state.jetton1_minter, isTestnet)

                
                let jettonPrintable0 = BigNumber(state.collectedProtocolFee0.toString()).div(BigNumber(10).pow(BigNumber(metadata0.decimals))).toFixed(9)
                let jettonPrintable1 = BigNumber(state.collectedProtocolFee1.toString()).div(BigNumber(10).pow(BigNumber(metadata1.decimals))).toFixed(9)

                result += `(Current state, not at the execution moment) - Protocol fee to be collected <br/>\n` + 
                    `&nbsp; - ${jettonPrintable0} &nbsp; <span><img src="${metadata0['image']}" width='24px' height='24px' > ${metadata0["symbol"]} - ${metadata0["name"]} [d:${metadata0["decimals"]}]</span> <br/>\n` +
                    `&nbsp; - ${jettonPrintable1} &nbsp; <span><img src="${metadata1['image']}" width='24px' height='24px' > ${metadata1["symbol"]} - ${metadata1["name"]} [d:${metadata1["decimals"]}]</span> <br/>`
            } catch (e){
                result += "Pool state unknown (refresh page): " + e.toString()
            }

            return result
        } catch (e) {
        }   

        try {
            let p = PoolV3Contract.unpackLockPoolMessage(cell)
            let dest = msg.info.dest as Address
            let destS = await formatAddressAndUrl(dest, isTestnet)

            let result = `Soft <font color="red">Lock</font> pool &nbsp; ${destS} <br/>`
            result += await poolSnippet(dest, isTestnet)
            return result
        } catch (e) {
        }  

        try {
            let p = PoolV3Contract.unpackUnlockPoolMessage(cell)
            let dest = msg.info.dest as Address
            let destS = await formatAddressAndUrl(dest, isTestnet)
      
            let result = `Soft <font color="green">Unlock</font> pool &nbsp; ${destS} <br/>`
            result += await poolSnippet(dest, isTestnet)
            return result
        } catch (e) {
        }  

        try {

            let p = RouterV3Contract.unpackEmergencyRecoveryMessage(cell)
            let result : string = `Emergency transfer from router ${msg.info.dest!.toString()} <br/>` 

            try {              
                let routerAddress  = msg.info.dest as Address
                const router = new RouterV3Contract(routerAddress)
                const providerRouter = new MyNetworkProvider(routerAddress, isTestnet)
                const state = await router.getState(providerRouter)
                result += (state.flags & 0x1001n) ? "<font color='red'>EMERGENCY MODE IS ON!<font>" : "emergency is off, this message would likely fail"
            } catch (e){
                result += "Router state unknown: " + e.toString()
            }
            result += "<br/>"


            if (p.target0 != null && !(ExternalAddress.isAddress(p.target0))) {
                const target = await formatAddressAndUrl(p.target0, isTestnet)
                const coinToTransfer = (Address.isAddress(p.jetton0Wallet)) ? await formatAddressAndUrl(p.jetton0Wallet, isTestnet) : "unknown"
                result += `Transfer to ${target} <br/> ` + 
                          `&nbsp; Amount in wei: ${p.jetton0Amount} <br/>` +
                          `&nbsp; Coin wallet : ${coinToTransfer} <br>`

            }
            if (p.target1 != null && !(ExternalAddress.isAddress(p.target1))) {
                const target = await formatAddressAndUrl(p.target1, isTestnet)
                const coinToTransfer = (Address.isAddress(p.jetton1Wallet)) ? await formatAddressAndUrl(p.jetton1Wallet, isTestnet) : "unknown"
                result += `Transfer to ${target} <br/> ` + 
                          `&nbsp; Amount in wei: ${p.jetton1Amount} <br/>` +
                          `&nbsp; Coin wallet : ${coinToTransfer} <br>`
            }
    

            return result



        } catch (e) {
        }   
    
        
    
        throw new Error('Unsupported action')

    }
}
