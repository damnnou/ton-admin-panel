import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, Slice } from "@ton/core";
import { ContractErrors, ContractOpcodes, OpcodesLookup } from "./opCodes";
import { ContractMessageMeta, DummyCell } from "./DummyCell";
import { nftContentPackedDefault, nftItemContentPackedDefault } from "./PoolV3Contract";
import { FEE_DENOMINATOR, IMPOSSIBLE_FEE } from "./frontmath/frontMath";

/** Initial data structures and settings **/
export type RouterV3ContractConfig = {    
    adminAddress : Address,  
    poolAdminAddress? : Address,  
    
    poolFactoryAddress : Address,      
    flags? : bigint,
    poolv3_code : Cell;    
    accountv3_code : Cell;
    position_nftv3_code : Cell;       
    nonce? : bigint;
}


export function routerv3ContractConfigToCell(config: RouterV3ContractConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.poolAdminAddress ?? config.adminAddress) 
        .storeAddress(config.poolFactoryAddress)
        .storeUint(config.flags ?? 0, 64)        
        .storeUint(0, 64)      

        .storeRef(beginCell()
            .storeRef(config.poolv3_code)
            .storeRef(config.accountv3_code)
            .storeRef(config.position_nftv3_code)
        .endCell())
        .storeRef(beginCell()
            .storeUint(0,1)
            .storeUint(0,2)
            .storeUint(0,64)
        .endCell())
        .storeUint(config.nonce ?? 0, 64)
    .endCell()    
}

export function routerv3ContractCellToConfig(c: Cell): RouterV3ContractConfig {
    let s : Slice = c.beginParse()

    const adminAddress : Address = s.loadAddress()
    const poolFactoryAddress : Address = s.loadAddress()
    const flags = s.loadUintBig(64)
    
    const seqno = s.loadUintBig(64)

    const subcodes = s.loadRef().beginParse();
    const poolv3_code         : Cell = subcodes.loadRef()
    const accountv3_code      : Cell = subcodes.loadRef()
    const position_nftv3_code : Cell = subcodes.loadRef()  
    
    let nonce : bigint | undefined = undefined
    if (s.remainingBits !=0 ) {
        nonce = s.loadUintBig(64)
    }

    return {adminAddress, poolFactoryAddress, flags, poolv3_code, accountv3_code, position_nftv3_code, nonce}
}

export class RouterV3Contract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}
  
    static createFromConfig(
        config: RouterV3ContractConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = routerv3ContractConfigToCell(config);
        const init = { code, data };
        const address = contractAddress(workchain, init);  
        return new RouterV3Contract(address, init);
    }
  
    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }


    static deployPoolMessage(
        jetton0WalletAddr: Address,
        jetton1WalletAddr: Address,
        tickSpacing : number,
        sqrtPriceX96: bigint,
        activatePool : boolean,        
        opts: {
            jetton0Minter?: Address,
            jetton1Minter?: Address,
            controllerAddress?: Address,

            nftContentPacked? : Cell,
            nftItemContentPacked? : Cell,

            protocolFee? : number,
            lpFee?       : number,
            currentFee?  : number,
        }
    ) : Cell
    {
      const msg_body : Cell = beginCell()
          .storeUint(ContractOpcodes.ROUTERV3_CREATE_POOL, 32) // OP code
          .storeUint(0, 64) // query_id        
          .storeAddress(jetton0WalletAddr)
          .storeAddress(jetton1WalletAddr)
          .storeUint(tickSpacing , 24)
          .storeUint(sqrtPriceX96, 160)
          .storeUint(activatePool ? 1 : 0, 1)
          .storeUint(opts.protocolFee ? opts.protocolFee  : IMPOSSIBLE_FEE , 16)
          .storeUint(opts.lpFee       ? opts.lpFee        : IMPOSSIBLE_FEE , 16)
          .storeUint(opts.currentFee  ? opts.currentFee   : IMPOSSIBLE_FEE , 16)

          .storeRef (opts.nftContentPacked     ?? nftContentPackedDefault)
          .storeRef (opts.nftItemContentPacked ?? nftItemContentPackedDefault)
          .storeRef (beginCell()
              .storeAddress(opts.jetton0Minter)
              .storeAddress(opts.jetton1Minter)
              .storeAddress(opts.controllerAddress)
          .endCell())
      .endCell();
      return msg_body;
    }

    /* We need to rework printParsedInput not to double the code */
    static unpackDeployPoolMessage( body : Cell) : {
        jetton0WalletAddr: Address,
        jetton1WalletAddr: Address,
        tickSpacing : number,
        sqrtPriceX96: bigint,
        activatePool : boolean,
        jetton0Minter?: Address,
        jetton1Minter?: Address,
        controllerAddress?: Address,

        nftContentPacked? : Cell,
        nftItemContentPacked? : Cell,

        protocolFee? : number,
        lpFee?       : number,
        currentFee?  : number,
    }
    {
        let s = body.beginParse()
        const op       = s.loadUint(32)
        if (op != ContractOpcodes.ROUTERV3_CREATE_POOL)
            throw Error("Wrong opcode")

        const query_id = s.loadUint(64)
        const jetton0WalletAddr = s.loadAddress()
        const jetton1WalletAddr = s.loadAddress()
        let tickSpacing = s.loadInt(24)
        let sqrtPriceX96 = s.loadUintBig(160)
        let activatePool = (s.loadUint(1) != 0)

        const protocolFeeV = s.loadUint(16)        
        const protocolFee = (protocolFeeV < IMPOSSIBLE_FEE) ? protocolFeeV : undefined        
        const lpFeeV       = s.loadUint(16)
        const lpFee = (lpFeeV < IMPOSSIBLE_FEE) ? lpFeeV : undefined        
        const currentFeeV  = s.loadUint(16)
        const currentFee = (currentFeeV < IMPOSSIBLE_FEE) ? currentFeeV : undefined        

        let nftContentPacked = s.loadRef()
        let nftItemContentPacked = s.loadRef()

        let s1 = s.loadRef().beginParse()
        let jetton0Minter = s1.loadAddress()
        let jetton1Minter = s1.loadAddress()
        let controllerAddress = s1.loadAddress()

        return {
            jetton0WalletAddr, jetton1WalletAddr,
            tickSpacing,
            sqrtPriceX96,
            activatePool,
            jetton0Minter,
            jetton1Minter,
            controllerAddress,    
            nftContentPacked,
            nftItemContentPacked,
            protocolFee,
            lpFee,
            currentFee
        }     
    }

    /* Deploy pool */  
    async sendDeployPool(
      provider: ContractProvider, 
      sender: Sender, 
      value: bigint, 
      jetton0WalletAddr: Address,
      jetton1WalletAddr: Address,
      tickSpacing : number,
      sqrtPriceX96: bigint,
      activatePool : boolean,
      opts: {
          jetton0Minter?: Address,
          jetton1Minter?: Address,
          controllerAddress?: Address,

          nftContentPacked? : Cell,
          nftItemContentPacked? : Cell,
          
          protocolFee? : number,
          lpFee?       : number,
          currentFee?  : number,
      }

    ) {
      const msg_body = RouterV3Contract.deployPoolMessage(jetton0WalletAddr, jetton1WalletAddr, tickSpacing, sqrtPriceX96, activatePool, opts)
      await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body });
    }


    async sendResetGas(provider: ContractProvider, sender: Sender, value: bigint) {
        const msg_body = beginCell()
            .storeUint(ContractOpcodes.ROUTERV3_RESET_GAS, 32) // OP code
            .storeUint(0, 64) // QueryID what for?
        .endCell();

        return await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body });
    }

    /* =============  CHANGE ADMIN =============  */

    static changeAdminStartMessage(newAdmin : Address | null) : Cell {
        let msg = beginCell()
            .storeUint(ContractOpcodes.ROUTERV3_CHANGE_ADMIN_START, 32) // OP code
            .storeUint(0, 64) // QueryID what for?
        if (newAdmin == null) {
            msg.storeUint(0,2)
        } else {
            msg.storeAddress(newAdmin)    
        }
        return msg.endCell();
    }

    static unpackChangeAdminStartMessage( body :Cell) : { newAdmin : Address | null }
    {
        let s = body.beginParse()
        const op       = s.loadUint(32)
        if (op != ContractOpcodes.ROUTERV3_CHANGE_ADMIN_START)
            throw Error("Wrong opcode")

        const query_id = s.loadUint(64)
        if (s.preloadUint(2) == 0) {
            return {newAdmin : null}    
        } 
        const newAdmin = s.loadAddress()
        return {newAdmin}
    }

    async sendChangeAdminStart(provider: ContractProvider, sender: Sender, value: bigint, newAdmin : Address) {
        const msg_body = RouterV3Contract.changeAdminStartMessage(newAdmin)
        return await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body });
    }

    static changeAdminCommitMessage() : Cell {
        let msg = beginCell()
            .storeUint(ContractOpcodes.ROUTERV3_CHANGE_ADMIN_COMMIT, 32) // OP code
            .storeUint(0, 64) // QueryID what for?
        .endCell()          
        return msg;
    }

    static unpackChangeAdminCommitMessage( body :Cell) : {  }
    {
        let s = body.beginParse()
        const op       = s.loadUint(32)
        if (op != ContractOpcodes.ROUTERV3_CHANGE_ADMIN_COMMIT)
            throw Error("Wrong opcode")
        const query_id = s.loadUint(64)
        return {}
    }

    async sendChangeAdminCommit(provider: ContractProvider, sender: Sender, value: bigint) {
        const msg_body = RouterV3Contract.changeAdminCommitMessage()
        return await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body });
    }

    /* =============  CHANGE PARAMS =============  */

    static changeRouterParamMessage(opts : {
        newPoolAdmin? : Address        
        newPoolFactory? : Address
        newFlags? : bigint
    } ) : Cell {
        return beginCell()
            .storeUint(ContractOpcodes.ROUTERV3_CHANGE_PARAMS, 32) // OP code
            .storeUint(0, 64) // QueryID what for?           
            .storeUint(opts.newFlags ? 1 : 0, 1)
            .storeUint(opts.newFlags ?? 0, 64)
            .storeUint(opts.newPoolFactory ? 1 : 0, 1)
            .storeAddress(opts.newPoolFactory ?? BLACK_HOLE_ADDRESS)
            .storeUint(opts.newPoolAdmin ? 1 : 0, 1)
            .storeAddress(opts.newPoolAdmin ?? BLACK_HOLE_ADDRESS)            
        .endCell();
    }

    static unpackChangeRouterParamMessage( body :Cell) : {
        newPoolAdmin? : Address        
        newPoolFactory? : Address
        newFlags? : bigint
    }
    {
        let s = body.beginParse()
        const op       = s.loadUint(32)
        if (op != ContractOpcodes.ROUTERV3_CHANGE_PARAMS)
            throw Error("Wrong opcode")

        const query_id = s.loadUint(64)
        const hasNewFlags = s.loadBit()                
        const newFlags = hasNewFlags ? s.loadUintBig(64) : undefined

        const hasPoolFactory = s.loadBit()        
        const newPoolFactory = hasPoolFactory ? s.loadAddress() : undefined

        const hasPoolAdmin = s.loadBit()
        const newPoolAdmin = hasPoolAdmin ? s.loadAddress() : undefined
        
        return {newPoolAdmin, newPoolFactory, newFlags}
    }

    async sendChangeRouterParams(provider: ContractProvider, sender: Sender, value: bigint, 
        opts : {
            newPoolAdmin? : Address        
            newPoolFactory? : Address
            newFlags? : bigint
        }
    ) {
        const msg_body = RouterV3Contract.changeRouterParamMessage(opts)
        return await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body });
    }

    /** Getters **/
    async getState(provider: ContractProvider) {
        const { stack } = await provider.get("getRouterState", []);
        return {
            admin       : stack.readAddress(),
            pool_admin  : stack.readAddress(),            
            pool_factory: stack.readAddress(),
            flags       : stack.readBigNumber(),
            pool_seqno  : stack.readBigNumber()
        }
    }
    
    async getAdminAddress(provider: ContractProvider) : Promise<Address> {
        const state = await this.getState(provider)
        return state.admin;
    }

    async getPoolFactoryAddress(provider: ContractProvider) : Promise<Address> {
        const state = await this.getState(provider)
        return state.pool_factory;
    }
  

    async getPoolAddress(provider: ContractProvider, jetton0WalletAddr: Address, jetton1WalletAddr: Address) : Promise<Address> {
      const { stack } = await provider.get("getPoolAddress", 
        [
          { type: 'slice', cell: beginCell().storeAddress(jetton0WalletAddr).endCell() },
          { type: 'slice', cell: beginCell().storeAddress(jetton1WalletAddr).endCell() }
        ]);
      return stack.readAddress();
    }


    async getChildContracts(provider: ContractProvider)  {
      const { stack } = await provider.get("getChildContracts", []);
      return {
          poolCode        : stack.readCell(),
          accountCode     : stack.readCell(),
          positionNFTCode : stack.readCell()
      };
    }
  

    async getPoolInitialData(provider: ContractProvider, jetton0WalletAddr: Address, jetton1WalletAddr: Address) : Promise<Cell> {
      const { stack } = await provider.get("getPoolInitialData", [
        { type: 'slice', cell: beginCell().storeAddress(jetton0WalletAddr).endCell() },
        { type: 'slice', cell: beginCell().storeAddress(jetton1WalletAddr).endCell() }
      ]);
      return stack.readCell();
    }

    async getPoolStateInit(provider: ContractProvider, jetton0WalletAddr: Address, jetton1WalletAddr: Address) : Promise<Cell> {
      const { stack } = await provider.get("getPoolStateInit", [
        { type: 'slice', cell: beginCell().storeAddress(jetton0WalletAddr).endCell() },
        { type: 'slice', cell: beginCell().storeAddress(jetton1WalletAddr).endCell() }
      ]);
      return stack.readCell();
    }


    public static RESULT_SWAP_OK = ContractErrors.POOLV3_RESULT_SWAP_OK;
    public static RESULT_BURN_OK = ContractErrors.POOLV3_RESULT_BURN_OK;

    static printParsedInput(body: Cell | DummyCell) : ContractMessageMeta[] {
        let result : ContractMessageMeta[] = []

        const OpLookup : {[key : number] : string} = OpcodesLookup
        let p = body.beginParse()        
        let op : number  = p.loadUint(32)
        console.log("op == ", OpLookup[op])

        p = body.beginParse()
        if (op == ContractOpcodes.JETTON_TRANSFER_NOTIFICATION)
        {          
            result.push({ name:`op`,            value: `${p.loadUint(32)  }`, type:`Uint(32) op`})  
            result.push({ name:`query_id`,      value: `${p.loadUint(64)  }`, type:`Uint(64) `})  
            result.push({ name:`jetton_amount`, value: `${p.loadCoins()   }`, type:`Coins() `})  
            result.push({ name:`from_user`,     value: `${p.loadAddress() }`, type:`Address() `})  

            let forwardPayload = p.loadMaybeRef()
            if (forwardPayload) {
                result.push({ name:`forward_payload`   , value: forwardPayload.toBoc().toString('hex') , type:`Cell(), Payload` })
            } else {
                result.push({ name:`forward_payload`   , value: `none` , type:`Cell()` })
            }
        }

        if (op == ContractOpcodes.ROUTERV3_CREATE_POOL)
        {        
            result.push({ name:`op`,               value: `${p.loadUint(32) }`, type:`Uint(32) op`, 
              comment : "Operation that deploys and inits new [Pool](pool.md) contract for two given jettons identified by their wallets. New pool would reorder the jettons to match the " + 
              "invariant `slice_hash(jetton0_address) > slice_hash(jetton1_address).`"})    
            result.push({ name:`query_id`,         value: `${p.loadUint(64) }`, type:`Uint(64) `  , comment : "queryid as of the TON documentation"}) 
            result.push({ name:`jetton_wallet0`,   value: `${p.loadAddress()}`, type:`Address()`  , comment: "Address of the jetton0 wallet. Used to compute pool address" })
            result.push({ name:`jetton_wallet1`,   value: `${p.loadAddress()}`, type:`Address()`  , comment: "Address of the jetton1 wallet. Used to compute pool address" })
            result.push({ name:`tick_spacing`,     value: `${p.loadInt(24)  }`, type:`Int(24)  `  , comment: "Tick spacing to be used in the pool"}) 
            result.push({ name:`initial_priceX96`, value: `${p.loadUintBig(160)}`, type:`Uint(160),PriceX96`, comment: "Initial price for the pool"}) 

            result.push({ name:`protocol_fee`,  value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: `Liquidity provider fee. base in FEE_DENOMINATOR parts. If value is more than ${FEE_DENOMINATOR} value would be default`}) 
            result.push({ name:`lp_fee_base`,   value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: `Protocol fee in FEE_DENOMINATOR. If value is more than ${FEE_DENOMINATOR} value would be default`}) 
            result.push({ name:`lp_fee_current`,value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: `Current value of the pool fee, in case of dynamic adjustment. If value is more than ${FEE_DENOMINATOR} value would be default`})

            p.loadRef()
            result.push({ name:`nftv3_content`   , value: `metadata` , type:`Cell(),Metadata` })
            p.loadRef()            
            result.push({ name:`nftv3item_content`,value: `metadata` , type:`Cell(),Metadata` })

            let p1 = p.loadRef().beginParse()
            result.push({ name:`jetton0_minter`,   value: `${p1.loadAddress()}`, type:`Address()`, comment: "Address of the jetton0 minter, used by indexer and frontend"})
            result.push({ name:`jetton1_minter`,   value: `${p1.loadAddress()}`, type:`Address()`, comment: "Address of the jetton1 minter, used by indexer and frontend"})
            if (p1.preloadUint(2) == 0) {
                result.push({ name:`controller_addr`,  value: `null`, type:`Address()`, comment: "Address that is allowed to change the fee. Can always be updated by admin"})
            } else {
                result.push({ name:`controller_addr`,  value: `${p1.loadAddress()}`, type:`Address()`})
            }
        }

        if (op == ContractOpcodes.POOLV3_FUND_ACCOUNT)
        {
            result.push({ name:`op`,            value: `${p.loadUint(32)    }`, type:`Uint(32) op`})  
            result.push({ name:`jetton_target_w`, value: `${p.loadAddress() }`, type:`Address() `})              
            result.push({ name:`enough0`,       value: `${p.loadCoins()     }`, type:`Coins()  `})  
            result.push({ name:`enough1`,       value: `${p.loadCoins()     }`, type:`Coins()  `})
            result.push({ name:`liquidity`,     value: `${p.loadUintBig(128)}`, type:`Uint(128)`}) 
            result.push({ name:`tickLower`,     value: `${p.loadInt(24)     }`, type:`Int(24)  `})
            result.push({ name:`tickUpper`,     value: `${p.loadInt(24)     }`, type:`Int(24)  `})
        }
        

        if (op == ContractOpcodes.ROUTERV3_PAY_TO)
        {          
            result.push({ name:`op`,              value: `${p.loadUint(32)    }`, type:`Uint(32) op`})  
            result.push({ name:`query_id`,        value: `${p.loadUintBig(64) }`, type:`Uint(64) `})             
            result.push({ name:`owner0`,          value: `${p.loadAddress()   }`, type:`Address()`})  
            result.push({ name:`owner1`,          value: `${p.loadAddress()   }`, type:`Address()`})  
            
            let exit_code = p.preloadUint(32)
            result.push({ name:`exit_code`,       value: `${p.loadUint(32)    }`, type:`Uint(32) `})  
            result.push({ name:`seqno`,           value: `${p.loadUintBig(64) }`, type:`Uint(64), Indexer`})  

            let hasCoinsInfo    = p.preloadBit();
            result.push({ name:`hasCoinsInfo`,       value: `${p.loadBoolean()  }`, type:`Boolean() `})  
            let hasIndexerInfo  = p.preloadBit();
            result.push({ name:`hasIndexerInfo`,     value: `${p.loadBoolean()  }`, type:`Boolean() `})  

            if (hasCoinsInfo) {
                let p1 = p.loadRef().beginParse()
                result.push({ name:`amount0`,         value: `${p1.loadCoins()   }`, type:`Coins()  `})  
                result.push({ name:`jetton0_address`, value: `${p1.loadAddress() }`, type:`Address()`})  
                result.push({ name:`amount1`,         value: `${p1.loadCoins()   }`, type:`Coins()  `})  
                result.push({ name:`jetton1_address`, value: `${p1.loadAddress() }`, type:`Address()`})      
            }
            
            if (hasIndexerInfo) {
                let p1 = p.loadRef().beginParse()

                if (exit_code == RouterV3Contract.RESULT_SWAP_OK) {
                    result.push({ name:`liquidity` ,           value: `${p1.loadUint(128)}`   , type:`Uint(128),Indexer`})   
                    result.push({ name:`price_sqrt`,           value: `${p1.loadUintBig(160)}`, type:`Uint(160),Indexer,PriceX96`}) 
                    result.push({ name:`tick`,                 value: `${p1.loadInt(24)  }`   , type:`Int(24),Indexer`})
                    result.push({ name:`feeGrowthGlobal0X128`, value: `${p1.loadInt(24)  }`   , type:`Int(256),Indexer`})
                    result.push({ name:`feeGrowthGlobal1X128`, value: `${p1.loadInt(24)  }`   , type:`Int(256),Indexer`})   
                }

                if (exit_code == RouterV3Contract.RESULT_BURN_OK) {
                    result.push({ name:`nftIndex`,        value: `${p1.loadUint(64) }`, type:`Uint(64),Indexer`})      
                    result.push({ name:`liquidityBurned`, value: `${p1.loadUint(128)}`, type:`Uint(128),Indexer`})                 
                    result.push({ name:`tickLower`,       value: `${p1.loadInt(24)  }`, type:`Int(24),Indexer`})
                    result.push({ name:`tickUpper`,       value: `${p1.loadInt(24)  }`, type:`Int(24),Indexer`})
                    result.push({ name:`tick`,            value: `${p1.loadInt(24)  }`, type:`Int(24),Indexer`})                
                }
            }
        }      

        if (op == ContractOpcodes.ROUTERV3_RESET_GAS) {
            result.push({ name:`op`,                value: `${p.loadUint(32)  }` , type:`Uint(32) op`})
        }

        if (op == ContractOpcodes.ROUTERV3_CHANGE_ADMIN_START) {
            result.push({ name:`op`,               value: `${p.loadUint(32)  }`  , type:`Uint(32) op`})
            result.push({ name:`new_admin`,        value: `${p.loadAddress() }`  , type:`Address()`})
        }

        if (op == ContractOpcodes.ROUTERV3_CHANGE_ADMIN_COMMIT) {
            result.push({ name:`op`,               value: `${p.loadUint(32)  }`  , type:`Uint(32) op`})
        }


        if (op == ContractOpcodes.POOLV3_SWAP)
        {      
            result.push({ name:`op`,                value: `${p.loadUint(32)  }`  , type:`Uint(32) op`, comment: "Computes the swap math, and issues a command to the router to send funds. Only would be accepted from the router"})  
            result.push({ name:`sender`,            value: `${p.loadAddress() }`  , type:`Address()`})  
            result.push({ name:`sqrtPriceLimitX96`, value: `${p.loadUintBig(160)}`, type:`Uint(160),PriceX96`}) 
            result.push({ name:`minOutAmount`     , value: `${p.loadCoins()  }`   , type:`Coins()  `})
            result.push({ name:`to_address`,        value: `${p.loadAddress() }`  , type:`Address()`})
            result.push({ name:`forward_amount`   , value: `${p.loadCoins()  }`   , type:`Coins()  `, comment : "Amount of ton that would be attached to forward payload"}) 
            let forwardPayload = p.loadMaybeRef()
            if (forwardPayload) {
                result.push({ name:`forward_payload`   , value: forwardPayload.toBoc().toString('hex') , type:`Cell(), Payload` })
            } else {
                result.push({ name:`forward_payload`   , value: `none` , type:`Cell()` })
            }       
        }      

        if (op == ContractOpcodes.JETTON_EXCESSES)
        {      
            result.push({ name:`op`,                value: `${p.loadUint(32)  }`  , type:`Uint(32) op`})  
            if (p.remainingBits != 0)
                result.push({ name:`seqno`,                value: `${p.loadUint(64)  }`  , type:`Uint(64), Indexer`})  
        }

        return result;

    }
}
