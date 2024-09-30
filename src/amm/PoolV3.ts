import { Address, beginCell, Cell, toNano, internal, Contract, OpenedContract, Sender, WalletContractV4, fromNano } from "@ton/ton"
import { SandboxContract, TreasuryContract } from "@ton/sandbox"
import { KeyPair } from "@ton/crypto"

import { encodePriceSqrt, getApproxFloatPrice, TickMath } from "./frontmath/frontMath"
import { JettonWallet } from "./common/JettonWallet"
import { JettonAPI } from "./JettonAPI"
import { PoolV3Contract } from "./PoolV3Contract"
import { SqrtPriceMath } from "./frontmath/sqrtMath"
import { ContractOpcodes } from "./opCodes"
import { proxyWalletOpcodesV2, PTonWalletV2 } from "./3rd-party/PTonWalletV2"
import { RouterV3Contract } from "./RouterV3Contract"


type BlockchainProvider = (x : Contract ) => SandboxContract<Contract> | OpenedContract<Contract>

/*
   This class abstracts the Pool hiding the fact that pool may have intrenally exchanged two jettons 
*/
export class PoolV3 {

    public routerContract : SandboxContract<RouterV3Contract> | OpenedContract<RouterV3Contract>
    /*{
        address : Address,
        getPoolAddress : (jetton0WalletAddr: Address, jetton1WalletAddr: Address) => Promise<Address>
    }*/

    /* Jettons in the user specified order. (not in the pool order) */
    public jetton0 : JettonAPI
    public jetton1 : JettonAPI

    /* Jettons in the user specified order. (not in the pool order) */
    public routerWallet0? : any //JettonWallet | PTonWalletV2
    public routerWallet1? : any //JettonWallet | PTonWalletV2

    public poolAddress? : Address

    public poolContract? : SandboxContract<PoolV3Contract> | OpenedContract<PoolV3Contract>  
    public swapIds : boolean 

    public static gasUsage = {
        TRANSFER_GAS  : toNano(0.0407),
        MINT_GAS      : toNano(0.6),
        MINT_PART_GAS : toNano(0.2),
        
        SWAP_GAS_BASE : toNano(1.0),
        BURN_GAS      : toNano(0.5),

        SET_FEE_GAS   : toNano(0.1)
    }


    constructor(
            routerContract : any,
             /* Jettons in the user specified order. (not in the pool order) */
            jetton0Minter : JettonAPI,
            jetton1Minter : JettonAPI,        
    ) {
        this.routerContract = routerContract
        this.jetton0 = jetton0Minter
        this.jetton1 = jetton1Minter
        this.swapIds = false;
    }

    async initWrapper() {
       /* Fill internal structures */
       this.routerWallet0 = await this.jetton0.getWallet(this.routerContract.address);
       this.routerWallet1 = await this.jetton1.getWallet(this.routerContract.address);

       const address0 : Address = this.routerWallet0?.address!
       const address1 : Address = this.routerWallet1?.address!

       this.poolAddress = await this.routerContract.getPoolAddress(address0, address1)
       
       console.log(`Constructing pool wrapper from ${address0} ${address1} -> ${this.poolAddress}`)
       
       const order = PoolV3Contract.orderJettonId(address0, address1)  
       if (order)
       {
           this.swapIds = false;
           console.log("User jetton ids are NOT swapped by the pool")
       } else {
           this.swapIds = true;
           console.log("User jetton ids are swapped by the pool")
       } 
    }

    async openWrapper(providerFunction : any) {
        await this.initWrapper()
        if (this.poolAddress === undefined) {
            throw Error("Pool address is unknown")
        }
        this.poolContract = providerFunction(new PoolV3Contract(this.poolAddress!))
    }

    getPoolOrderJetton(id : number) {
        if (!this.swapIds) {
            return id == 0 ? this.jetton0 : this.jetton1
        } else {
            return id == 0 ? this.jetton1 : this.jetton0
        }
    }

    async deployPool(walletOpened : SandboxContract<WalletContractV4> | SandboxContract<TreasuryContract> | OpenedContract<WalletContractV4> , keys: KeyPair, 
        value: bigint, 
        tickSpacing : number,
        reserves : {reserve1? : bigint, reserve0?: bigint, price?: bigint},
        controllerAddress?: Address,
        nftContent? : Cell,
        nftItemContent? : Cell
    ) 
    {

        if (this.routerContract  === undefined) { throw Error("Call openWrapper() before mint(): this.poolContract  is undefined") }

        if (this.routerWallet0 === undefined) { throw Error("Call openWrapper() before initPool(): this.routerWallet0 is undefined") }
        if (this.routerWallet1 === undefined) { throw Error("Call openWrapper() before initPool(): this.routerWallet1 is undefined") }

        /* We need to review design */
        let sender : Sender
        
        if ('sender' in walletOpened && typeof walletOpened.sender === "function"){
            let senderRes = walletOpened.sender(keys.secretKey)       
            if ( "then" in senderRes &&  typeof senderRes.then === "function") {
                sender = (await senderRes).result
            }  else {
                sender = senderRes as Sender
            } 
        } else {            
            sender = (walletOpened as SandboxContract<TreasuryContract>).getSender()
        }

        let price = 0n
        if (reserves.price) {
            price = reserves.price
        } else {
            price = (! this.swapIds) ? encodePriceSqrt(reserves.reserve1!, reserves.reserve0!) : encodePriceSqrt(reserves.reserve0!, reserves.reserve1!);
        }

        let deployResult = await this.routerContract.sendDeployPool(
            sender, value, 
            this.routerWallet0.address,
            this.routerWallet1.address,
            tickSpacing,
            price,
            true,
            {
                jetton0Minter: this.jetton0.minterAddress, 
                jetton1Minter: this.jetton1.minterAddress, 
                controllerAddress: controllerAddress,
                nftContentPacked     : nftContent,
                nftItemContentPacked : nftItemContent
            }
        )
      
        return deployResult;
    } 


    estimateInputs(mintTickLower : number, mintTickUpper : number, mintLiquidity : bigint, currentPriceSqrt: bigint)
    {
        // user wants to mint the position at [mintTickLower, mintTickUpper] for the pair jetton0, jetton1
        // If the pool swap the ids in pool terms it is the position at [-mintTickUpper, -mintTickLower]

        let effectiveTickLower = !this.swapIds ? mintTickLower : -mintTickUpper;
        let effectiveTickUpper = !this.swapIds ? mintTickUpper : -mintTickLower;
        let tick = TickMath.getTickAtSqrtRatio(currentPriceSqrt)

        const priceMin = TickMath.getSqrtRatioAtTick(effectiveTickLower  );
        const priceMax = TickMath.getSqrtRatioAtTick(effectiveTickUpper);


        let jetton0Amount : bigint = 0n
        let jetton1Amount : bigint = 0n

        //console.log(`Pool price ${getApproxFloatPrice(currentPriceSqrt)}`)
        // Now all input is in pool terms.
        if (tick < effectiveTickLower) {
            jetton0Amount = SqrtPriceMath.getAmount0Delta(priceMin, priceMax, mintLiquidity, true);
        } 
        if ((effectiveTickLower <= tick) && (tick < effectiveTickUpper)) 
        {
            jetton0Amount = SqrtPriceMath.getAmount0Delta( currentPriceSqrt, priceMax, mintLiquidity, true);
            jetton1Amount = SqrtPriceMath.getAmount1Delta( priceMin, currentPriceSqrt, mintLiquidity, true);
        }
        if (effectiveTickUpper <= tick) {

            jetton1Amount = SqrtPriceMath.getAmount1Delta(priceMin, priceMax, mintLiquidity, true);
        } 

        // If pool swaps the jetton id we need to flip them back        
        if (this.swapIds) {
            [jetton0Amount, jetton1Amount] = [jetton1Amount, jetton0Amount]
        }

        return {
            jetton0Amount ,
            jetton1Amount ,
            effectiveTickLower ,
            effectiveTickUpper 
        }

    }

    /* 
        This functions creates two payloads that would be delivered to Router.
        Due to TON blockchain design there is no garantee which one will come first, 
        so they both have enough information to trigger a position mint.    
    */
    formPoolMintRequest(      
        routerWallet0Addr : Address, // Jetton Wallet attached to Router. Used to identify the pool and mint pair
        routerWallet1Addr : Address, // Jetton Wallet attached to Router. Used to identify the pool and mint pair
        jetton0Amount : bigint,
        jetton1Amount : bigint,
        mintLiquidity : bigint,
        tickLower     : number,
        tickUpper     : number        
    ) 
    {
        let part0 : Cell = 
            beginCell()
                .storeUint( ContractOpcodes.POOLV3_FUND_ACCOUNT, 32) // Request to minting part 1
                .storeAddress(routerWallet1Addr)            // Jetton1 Wallet attached to Router is used to identify target token. Note part0 has second token
                .storeCoins(jetton0Amount)                  // Jettons that would be transfered with this requset
                .storeCoins(jetton1Amount)
                .storeUint(mintLiquidity, 128)  // Liquidity. First transaction don't trigger to mint anything. NB! But we don't know which will arrive first
                .storeInt (tickLower,      24)  // Min tick.  
                .storeInt (tickUpper,      24)  // Max tick.  
            .endCell()    

        let part1 : Cell = 
            beginCell() 
                .storeUint( ContractOpcodes.POOLV3_FUND_ACCOUNT, 32) // Request to minting part 2
                .storeAddress(routerWallet0Addr)            // Jetton1 Wallet attached to Router is used to identify target token                  
                .storeCoins(jetton1Amount)
                .storeCoins(jetton0Amount)
                .storeUint(mintLiquidity, 128)  // Liquidity to mint 
                .storeInt (tickLower,      24)  // Min tick.  
                .storeInt (tickUpper,      24)  // Max tick.  
            .endCell()  

        return {part0, part1}
    }

    /** 
     *  Mints the position agnostic to the fact that jettons are swapped
     * 
     *  i.e if price on pool is 4000 that means thar first unit of jetton0 could be exchanged to ~4000 of jetton1
     * 
     *  @param walletOpened
     *  @param keys
     *   
     * 
     **/
    async mint(
        walletOpened : SandboxContract<WalletContractV4> | OpenedContract<WalletContractV4>, keys: KeyPair,
        mintTickLower : number, mintTickUpper : number, mintLiquidity : bigint, 
        slippageAdd? : {jetton0Slippage : bigint, jetton1Slippage : bigint}
    ) 
    {
        if (this.poolContract  === undefined) { throw Error("Call openWrapper() before mint(): this.poolContract  is undefined") }
        if (this.routerWallet0 === undefined) { throw Error("Call openWrapper() before mint(): this.routerWallet0 is undefined") }
        if (this.routerWallet1 === undefined) { throw Error("Call openWrapper() before mint(): this.routerWallet1 is undefined") }
       
        const userWallet0Addr = await this.jetton0.getWalletAddress(walletOpened.address);
        const userWallet1Addr = await this.jetton1.getWalletAddress(walletOpened.address);

        // We ask the pool for the price. Depending on the swap it could be the price 0 -> 1 exchange or vica versa
        // This is a async request to the pool, it's debatable if it should be brought to separate function
        const poolPriceAndLiq = await this.poolContract.getPoolStateAndConfiguration()
        const est = this.estimateInputs(mintTickLower, mintTickUpper, mintLiquidity, poolPriceAndLiq.price_sqrt)
        

        //console.log(`To mint the position [${est.effectiveTickLower}, ${est.effectiveTickUpper}] ${mintLiquidity} we will need:`)        
        //console.log(`  ${this.jetton0.isTonProxy ? "pTon   :" : "Jetton0:"} ${fromNano(est.jetton0Amount)} (${est.jetton0Amount}) + ${slippageAdd ? slippageAdd.jetton0Slippage : ""} for slippage`)
        //console.log(`  ${this.jetton1.isTonProxy ? "pTon   :" : "Jetton1:"} ${fromNano(est.jetton1Amount)} (${est.jetton1Amount}) + ${slippageAdd ? slippageAdd.jetton1Slippage : ""} for slippage`)

        if (slippageAdd) {
            est.jetton0Amount += slippageAdd.jetton0Slippage
            est.jetton1Amount += slippageAdd.jetton1Slippage
        }

        let poolMintRequest = this.formPoolMintRequest(
            this.routerWallet0.address,
            this.routerWallet1.address,
            est.jetton0Amount,
            est.jetton1Amount,
            mintLiquidity, est.effectiveTickLower, est.effectiveTickUpper
        )

        // TODO: It would be nice to make a loop here when all would be working. 
        // actually code below belongs to JettonWallet and pTopWallet classes

        // Depending on the position one or two coins could be sent
        let messages : { to: Address, value: bigint, body: Cell }[] = []

        // We send MINT_GAS either in one part or in two
        let mintGasPart = PoolV3.gasUsage.MINT_GAS
        if (est.jetton0Amount != 0n && est.jetton1Amount != 0n) {
            mintGasPart /= 2n
        }

        /* part0 */
        if (est.jetton0Amount != 0n) {
            if (this.jetton0.isTonProxy) {
                // pTonProxy needs another way to process the call.
                // There is no addditional user wallet for this task (wonder if it could be?)

                console.log("Jetton 0 is TonProxy")
                const mintPart0 = beginCell()
                    .storeUint   (proxyWalletOpcodesV2.tonTransfer, 32)
                    .storeUint   (0, 64)                 // query_id 
                    .storeCoins  (est.jetton0Amount)     // ton To Send. It would we wrapped and then lp minted from them
                    .storeAddress(walletOpened.address)  // refundAddress
                    .storeUint   (1, 1)                  // flag that shows that paylod is a cell  
                    .storeRef    (poolMintRequest.part0) // Instructions for the pool
                .endCell()

                messages.push({to : this.routerWallet0.address, value : mintGasPart + est.jetton0Amount, body : mintPart0 })
            } else {
                // Router luckily swaps all the input to the pool taking in consideration which token is the fist and which is the second
                const mintPart0 = JettonWallet.transferMessage ( 
                    est.jetton0Amount, 
                    this.routerContract.address, 
                    walletOpened.address, 
                    new Cell(), PoolV3.gasUsage.MINT_PART_GAS,                      
                    poolMintRequest.part0                   
                )
                messages.push({to : userWallet0Addr, value : mintGasPart, body : mintPart0 })
            }
        }
        
        /* Part 1 */
        if (est.jetton1Amount != 0n) {
            if (this.jetton1.isTonProxy) {
                console.log("Jetton 1 is TonProxy")
                const mintPart1 = beginCell()
                    .storeUint   (proxyWalletOpcodesV2.tonTransfer, 32)
                    .storeUint   (0, 64)                // query_id 
                    .storeCoins  (est.jetton1Amount)    // ton To Send. It would we wrapped and then lp minted from them
                    .storeAddress(walletOpened.address) // refundAddress
                    .storeUint   (1, 1)                 // flag that shows that paylod is a cell  
                    .storeRef    (poolMintRequest.part1)         // Instructions for the pool
                .endCell()

                messages.push({to : this.routerWallet1.address, value : mintGasPart + est.jetton1Amount, body : mintPart1 })
            } else {        
                const mintPart1 = JettonWallet.transferMessage( 
                    est.jetton1Amount, 
                    this.routerContract.address, 
                    walletOpened.address, 
                    new Cell(), PoolV3.gasUsage.MINT_PART_GAS, 
                    poolMintRequest.part1
                )  
                messages.push({to : userWallet1Addr, value : mintGasPart, body : mintPart1 })
            }
        }

        const internalMessages = messages.map((x) => internal(x))

        let transfer = walletOpened.createTransfer({
            seqno : await walletOpened.getSeqno(),
            secretKey: keys.secretKey,
            messages: internalMessages           
        });

        // Perform transfer
        let mintResult = await walletOpened.send(transfer)
        return mintResult;
    }

    /**
     * Burn is not affected by the jetton swap, so we can just proxy the call 
     **/
    async burn(walletOpened: SandboxContract<WalletContractV4> | OpenedContract<WalletContractV4>, keys: KeyPair, 
        nftIndex : bigint, 
        tickLower : number,
        tickUpper : number,
        liquidity2Burn : bigint       
    ) 
    {
        if (this.poolContract  === undefined) { throw Error("Call initWrapper() before mint(): this.poolContract  is undefined") }

        let sender : Sender 
      
        let senderRes = walletOpened.sender(keys.secretKey)
        if ( "then" in senderRes &&  typeof senderRes.then === "function") {
            sender = (await senderRes).result
        } else {
            sender = senderRes as Sender
        }

        if (this.swapIds) {
            [tickLower, tickUpper] = [-tickUpper, -tickLower]
        }

        let burnResult = await this.poolContract.sendBurn(sender, toNano(0.4), nftIndex, tickLower, tickUpper, liquidity2Burn);
        return burnResult
    }
           

    /**
     * 
     *  @param limitPrice so far unused 
     **/
    async swapExactIn(walletOpened: SandboxContract<WalletContractV4> | OpenedContract<WalletContractV4>, keys: KeyPair, zeroForOne: boolean, amountIn : bigint, minOutAmount?: bigint, limitPrice?: bigint ) {

        let sender : Sender 
      
        let senderRes = walletOpened.sender(keys.secretKey)
        if ( "then" in senderRes &&  typeof senderRes.then === "function") {
            sender = (await senderRes).result
        } else {
            sender = senderRes as Sender
        }
        

        if (this.poolContract  === undefined) { throw Error("Call initWrapper() before mint(): this.poolContract  is undefined") }

        let sourceJ  : JettonAPI
        let sourceRW : any//JettonWallet | PTonWalletV2
        let targetRW : JettonWallet | PTonWalletV2
        let priceUp = true;
        
        
        if (zeroForOne) {     
            console.log(`We about to put ${amountIn} of token0 in the pool`)
            
            sourceJ = this.jetton0  
            sourceRW = this.routerWallet0!
            targetRW = this.routerWallet1!
            // Generally when zero tokens a are put in pool the price goes down (it denotes how much token0 is in terms of token1)
            // So if there is no swap of pool tokenids priceUp is false
            priceUp = this.swapIds ? true : false
        } else {
            console.log(`We about to put ${amountIn} of token1 in the pool`)

            sourceJ = this.jetton1
            sourceRW = this.routerWallet1! 
            targetRW = this.routerWallet0!
            //
            priceUp = this.swapIds ? false : true
        }

        
        let priceLimit : bigint = 0n

        if (limitPrice && limitPrice != 0n) {
            priceLimit = limitPrice
        } else {
            if (priceUp) {
                priceLimit = TickMath.MAX_SQRT_RATIO - 1n
            } else {
                priceLimit = TickMath.MIN_SQRT_RATIO + 1n
            }
        }

        const swapRequest : Cell = 
            beginCell()
                .storeUint( ContractOpcodes.POOLV3_SWAP, 32) // Request to swap
                .storeAddress(targetRW.address)              // JettonWallet attached to Router is used to identify target token                  
                .storeUint   (priceLimit, 160)               // Minimum/maximum price that we are ready to reach
                .storeCoins  (minOutAmount ?? 0n)            // Minimum amount to get back
                .storeAddress(walletOpened.address)          // Address to recieve result of the swap                              
            .endCell()

        let swapResult 
        if(sourceJ.isTonProxy) {
            console.log(`Starting transfer from pTon to ${sourceRW.address}`)
            // Static casts.. love them (no)
            let sourceRWpT = sourceRW as SandboxContract<PTonWalletV2>

            swapResult = sourceRWpT.sendTonTransfer(
                sender, {
                    tonAmount : amountIn,
                    refundAddress : walletOpened.address,
                    fwdPayload: swapRequest,
                    gas : PoolV3.gasUsage.SWAP_GAS_BASE
                },
                PoolV3.gasUsage.SWAP_GAS_BASE + PoolV3.gasUsage.TRANSFER_GAS + amountIn  // Adding ton for the swap to the input
            )
        } else {
            const sourceUserWallet = await sourceJ.getWallet(walletOpened.address);
            console.log(`Starting transfer from ${sourceUserWallet.address} to ${sourceRW.address}`)
            
            swapResult = await sourceUserWallet.sendTransfer(
                sender,
                PoolV3.gasUsage.SWAP_GAS_BASE + PoolV3.gasUsage.TRANSFER_GAS * 2n,
                amountIn, 
                this.routerContract.address, 
                walletOpened.address, 
                beginCell().endCell(), 
                PoolV3.gasUsage.SWAP_GAS_BASE,
                swapRequest
            )      
        }
            
        return swapResult
    }


    

    async swapExactOut(providerFunction: any, wallet: SandboxContract<WalletContractV4>, keys: KeyPair, zeroForOne: boolean, amountIn : bigint, limitPrice: bigint) {
    }



    async setFees(walletOpened: SandboxContract<WalletContractV4> | OpenedContract<WalletContractV4>, keys: KeyPair,
        protocolFee: number,
        lpFee      : number,
        currentFee : number
     )
    {
        let sender : Sender 
      
        let senderRes = walletOpened.sender(keys.secretKey)
        if ( "then" in senderRes &&  typeof senderRes.then === "function") {
            sender = (await senderRes).result
        } else {
            sender = senderRes as Sender
        }

        if (this.poolContract  === undefined) { throw Error("Call initWrapper() before setFees(): this.poolContract  is undefined") }

        return await this.poolContract.sendSetFees(sender, PoolV3.gasUsage.SET_FEE_GAS, protocolFee, lpFee, currentFee)
        
    }

} 