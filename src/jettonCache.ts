import { Address } from "@ton/core"
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider } from "./utils/MyNetworkProvider"
import { unpackJettonOnchainMetadata } from "./amm/common/jettonContent";


type UnpackedMetadata = {[x:string] : string}

let jettonCache : {[x:string] : UnpackedMetadata } = {}


export async function getJettonMetadata(minterAddress : Address, isTestnet : boolean) : Promise<UnpackedMetadata>  
{
    const name : string = minterAddress.toString({testOnly: isTestnet})

    if (!(name in jettonCache)) {    
        const jetton0 : JettonMinter = JettonMinter.createFromAddress(minterAddress)
        const provider0 = new MyNetworkProvider(minterAddress, isTestnet)
        const metadataPack0 = await jetton0.getJettonData(provider0)    
        const metadata0 = unpackJettonOnchainMetadata(metadataPack0.content)

        jettonCache[name] = metadata0
    }
   
    return jettonCache[name]
}