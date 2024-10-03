import { Address, beginCell, Cell,  Dictionary, DictionaryValue, Contract, contractAddress,  ContractProvider, Sender, SendMode, TupleReader } from "@ton/core";
import { ContractOpcodes, OpcodesLookup } from "./opCodes";
import { packJettonOnchainMetadata} from "./common/jettonContent";
import { ContractMessageMeta, DummyCell} from "./DummyCell";
  


export const BLACK_HOLE_ADDRESS  : Address = Address.parse("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c")
export const BLACK_HOLE_ADDRESS1 : Address = Address.parse("EQAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEOSs")
export const BLACK_HOLE_ADDRESS2 : Address = Address.parse("EQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAc3j")

/** Inital data structures and settings **/
export type PoolV3ContractConfig = {    
    router_address : Address;
    admin_address? : Address;

    lp_fee_base?  : number;
    protocol_fee? : number;

    jetton0_wallet : Address;
    jetton1_wallet : Address;

    tick_spacing?   : number;
    
    pool_active?    : boolean;
    tick?           : number;
    price_sqrt?     : bigint;
    liquidity?      : bigint;
    lp_fee_current? : number;

    accountv3_code : Cell;
    position_nftv3_code : Cell;   

    nftContent? : Cell;
    nftItemContent? : Cell;
};

export class TickInfoWrapper { 
    constructor(
        public liquidityGross : bigint = 0n,
        public liquidityNet : bigint = 0n,
        public outerFeeGrowth0Token : bigint = 0n,
        public outerFeeGrowth1Token : bigint = 0n
    )
    {}
};

const DictionaryTickInfo: DictionaryValue<TickInfoWrapper> = {
    serialize(src, builder) {
        builder.storeUint(src.liquidityGross, 256);
        builder.storeInt (src.liquidityNet, 128);
        builder.storeUint(src.outerFeeGrowth0Token, 256);
        builder.storeUint(src.outerFeeGrowth1Token, 256);        
    },
    parse(src) {
      let tickInfo = new TickInfoWrapper();
      tickInfo.liquidityGross = src.loadUintBig(256);
      tickInfo.liquidityNet   = src.loadIntBig(128);
      tickInfo.outerFeeGrowth0Token = src.loadUintBig(256);
      tickInfo.outerFeeGrowth1Token = src.loadUintBig(256);      
      return tickInfo;
    }
}


export function embedJettonData (content :Cell, jetton0Name : string, decimals0: number,  jetton1Name : string, decimals1: number): Cell {
    let p = content.beginParse()

    //console.log("embedJettonData l0 ", Buffer.from(jetton0Name).length )
    //console.log("embedJettonData l1 ", Buffer.from(jetton1Name).length )

    const result : Cell = beginCell()
        .storeInt (p.loadUint(8), 8)
        .storeMaybeRef (p.loadRef())
        .storeUint(decimals0,6)
        .storeUint(Buffer.from(jetton0Name).length, 8)
        .storeBuffer(Buffer.from(jetton0Name))
        .storeUint(decimals1,6)
        .storeUint(Buffer.from(jetton1Name).length, 8)
        .storeBuffer(Buffer.from(jetton1Name))
    .endCell();
    return result;
}


export let nftContentToPack : { [s: string]: string | undefined } = {  
    name   : "AMM Pool Minter", 
    description : "AMM Pool LP Minter", 
    cover_image : "https://tonco.io/static/tonco-cover.jpeg", 
    image: "https://tonco.io/static/tonco-astro.png" 
}


//export const nftContentPackedDefault: Cell =  embedJettonData(packJettonOnchainMetadata(nftContentToPack), "jetton0", 10, "jetton1", 11)
export const nftContentPackedDefault: Cell =  packJettonOnchainMetadata(nftContentToPack)


export let nftItemContentToPack : { [s: string]: string | undefined } = {  
    name   : "AMM Pool Position", 
    description : "LP Position", 
    image: "https://tonco.io/static/tonco-astro.png",
    //content_url : "https://tonco.io/static/tonco-astro.png", 
    //content_type : "image/png"
}


export const nftItemContentPackedDefault: Cell =  packJettonOnchainMetadata(nftItemContentToPack)

let nftItemContent1ToPack = "https://pimenovalexander.github.io/resources/icons/metadata.json"
//const nftItemContentPacked: Cell =  packOffchainMetadata (nftItemContent1ToPack)




export function poolv3ContractConfigToCell(config: PoolV3ContractConfig): Cell {
    let ticks = Dictionary.empty(Dictionary.Keys.Int(24), DictionaryTickInfo);
  
  
    return beginCell()
        .storeAddress(config.router_address)
        .storeUint   (config.lp_fee_base    ?? 30, 16)
        .storeUint   (config.protocol_fee   ?? 30, 16)
        .storeUint   (config.lp_fee_current ?? 30, 16)
        .storeAddress(config.jetton0_wallet)
        .storeAddress(config.jetton1_wallet)
        .storeUint   (config.tick_spacing ??  1, 24)
        .storeUint   (0, 64)   // poolv3::seqno

        .storeRef( beginCell()
            .storeUint(0n, 256) // poolv3::feeGrowthGlobal0X128  
            .storeUint(0n, 256) // poolv3::feeGrowthGlobal1X128  
            .storeUint(0n, 128) // poolv3::collectedProtocolFee0
            .storeUint(0n, 128) // poolv3::collectedProtocolFee1  

            .storeCoins(0n) // poolv3::reserve0
            .storeCoins(0n) // poolv3::reserve1
        .endCell())
        .storeRef( beginCell()
            .storeUint( 0 ,   1) 
            .storeInt (config.tick           ??  0,  24) 
            .storeUint(config.price_sqrt     ??  0, 160)
            .storeUint(config.liquidity      ??  0, 128) 
            .storeUint (0, 24)  // Occupied ticks

            .storeUint (0, 64)  // NFT Inital counter
            .storeUint (0, 64)  // NFT Active counter

            .storeAddress(config.admin_address ?? BLACK_HOLE_ADDRESS) 
            .storeAddress(BLACK_HOLE_ADDRESS) // poolv3::controller_address
            .storeRef( beginCell()
                .storeAddress(BLACK_HOLE_ADDRESS) // poolv3::jetton0_minter
                .storeAddress(BLACK_HOLE_ADDRESS) // poolv3::jetton1_minter
            .endCell())
          
        .endCell())      
        .storeRef( beginCell()
            .storeDict(ticks)         
        .endCell())
        .storeRef( beginCell()
            .storeRef(config.accountv3_code)
            .storeRef(config.position_nftv3_code)
            .storeRef(config.nftContent     ?? new Cell)
            .storeRef(config.nftItemContent ?? new Cell)
        .endCell())              
    .endCell();
}


type NumberedTickInfo = { 
    tickNum : number,
    liquidityGross : bigint,
    liquidityNet   : bigint,
    outerFeeGrowth0Token? : bigint,
    outerFeeGrowth1Token? : bigint 
}
  
  /** Pool  **/
export class PoolV3Contract implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}


    static orderJettonId(jetton0Wallet: Address, jetton1Wallet : Address ) : boolean
    {
        // let result1 =  beginCell().storeAddress(jetton0Wallet).endCell().hash() > beginCell().storeAddress(jetton1Wallet).endCell().hash()
        
        let strHex0 = beginCell().storeAddress(jetton0Wallet).endCell().hash().toString("hex");
        let strHex1 = beginCell().storeAddress(jetton1Wallet).endCell().hash().toString("hex");

        let result2 = BigInt("0x" + strHex0) > BigInt("0x" + strHex1)

        //if (result1 != result2) throw Error("Unexpected")

        return result2
    }

 
    static createFromConfig(
        config: PoolV3ContractConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = poolv3ContractConfigToCell(config);     
        const init = { code, data };
        const address = contractAddress(workchain, init);
    
        return new PoolV3Contract(address, init);
    }
  
    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint,         
        tickSpacing : number,
        sqrtPriceX96: bigint,
        
        opts: {
            activate_pool? : boolean, 

            jetton0Minter?: Address,
            jetton1Minter?: Address,
            admin? : Address,
            controller?: Address,

            nftContentPacked? : Cell,
            nftItemContentPacked? : Cell
        }
    
    ) {
        if (! opts.activate_pool) {
            opts.activate_pool = false;
        }

        let minterCell = null;
        if (opts.jetton0Minter && opts.jetton0Minter) {
            minterCell = beginCell()
                .storeAddress(opts.jetton0Minter)
                .storeAddress(opts.jetton1Minter)
           .endCell()
        }

        
        let body : Cell = beginCell()
            .storeUint(ContractOpcodes.POOLV3_INIT, 32) // OP code
            .storeUint(0, 64) // query_id
            .storeUint(opts.admin ? 1 : 0, 1)
            .storeAddress(opts.admin)                 // null is an invalid Address, but valid slice
            .storeUint(opts.controller ? 1 : 0, 1)
            .storeAddress(opts.controller)

            .storeUint(1, 1)            
            .storeUint(tickSpacing , 24)
            .storeUint(1, 1)            
            .storeUint(sqrtPriceX96, 160)
            .storeUint(1, 1)
            .storeUint(opts.activate_pool ? 1 : 0, 1)

            .storeRef(opts.nftContentPacked     ?? nftContentPackedDefault)
            .storeRef(opts.nftItemContentPacked ?? nftItemContentPackedDefault)
            .storeMaybeRef(minterCell)
        .endCell();
    
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async sendReinit(provider: ContractProvider, via: Sender, value: bigint,           
        opts: {
            activate_pool? : boolean, 
            tickSpacing?   : number,
            sqrtPriceX96?  : bigint,
    

            jetton0Minter? : Address,
            jetton1Minter? : Address,
            admin? : Address,
            controller?: Address,

            nftContentPacked? : Cell,
            nftItemContentPacked? : Cell
        }
    
    ) {
        let minterCell = null;
        if (opts.jetton0Minter && opts.jetton0Minter) {
            minterCell = beginCell()
                .storeAddress(opts.jetton0Minter)
                .storeAddress(opts.jetton1Minter)
           .endCell()
        }

        
        let body : Cell = beginCell()
            .storeUint(ContractOpcodes.POOLV3_INIT, 32) // OP code
            .storeUint(0, 64) // query_id
            .storeUint(opts.admin ? 1 : 0, 1)
            .storeAddress(opts.admin)                 // null is an invalid Address, but valid slice
            .storeUint(opts.controller == undefined ? 0 : 1, 1)
            .storeAddress(opts.controller)

            .storeUint(opts.tickSpacing == undefined ? 0 : 1, 1)
            .storeUint(opts.tickSpacing ?? 0, 24)
            .storeUint(opts.sqrtPriceX96 == undefined ? 0 : 1, 1)            
            .storeUint(opts.sqrtPriceX96 ?? 0, 160)
            .storeUint(opts.activate_pool == undefined ? 0 : 1, 1)
            .storeUint(opts.activate_pool ? 1 : 0, 1)

            .storeRef(opts.nftContentPacked     ?? beginCell().endCell())
            .storeRef(opts.nftItemContentPacked ?? beginCell().endCell())
            .storeMaybeRef(minterCell)
        .endCell();
    
        await provider.internal(via, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: body })
    }



    async sendSetFees(
        provider: ContractProvider, 
        sender: Sender, 
        value: bigint, 

        protocolFee: number,
        lpFee      : number,
        currentFee : number
    ) {
        const msg_body = beginCell()
            .storeUint(ContractOpcodes.POOLV3_SET_FEE, 32) // OP code
            .storeUint(0, 64) // query_id  
            .storeUint(protocolFee, 16)
            .storeUint(lpFee      , 16)        
            .storeUint(currentFee , 16)                
        .endCell()

        await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body })
    }

    async sendLockPool(provider: ContractProvider, sender: Sender, value: bigint) 
    {
        const msg_body = beginCell()
            .storeUint(ContractOpcodes.POOLV3_LOCK, 32) // OP code
            .storeUint(0, 64)                           // query_id  
        .endCell()
        await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body })
    }

    async sendUnlockPool(provider: ContractProvider, sender: Sender, value: bigint) 
    {
        const msg_body = beginCell()
            .storeUint(ContractOpcodes.POOLV3_UNLOCK, 32) // OP code
            .storeUint(0, 64)                             // query_id  
        .endCell()
        await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body })
    }

    async sendCollectProtocol(
        provider: ContractProvider, 
        sender: Sender, 
        value: bigint, 
    ) {
        const msg_body = beginCell()
            .storeUint(ContractOpcodes.POOLV3_COLLECT_PROTOCOL, 32) // OP code
            .storeUint(0, 64) // query_id          
        .endCell()

        await provider.internal(sender, { value, sendMode: SendMode.PAY_GAS_SEPARATELY, body: msg_body })
    }
     

    async sendBurn(
        provider: ContractProvider, 
        via: Sender, 
        value: bigint,
        nftIndex : bigint,
        tickLower : number,
        tickUpper : number,
        liquidity2Burn : bigint
    ) {
        await provider.internal(via, {
            value: value,
            body: beginCell()
                .storeUint(ContractOpcodes.POOLV3_START_BURN, 32) // op
                .storeUint(0, 64)                                 // query id
                .storeUint(nftIndex, 64)
                .storeUint(liquidity2Burn, 128)
                .storeInt(tickLower, 24)
                .storeInt(tickUpper, 24)                  
            .endCell()
        })
    }

   
    /** Getters **/
   
    async getIsActive(provider: ContractProvider) {
        const { stack } = await provider.get("getIsActive", []);
        return stack.readBoolean();
    }

    /* If not debug, it can actually would throw the exception */
    async getIsDebug(provider: ContractProvider) {
        try {
            const { stack } = await provider.get("isDebugBuild", [])
            return stack.readBoolean()
        } catch (err) {
            return false
        }
    }

    async getPoolStateAndConfiguration(provider: ContractProvider) {
      const { stack } = await provider.get("getPoolStateAndConfiguration", []);
   
      return {
          router_address     : stack.readAddress(),
          admin_address      : stack.readAddress(),
          controller_address : stack.readAddress(),

          jetton0_wallet : stack.readAddress(),
          jetton1_wallet : stack.readAddress(),

          jetton0_minter : stack.readAddress(),
          jetton1_minter : stack.readAddress(),

          pool_active    : stack.readBoolean(),   
          tick_spacing   : stack.readNumber(),   

          lp_fee_base    : stack.readNumber(),   
          protocol_fee   : stack.readNumber(),   
          lp_fee_current : stack.readNumber(),

          tick           : stack.readNumber(),   
          price_sqrt     : stack.readBigNumber(),   
          liquidity      : stack.readBigNumber(), 

          feeGrowthGlobal0X128  : stack.readBigNumber(), 
          feeGrowthGlobal1X128  : stack.readBigNumber(), 
          collectedProtocolFee0 : stack.readBigNumber(), 
          collectedProtocolFee1 : stack.readBigNumber(), 

          nftv3item_counter : stack.readBigNumber(),
          
          reserve0 : stack.readBigNumber(),
          reserve1 : stack.readBigNumber(),

          nftv3items_active : stack.readBigNumber(),
          ticks_occupied    :  stack.readNumber(),

          seqno    :  stack.readBigNumber(),
  
      }
    }

    /* This is ston.fi version of the data query */
    /* DEPRECATED
    async getPoolData(provider: ContractProvider) {
        const { stack } = await provider.get("get_pool_data", []);
    
        return {
            reserve0 : stack.readBigNumber(),
            reserve1 : stack.readBigNumber(),

            jetton0_wallet : stack.readAddress(),
            jetton1_wallet : stack.readAddress(),

            lp_fee_base    : stack.readNumber(),   
            protocol_fee   : stack.readNumber(),   
            lp_fee_current : stack.readNumber(),

            admin_address  : stack.readAddress(),

            collectedProtocolFee0 : stack.readBigNumber(), 
            collectedProtocolFee1 : stack.readBigNumber(), 
        }
    }
    */


    /* Tick related getters */
    /** 
     *  Returns a tick by tickNumber. If tick not inited - tick filled with zero will be returned.
     *  Also pervious tick and next tick numbers are returned
     *     
     *     
     *  @param provider   blockchain access provider
     *  @param tickNumber Tick to extract data for
     *  
     **/
    
    async getTickInfo(provider: ContractProvider, tickNumber : number) {

        const result = await this.getTickInfosFromArr(provider, tickNumber - 1, 1, false, true)
        if (result.length == 0 || result[0].tickNum != tickNumber)
            return new TickInfoWrapper()

        let tickInfo = new TickInfoWrapper();
        tickInfo.liquidityGross       = result[0].liquidityGross;
        tickInfo.liquidityNet         = result[0].liquidityNet;
        tickInfo.outerFeeGrowth0Token = result[0].outerFeeGrowth0Token ?? 0n;
        tickInfo.outerFeeGrowth1Token = result[0].outerFeeGrowth1Token ?? 0n;  
        return tickInfo
    }
    

    async getTickInfosAll(provider: ContractProvider) {
        const { stack } = await provider.get("getAllTickInfos", 
        []);
          
        if (stack.peek().type !== 'cell' ) { return [] }
        let valueReader = stack.readCell();

        const dict = Dictionary.loadDirect(Dictionary.Keys.Int(24), DictionaryTickInfo, valueReader)

        let result : NumberedTickInfo[] = [];

        let tickKeys = dict.keys()
        tickKeys.sort((a, b) => (a - b))
        for (let key of tickKeys) 
        {
            const info = dict.get(key)
            result.push({
                tickNum: key, 
                liquidityGross       :info!.liquidityGross, 
                liquidityNet         :info!.liquidityNet, 
                outerFeeGrowth0Token :info!.outerFeeGrowth0Token, 
                outerFeeGrowth1Token :info!.outerFeeGrowth1Token           
            });
        }
        return result;
    }

     /** 
     *  Returns a hash object of ticks infos with all internal data starting from key >=tickNumber  or key <= tickNumber
     *  and no more then number. Unfortunately there is an internal limit of 255 tickInfos
     * 
     *     
     *  @param provider   blockchain access provider
     *  @param tickNumber Starting tick. Ticks greater or equal will be returned with back == false, with back == true - less or equal keys will be enumerated  
     *  @param amount     Number of tick infos to be returned
     *  @param back       directions of ticks
     *  @param full       should fee related fields be filled
     * 
     *  
     **/
    async getTickInfosFromArr(provider: ContractProvider, tickNumber: number, amount: number, back : boolean = false, full : boolean = false) {
        const { stack } = await provider.get("getTickInfosFrom", 
        [
            {type: 'int', value: BigInt(tickNumber)},
            {type: 'int', value: BigInt(amount)},
            {type: 'int', value: BigInt(back ? 1 : 0)},
            {type: 'int', value: BigInt(full ? 1 : 0)},            
        ]);
          
        if (stack.peek().type !== 'tuple' ) { return [] }
        let valueReader = stack.readTuple();

        let result : NumberedTickInfo[] = [];

        while (valueReader.remaining) 
        {
            // console.log("Outer iteration")
            let internalReader = valueReader.readTuple();
            while (internalReader.remaining) 
            {
               // console.log("Inner iteration")
                const infoTuple = internalReader.readTuple();
                const tickInfo : NumberedTickInfo = 
                {
                    tickNum: infoTuple.readNumber(), 
                    liquidityGross :infoTuple.readBigNumber(), 
                    liquidityNet   :infoTuple.readBigNumber(),
                    outerFeeGrowth0Token : full ? infoTuple.readBigNumber() : 0n,
                    outerFeeGrowth1Token : full ? infoTuple.readBigNumber() : 0n,
                }
                result.push(tickInfo);
                
            }
        }
        return result;
    }



    async getMintEstimate(provider: ContractProvider, tickLower: number, tickUpper: number, liquidity: bigint )
    {
        const { stack } = await provider.get("getMintEstimate", 
        [
            {type: 'int', value: BigInt(tickLower)},
            {type: 'int', value: BigInt(tickUpper)},
            {type: 'int', value: BigInt(liquidity)}
        ]);
        return { amount0 : stack.readBigNumber(), amount1: stack.readBigNumber(), mintErrors : stack.readNumber() };
    }


    async getSwapEstimate(provider: ContractProvider, zeroForOne: boolean, amount: bigint, sqrtPriceLimitX96: bigint )
    {
        const { stack } = await provider.get("getSwapEstimate", 
        [
            {type: 'int', value: BigInt(zeroForOne ? 1 : 0)},
            {type: 'int', value: BigInt(amount)},
            {type: 'int', value: BigInt(sqrtPriceLimitX96)}
        ]);
        return { amount0 : stack.readBigNumber(), amount1: stack.readBigNumber() };
    }


    async getCollectedFees(provider: ContractProvider, tickLower:number, tickUpper: number, posLiquidityDelta :bigint, posFeeGrowthInside0X128:bigint, posFeeGrowthInside1X128 :bigint )
    {
        const { stack } = await provider.get("getCollectedFees", 
        [
            {type: 'int', value: BigInt(tickLower)},
            {type: 'int', value: BigInt(tickUpper)},
            {type: 'int', value: BigInt(posLiquidityDelta)},
            {type: 'int', value: BigInt(posFeeGrowthInside0X128)},
            {type: 'int', value: BigInt(posFeeGrowthInside1X128)}
        ]);
        return { amount0 : stack.readBigNumber(), amount1: stack.readBigNumber() };
    }

    
    async getFeeGrowthInside(provider: ContractProvider, 
        tickLower : number,
        tickUpper : number,
        tickCurrent : number,
        feeGrowthGlobal0X128 : bigint,
        feeGrowthGlobal1X128 : bigint,
    ) {
        const { stack } = await provider.get("getFeeGrowthInside", 
        [
            {type: 'int', value: BigInt(tickLower)},
            {type: 'int', value: BigInt(tickUpper)},
            {type: 'int', value: BigInt(tickCurrent)},
            {type: 'int', value: BigInt(feeGrowthGlobal0X128)},
            {type: 'int', value: BigInt(feeGrowthGlobal1X128)},  
        ])
        return {
            feeGrowthInside0X128 : stack.readBigNumber(),
            feeGrowthInside1X128 : stack.readBigNumber()
        }
    }


    /* Subcontracts getters */
    async getUserAccountAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('getUserAccountAddress', 
        [
            { type: 'slice', cell: beginCell().storeAddress(owner).endCell() }
        ])
        return res.stack.readAddress()
    }

    async getNFTAddressByIndex(provider: ContractProvider,  index: bigint ): Promise<Address>
    {
        const res = await provider.get('get_nft_address_by_index', 
        [       
            { type: 'int', value: BigInt(index)},
        ])
        return res.stack.readAddress()
    }

    async getNFTCollectionContent(provider: ContractProvider)
    {
        const res = await provider.get('get_collection_data', [])
        return { 
            nftv3item_counter: res.stack.readBigNumber(), 
            nftv3_content    : res.stack.readCell(), 
            router_address   : res.stack.readAddress() 
        }
    }
  
    async getNFTContent(provider: ContractProvider,  index: bigint, nftItemContent : Cell): Promise<Cell>
    {
        const res = await provider.get('get_nft_content', 
        [       
            { type: 'int' , value: BigInt(index) },
            { type: 'cell', cell: nftItemContent},
            
        ])
        return res.stack.readCell()
    }

    

    /* Access code of subcontracts */
    async getChildContracts(provider: ContractProvider)  {
        const { stack } = await provider.get("getChildContracts", []);
        return {
            accountCode     : stack.readCell(),
            positionNFTCode : stack.readCell(),
            nftCollectionContent : stack.readCell(),
            nftItemContent  : stack.readCell(),            
        };
    }


    /** 
    *  Debug methods to parse the message inputs
    *  This could be autogenerated
    **/

    static printParsedInput(body: Cell | DummyCell) : ContractMessageMeta[] 
    {
        let result : ContractMessageMeta[] = []

        const OpLookup : {[key : number] : string} = OpcodesLookup
        let p = body.beginParse()
        
        let op : number  = p.preloadUint(32)
        // console.log("op == ", OpLookup[op])
        p = body.beginParse()

        /*if (op == ContractOpcodes.POOLV3_DEPLOY)
        {        
            result.push({ name:`op`,          value: `${p.loadUint(32) }`, type:`Uint(32) op`})    
            result.push({ name:`query_id`,    value: `${p.loadUint(64) }`, type:`Uint(64) `}) 
            result.push({ name:`admin_addr`,  value: `${p.loadAddress()}`, type:`Address()`})
        }*/

        if (op == ContractOpcodes.POOLV3_INIT)
        {        
            result.push({ name:`op`,              value: `${p.loadUint(32) }`, type:`Uint(32) op`,   comment: "First mandatory operation that fills crucial parameters of the pool"})    
            result.push({ name:`query_id`,        value: `${p.loadUint(64) }`, type:`Uint(64) `  ,   comment : "queryid as of the TON documentation"}) 
            
            let has_admin = (p.preloadUint(1) == 1)            
            result.push({ name:`has_admin`,       value: `${p.loadInt (1)  }`, type:`UInt(1) `,      comment: "Flag that shows if this message have a new admin address"}) 
            if (has_admin) {
                result.push({ name:`admin_addr`,      value: `${p.loadAddress()}`, type:`Address()`, comment: "New address of the admin. If has_admin is false could be 00b"})
            }

            let has_controller = (p.preloadUint(1) == 1)
            result.push({ name:`has_controller`,  value: `${p.loadInt (1)  }`, type:`UInt(1) `,      comment: "Flag that shows if this message have a new controller address"}) 
            if (has_controller) {
                result.push({ name:`controller_addr`, value: `${p.loadAddress()}`, type:`Address()`, comment: "Address that is allowed to change the fee. Can always be updated by admin. If has_controller is false could be 00b"})
            }

            result.push({ name:`set_spacing`,     value: `${p.loadInt (1)  }`, type:`UInt(1) `  ,            comment: "Flag that shows if tick_spacing should be set to the pool or ignored"}) 
            result.push({ name:`tick_spacing`,    value: `${p.loadInt(24)  }`, type:`Int(24)   `,            comment: "Tick spacing to be used in the pool"}) 
            result.push({ name:`set_price`,       value: `${p.loadInt (1)  }`, type:`UInt(1) `  ,            comment: "Flag that shows if initial_priceX96 should be set to the pool or ignored"}) 
            result.push({ name:`initial_priceX96`,value: `${p.loadUintBig(160)}`, type:`Uint(160),PriceX96`, comment: "Initial price for the pool"}) 
            result.push({ name:`set_active` ,     value: `${p.loadInt (1)  }`, type:`UInt(1) `  ,            comment: "Flag that shows if pool_active should be set to the pool or ignored"}) 
            result.push({ name:`pool_active`,     value: `${p.loadInt (1)  }`, type:`UInt(1) `  ,            comment: "Flag is we should start the pool as unlocked"}) 

            p.loadRef()
            result.push({ name:`nftv3_content`     , value: `metadata` , type:`Cell(),Metadata` })
            p.loadRef()            
            result.push({ name:`nftv3item_content` , value: `metadata` , type:`Cell(),Metadata` })

            result.push({ name:`has_minters`,  value: `${p.loadInt(1)  }`, type:`UInt(1) `       , comment: "Flag that stores if this message has minters" }) 
            const p1 = p.loadRef().beginParse()
            
            result.push({ name:`jetton0_minter`,   value: `${p1.loadAddress()}`, type:`Address()`, comment: "Address of the jetton0 minter, used by indexer and frontend"})
            result.push({ name:`jetton1_minter`,   value: `${p1.loadAddress()}`, type:`Address()`, comment: "Address of the jetton1 minter, used by indexer and frontend"})
        }
        if (op == ContractOpcodes.POOLV3_SET_FEE)
        {
            result.push({ name:`op`,            value: `${p.loadUint(32) }`, type:`Uint(32) op`, comment: "This operation sets the fee values for the pool. This is allowed to do by the operator and the admin"})    
            result.push({ name:`query_id`,      value: `${p.loadUint(64) }`, type:`Uint(64) `  , comment: "queryid as of the TON documentation"}) 
            result.push({ name:`protocol_fee`,  value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: "Liquidity provider fee. base in FEE_DENOMINATOR parts"}) 
            result.push({ name:`lp_fee_base`,   value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: "Protocol fee in FEE_DENOMINATOR "}) 
            result.push({ name:`lp_fee_current`,value: `${p.loadUint(16) }`, type:`Uint(16) `  , comment: "Current value of the pool fee, in case of dynamic adjustment"}) 
        }

        if (op == ContractOpcodes.POOLV3_LOCK)
        {
            result.push({ name:`op`,            value: `${p.loadUint(32) }`, type:`Uint(32) op`, comment: "This operation locks the pool. This is allowed to do by the operator and the admin"})    
            result.push({ name:`query_id`,      value: `${p.loadUint(64) }`, type:`Uint(64) `  , comment: "queryid as of the TON documentation"}) 
        }
        
        if (op == ContractOpcodes.POOLV3_UNLOCK)
        {
            result.push({ name:`op`,            value: `${p.loadUint(32) }`, type:`Uint(32) op`, comment: "This operation unlocks the pool. This is allowed to do by the operator and the admin"})    
            result.push({ name:`query_id`,      value: `${p.loadUint(64) }`, type:`Uint(64) `  , comment: "queryid as of the TON documentation"}) 
        }

        if (op == ContractOpcodes.POOLV3_MINT)
        {
            result.push({ name:`op`,            value: `${p.loadUint(32) }`, type:`Uint(32) op`, comment : ""})    
            result.push({ name:`query_id`,      value: `${p.loadUint(64) }`, type:`Uint(64) `, comment : "queryid as of the TON documentation"}) 
            result.push({ name:`amount0Funded`, value: `${p.loadCoins()  }`, type:`Coins()  `, comment : "Amount of jetton 0 received by router for the mint"})
            result.push({ name:`amount1Funded`, value: `${p.loadCoins()  }`, type:`Coins()  `, comment : "Amount of jetton 1 recived by router for the mint"})
            result.push({ name:`recipient`,     value: `${p.loadAddress()}`, type:`Address()`, comment : "Address that would receive the minted NFT, excesses and refunds"})
            result.push({ name:`liquidity`,     value: `${p.loadUint(128)}`, type:`Uint(128)`, comment : "Amount of liquidity to mint"}) 
            result.push({ name:`tickLower`,     value: `${p.loadInt(24)  }`, type:`Int(24)  `, comment : "lower bound of the range in which to mint"})
            result.push({ name:`tickUpper`,     value: `${p.loadInt(24)  }`, type:`Int(24)  `, comment : "upper bound of the range in which to mint"})
        }

        if (op == ContractOpcodes.POOLV3_FUND_ACCOUNT)
        {          
            result.push({ name:`op`        , value: `${p.loadUint(32)  }`, type:`Uint(32) op`})  
            result.push({ name:`query_id`  , value: `${p.loadUint(64) }` , type:`Uint(64)  `, comment : "queryid as of the TON documentation"})
            result.push({ name:`owner_addr`, value: `${p.loadAddress()}` , type:`Address() `, comment : "Address that would receive the minted NFT, excesses and refunds"})    
            result.push({ name:`amount0`   , value: `${p.loadCoins()  }` , type:`Coins()   `}) 
            result.push({ name:`amount1`   , value: `${p.loadCoins()  }` , type:`Coins()   `}) 
            result.push({ name:`enough0`   , value: `${p.loadCoins()  }` , type:`Coins()   `}) 
            result.push({ name:`enough1`   , value: `${p.loadCoins()  }` , type:`Coins()   `}) 

            result.push({ name:`liquidity` , value: `${p.loadUint(128)}` , type:`Uint(128) `, comment : "Amount of liquidity to mint"})
            result.push({ name:`tickLower` , value: `${p.loadInt(24)  }` , type:`Int(24)   `, comment : "lower bound of the range in which to mint"}) 
            result.push({ name:`tickUpper` , value: `${p.loadInt(24)  }` , type:`Int(24)   `, comment : "upper bound of the range in which to mint"})          
        }

        if (op == ContractOpcodes.POOLV3_START_BURN)
        {
            result.push({ name:`op`             , value: `${p.loadUint(32) }` ,    type:`Uint(32) op`, 
                comment : "Burn whole or part of nft. Can be called by anyone, but if not called be the owner - would fail later. This operation would compute the amount of the fees that the position is eligible to get and " + 
                "then forwards a message to the [Position NFT](position\_nft.md) contract" }) 

            result.push({ name:`query_id`       , value: `${p.loadUint(64) }` ,    type:`Uint(64) `  , comment : "queryid as of the TON documentation"})  
            result.push({ name:`burned_index`   , value: `${p.loadUintBig(64)}` ,  type:`Uint(64) `  , comment : "Index if the NFT to burn"}) 
            result.push({ name:`liquidity2Burn` , value: `${p.loadUintBig(128)}` , type:`Uint(128)`  , comment : "Amount of the liquidity to burn, 0 is a valid amount, in this case only collected fees would be returned"})   
            result.push({ name:`tickLower`      , value: `${p.loadInt(24)  }` ,    type:`Int(24)  `  , comment : "Lower tick of the NFT. Should match the real one"}) 
            result.push({ name:`tickUpper`      , value: `${p.loadInt(24)  }` ,    type:`Int(24)  `  , comment : "Upper tick of the NFT. Should match the real one"})    
        }

        if (op == ContractOpcodes.POOLV3_BURN)
        {         
            result.push({ name:`op`             , value: `${p.loadUint(32)  }`,   type:`Uint(32) op`, comment : "Burn whole or part of nft. Is sent by [Position NFT](position\_nft.md) itself, would only be accepted from the correct NFT itself" })   
            result.push({ name:`query_id`       , value: `${p.loadUint(64) }` ,   type:`Uint(64) `,  comment : "queryid as of the TON documentation"})  
            result.push({ name:`recipient`      , value: `${p.loadAddress()}` ,   type:`Address()`, comment : "NFT owner to receive funds"})
            result.push({ name:`burned_index`   , value: `${p.loadUintBig(64)}` , type:`Uint(64) `, comment : "Index if the NFT to burn. Should match the sender address"}) 
            result.push({ name:`liquidity`      , value: `${p.loadUintBig(128)}`, type:`Uint(128)`, comment : "NFT liquidity amount prior to burn" })   
            result.push({ name:`tickLower`      , value: `${p.loadInt(24)  }` ,   type:`Int(24)  `, comment : "Lower tick of the NFT. Sanitized by NFTPosition  contract"}) 
            result.push({ name:`tickUpper`      , value: `${p.loadInt(24)  }` ,   type:`Int(24)  `, comment : "Upper tick of the NFT. Sanitized by NFTPosition  contract"})    
            result.push({ name:`liquidity2Burn` , value: `${p.loadUintBig(128)}`, type:`Uint(128)`, comment : "Amount of the liquidity to burn, 0 is a valid amount, in this case only collected fees would be returned"})   

            let p1 = p.loadRef().beginParse()
            result.push({ name:`feeGrowthInside0LastX128`, value: `${p1.loadUintBig(256)}`, type:`Uint(256)`})    
            result.push({ name:`feeGrowthInside1LastX128`, value: `${p1.loadUintBig(256)}`, type:`Uint(256)`})   
        }
        if (op == ContractOpcodes.POOLV3_SWAP)
        {       
            result.push({ name:`op`               , value: `${p.loadUint(32)}`    , type:`Uint(32) op`, comment: "Computes the swap math, and issues a command to the router to send funds. Only would be accepted from the router"})  
            result.push({ name:`query_id`         , value: `${p.loadUint(64)}`    , type:`Uint(64) `, comment : "queryid as of the TON documentation" })  
            result.push({ name:`source_wallet`    , value: `${p.loadAddress()}`   , type:`Address()`, comment : "jetton wallet attached to the router"})

            let p1 = p.loadRef().beginParse()
            result.push({ name:`amount`           , value: `${p1.loadCoins()  }`   , type:`Coins()  `, comment : "Input amount of the jettons to be swapped"}) 
            result.push({ name:`sqrtPriceLimitX96`, value: `${p1.loadUintBig(160)}`, type:`Uint(160),PriceX96`, comment : "Limit marginal price. Swap won't go beyond it."}) 
            result.push({ name:`minOutAmount`     , value: `${p1.loadCoins()  }`   , type:`Coins()  `, comment : "Minimum amount of the output jettons to get back. If not reached, your input would be returned to you"})
            result.push({ name:`from_real_user`   , value: `${p1.loadAddress()}`  , type:`Address() `})
        }

        return result;

    }
}