import { OrderType } from "./orders"

import { RouterV3Contract, routerv3ContractCellToConfig, RouterV3ContractConfig, routerv3ContractConfigToCell} from "./amm/RouterV3Contract";
import { ContractOpcodes } from "./amm/opCodes";
import { packJettonOnchainMetadata, unpackJettonOnchainMetadata } from "./amm/common/jettonContent";

import { contractDict } from "./contracts"
import { Address, beginCell, Cell, contractAddress, MessageRelaxed, StateInit, toNano } from "@ton/core";
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider } from "./utils/MyNetworkProvider"

import { encodePriceSqrt, FEE_DENOMINATOR, getApproxFloatPrice } from "./amm/frontmath/frontMath"
import { PoolV3Contract } from "./amm/PoolV3Contract"

import { getJettonMetadata } from "./jettonCache"
import { formatAddressAndUrl } from "./utils/utils";


import { PTonMinterV2 } from "./amm/common/PTonMinterV2" 


import { setDeployedJson } from "./index"
import { pTonMinterAddress } from "./jettons";

export class AMMOrders {

    static getOrderTypes( IS_TESTNET : boolean ) : OrderType[]  
    {
        return [
            {
                name: 'Deploy Router',
                fields: {
                    amount: { name: 'TON Amount', type: 'TON', default : '0.1' },
                    nonce : { name: 'Nonce', type: 'BigInt' }
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    let buffer;
                    buffer = Buffer.from(contractDict["PoolV3Contract"], "base64")
                    let poolCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(contractDict["RouterV3Contract"], "base64")
                    let routerCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(contractDict["AccountV3Contract"], "base64")
                    let accountCell : Cell = Cell.fromBoc(buffer)[0]

                    buffer = Buffer.from(contractDict["PositionNFTV3Contract"], "base64")
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

                    console.log(" Pool Code Hash   :", "0x" + poolCell    .hash(0).toString("hex"))
                    console.log(" Router Code Hash :", "0x" + routerCell  .hash(0).toString("hex"))
                    console.log(" Account Code Hash:", "0x" + accountCell .hash(0).toString("hex"))
                    console.log(" NFT Code Hash    :", "0x" + positionCell.hash(0).toString("hex"))    

                    console.log(" Admin Address    :", "0x" + multisigAddress.toString())
                            
                    console.log(`We would deploy router to ${routerAddress}`)

                    return [
                    /* pTonWallet */
                    {
                        toAddress: {address: pTonMinterAddress, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: toNano(0.1),
                        body: PTonMinterV2.messageDeployWallet({ownerAddress : routerAddress}, multisigAddress)
                    },
                    {
                        toAddress: {address: routerAddress, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        init: routerStateInit,
                        body: beginCell().endCell()
                    }]
                }
            },

            {
                name: 'Change Router Admin',
                fields: {
                    router   : { name: 'Router', type: 'Address' },
                    amount   : { name: 'TON Amount', type: 'TON', default : '0.1' },
                    newAdmin : { name: 'New Admin', type: 'Address' }
                },
                makeMessage: async (values, multisigAddress : Address) => {
                    

                    return {
                        toAddress: {address: values.router.address, isTestOnly : IS_TESTNET, isBounceable: false},
                        tonAmount: values.amount,
                        body: RouterV3Contract.changeAdminMessage(values.newAdmin.address)
                    };
                }
            },

            {
                name: 'Deploy Pool',
                fields: {
                    amount: { name: 'TON Amount',     type: 'TON'     , default : "0.2" },
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
                    }
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
                    pool:        { name: 'Pool Address', type: 'Address' },
                    activeFee:   { name: 'Active Fee',   type: 'BigInt'  },
                    protocolFee: { name: 'Protocol Fee', type: 'BigInt'  },
                    amount:      { name: 'TON Amount',   type: 'TON'     },
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


    static async parseActionBody (msg: MessageRelaxed, isTestnet : boolean): Promise<string> 
    {

        if (msg.init) {
            const routerAddress = msg.info.dest as Address
            const targetAddrS = await formatAddressAndUrl(routerAddress, isTestnet)

            const routerCodeCell = msg.init.code
            const config : RouterV3ContractConfig = routerv3ContractCellToConfig(msg.init.data)

            const adminAddrS = await formatAddressAndUrl(config.adminAddress, isTestnet)
            let pTonWallet : Cell = Cell.fromBoc(Buffer.from(contractDict["pTonWallet"], "base64"))[0]
          
            /* */           
            const pTonMinter = PTonMinterV2.createFromAddress(pTonMinterAddress)
            const provider0 = new MyNetworkProvider(pTonMinterAddress, isTestnet)
            const pTonRouterWalletAddress = await  pTonMinter.getWalletAddress(provider0, routerAddress)

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
    
                    pTonMinter  : contractDict["pTonMinter"],
                    pTonWallet  : contractDict["pTonWallet"],           
                }              
            }
    
            setDeployedJson(JSON.stringify(addressList))

            return `Deploy contract to ${targetAddrS} <br>` + 
                `Admin:  ${adminAddrS} <br>` + 
                `<table>` +
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
            return `Order to deploy pTon Wallet for <br/>` + 
                   `Owner: ${ownerAddressS}`
        } catch (e) {
        }

        try {
            let p = RouterV3Contract.unpackChangeAdminMessage(cell)
            const newAdminS = await formatAddressAndUrl(p.newAdmin, isTestnet)
            return `Order to change admin for the Router <br/>` + 
                   `New Admin: ${newAdminS}`
        } catch (e) {
        }

        try {
            let p = RouterV3Contract.unpackDeployPoolMessage(cell)
    
            const jetton0MinterS = await formatAddressAndUrl(p.jetton0Minter, isTestnet)
            const jetton1MinterS = await formatAddressAndUrl(p.jetton1Minter, isTestnet)
    
            const jetton0WalletS = await formatAddressAndUrl(p.jetton0WalletAddr, isTestnet)
            const jetton1WalletS = await formatAddressAndUrl(p.jetton1WalletAddr, isTestnet)
    
    
            const controllerS = await formatAddressAndUrl(p.controllerAddress, isTestnet)
    
            const metadata0 = await getJettonMetadata(p.jetton0Minter, isTestnet)
            const metadata1 = await getJettonMetadata(p.jetton1Minter, isTestnet)
    
            const nftUnpack     = unpackJettonOnchainMetadata(p.nftContentPacked, false)
            const nftItemUnpack = unpackJettonOnchainMetadata(p.nftItemContentPacked, false)

            let order = PoolV3Contract.orderJettonId(p.jetton0WalletAddr, p.jetton1WalletAddr)
            let logicalJetton0 = order ? metadata0["symbol"] : metadata1["symbol"]
            let logicalJetton1 = order ? metadata1["symbol"] : metadata0["symbol"]

    
            return `Create New Pool For<br/>` + 
            `  <b>Minter1:</b> ${jetton0MinterS} &nbsp;<span><img src="${metadata0['image']}" width='24px' height='24px' > ${metadata0["symbol"]} - ${metadata0["name"]}</span><br/>` + 
            `  <b>Wallet1:</b> ${jetton0WalletS}<br/>` + 
            `  <br/>` +
            `  <b>Minter2:</b> ${jetton1MinterS} &nbsp;<span><img src="${metadata1['image']}" width='24px' height='24px' > ${metadata1["symbol"]} - ${metadata1["name"]}</span><br/>` + 
            `  <b>Wallet2:</b> ${jetton1WalletS}<br/>` + 
    
            `  Tick Spacing : ${p.tickSpacing}<br/>` +
            `  Price : ${p.sqrtPriceX96} ( 1&nbsp;${logicalJetton0} = ${getApproxFloatPrice(p.sqrtPriceX96)}&nbsp;${logicalJetton1} ) <br/>` +
    
            `  Controller :  ${controllerS}<br/>` +           
            `  NFT Collection:  <br/>`  + 
            `  <div><img src="${nftUnpack["cover_image"]}"  width="256px"></div>` +            
            `  <div class="pair_line_s">`+
            `  <ol>`  + 
                `  <li> ${nftUnpack["name"]} </li>`  + 
                `  <li> ${nftUnpack["description"]} </li>`  + 
                `  <li> <a href="${nftUnpack["image"]}"      >${nftUnpack["image"]}      </a> </li>`  + 
                `  <li> <a href="${nftUnpack["cover_image"]}">${nftUnpack["cover_image"]}</a> </li>`  + 
            `  </ol>` +
            `  <div><img src="${nftUnpack["image"]}" width="128px" ></div>` +
            `  </div> `+
            `          `+
            `  <div class="pair_line_s">`+
            `  <div>` +
            `  NFT Item:  <br/>`  + 
            `  <ol>`  + 
                `  <li> ${nftItemUnpack["name"]} </li>`  + 
                `  <li> ${nftItemUnpack["description"]} </li>`  + 
                `  <li> <a href="${nftItemUnpack["image"]}" >${nftItemUnpack["image"]} </a> </li>`  + 
                `  <li> ${nftItemUnpack["attributes"]} </li>`  + 
            `  </ol>` +
            `  </div>` +            
            `  <div><img src="${nftItemUnpack["image"]}" width="128px" ></div>` +
            `  </div> `;
        } catch (e) {
        }
    
        try {
            let p = PoolV3Contract.unpackReinitMessage(cell)
            return `Change pool parameters:<br/>` +
            `<ol>` +
            `  <li>Pool Active/Locked : ${p.activate_pool == undefined ? "unchanged" : p.activate_pool } </li> ` +
            `  <li>Pool Tick Spacing  : ${p.tickSpacing == undefined ? "unchanged" : p.tickSpacing } </li> ` +
            `  <li>Pool Price  : ${p.sqrtPriceX96 == undefined ? "unchanged" : p.sqrtPriceX96 } </li> ` +
            `  <li>Pool Controller  : ${p.controller == undefined ? "unchanged" : p.controller } </li> ` +
            `  <li>Pool Admin  : ${p.admin == undefined ? "unchanged" : p.controller } </li> ` +       
            `</ol>` 
    
        } catch (e) {
        }    
    
        try {
            let p = PoolV3Contract.unpackSetFeesMessage(cell)
    
            let baseFee     = p.lpFee    / FEE_DENOMINATOR * 100
            let activeFee   = p.currentFee / FEE_DENOMINATOR * 100
            let protocolFee = p.currentFee * p.protocolFee / (FEE_DENOMINATOR * FEE_DENOMINATOR) * 100
    
            console.log(`  Base Fee     : ${baseFee}%     Active Fee   : ${activeFee}%    Protocol Fee ${protocolFee}% `)    
    
            return `Change fees:<br/>` + 
            `<table>` +
            `<tr><td>Active fee   <td/> ${p.currentFee}  <td/> ${activeFee}   % <td/></tr>` + 
            `<tr><td>Base fee     <td/> ${p.lpFee}       <td/> ${baseFee}     % <td/></tr>` + 
            `<tr><td>Protocol Fee <td/> ${p.protocolFee} <td/> ${protocolFee} % <td/></tr>` + 
            `</table>`;
    
        } catch (e) {
        }   
    
        try {
            let p = PoolV3Contract.unpackCollectProtocolMessage(cell)
            return `Collect protocol fees`
        } catch (e) {
        }   
    
        
    
        throw new Error('Unsupported action')

    }
}