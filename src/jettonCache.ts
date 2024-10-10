import { Address } from "@ton/core"
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider } from "./utils/MyNetworkProvider"
import { unpackJettonOnchainMetadata } from "./amm/common/jettonContent";
import { PTonMinterV2 } from "./amm/common/PTonMinterV2";


type UnpackedMetadata = {[x:string] : string}

let jettonCache : {[x:string] : UnpackedMetadata } = {}


export async function getJettonMetadata(minterAddress : Address, isTestnet : boolean) : Promise<UnpackedMetadata>  
{
    const name : string = minterAddress.toString({testOnly: isTestnet})

    if (!(name in jettonCache)) {    
        const provider0 = new MyNetworkProvider(minterAddress, isTestnet)

        let metadata = {}
        let loaded = false;
        //try {
            const jetton0 : JettonMinter = JettonMinter.createFromAddress(minterAddress)
            const metadataPack0 = await jetton0.getJettonData(provider0)    
            metadata = unpackJettonOnchainMetadata(metadataPack0.content)
            loaded = true
        //} catch {
        //}
        /* Could be this is a proxyTon */
        /*try {
            const jetton0 : PTonMinterV2 = PTonMinterV2.createFromAddress(minterAddress)
            const metadataPack0 = await jetton0.getJettonData(provider0)    
            metadata = unpackJettonOnchainMetadata(metadataPack0.content)
            loaded = true
        } catch {
        }*/
        jettonCache[name] = metadata
    }
   
    return jettonCache[name]
}