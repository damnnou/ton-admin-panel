import { Address } from "@ton/core"
import { BLACK_HOLE_ADDRESS, nftContentToPack, PoolV3Contract, poolv3StateInitConfig } from "../amm/PoolV3Contract"
import { MyNetworkProvider } from "../utils/MyNetworkProvider"
import BigNumber from "bignumber.js"
import { getJettonMetadata } from "../jettonCache"
import { formatAddressAndUrl } from "../utils/utils";


export async function poolSnippet (poolAddress:Address, isTestnet : boolean ) {

    const tonViewerURL = isTestnet ? "https://testnet.tonviewer.com/" : "https://tonviewer.com/"

    try {
        const poolContract = new PoolV3Contract(poolAddress)
        const providerPool = new MyNetworkProvider(poolAddress, isTestnet)
        const state = await poolContract.getPoolStateAndConfiguration(providerPool)

        const metadata0 = await getJettonMetadata(state.jetton0_minter, isTestnet)
        const metadata1 = await getJettonMetadata(state.jetton1_minter, isTestnet)    

        const minter0AddressS = await formatAddressAndUrl(state.jetton0_minter, isTestnet)
        const minter1AddressS = await formatAddressAndUrl(state.jetton1_minter, isTestnet)


        let jettonPrintable0 = BigNumber(state.collectedProtocolFee0.toString()).div(BigNumber(10).pow(BigNumber(metadata0.decimals))).toFixed(9)
        let jettonPrintable1 = BigNumber(state.collectedProtocolFee1.toString()).div(BigNumber(10).pow(BigNumber(metadata1.decimals))).toFixed(9)

        let result = `Pool with <br/>\n` + 
            `&nbsp; - <img src="${metadata0['image']}" width='24px' height='24px' > <a href=${tonViewerURL}${state.jetton0_minter} target="_blank" rel="noopener noreferrer">${metadata0["symbol"]} - ${metadata0["name"]}</a> [d:${metadata0["decimals"]}]</span> <br/>\n` +
            `&nbsp; - <img src="${metadata1['image']}" width='24px' height='24px' > <a href=${tonViewerURL}${state.jetton1_minter} target="_blank" rel="noopener noreferrer">${metadata1["symbol"]} - ${metadata1["name"]}</a> [d:${metadata1["decimals"]}]</span> <br/>`

        return result
    } catch (err) {
        console.log(err)
        return `We were not able to load pool info. Is it a pool?`
    }
}