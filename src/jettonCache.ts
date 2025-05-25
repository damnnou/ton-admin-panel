import { Address } from "@ton/core"
import { JettonMinter } from "./jetton/JettonMinter"
import { MyNetworkProvider, sendToTonApi } from "./utils/MyNetworkProvider"
import { unpackJettonOnchainMetadata } from "./amm/common/jettonContent";
import { escapeHtml } from "./utils/utils";


export type UnpackedMetadata = {[x:string] : string}

let jettonCache : {[x:string] : UnpackedMetadata } = {}


export async function getJettonMetadata(minterAddress : Address, isTestnet : boolean) : Promise<UnpackedMetadata>  
{
    const name : string = minterAddress.toString({testOnly: isTestnet})

    if (!(name in jettonCache)) {    
        const provider0 = new MyNetworkProvider(minterAddress, isTestnet)

        let metadata : {[key: string]: string} = {}
        let loaded = false;
       
        const jetton0 : JettonMinter = JettonMinter.createFromAddress(minterAddress)
        const metadataPack0 = await jetton0.getJettonData(provider0)    
        metadata = unpackJettonOnchainMetadata(metadataPack0.content)
        if (metadata.uri) {
            console.log("We have offchain metadata at", )

            /* TODO: Ask from the begining */
            try {
                const result = await sendToTonApi("jettons/" + minterAddress.toRawString(), null , isTestnet)
                console.log(result)

                //(await client.jettons.getJettonInfo(jettonMinter)).metadata;
                /*
                //const response = await fetch(metadata.uri );
                const response = await fetch("https://cors-anywhere.herokuapp.com/" + metadata.uri)
                // https://cors-anywhere.herokuapp.com/http://example.com
                
                if (!response.ok) {
                  throw new Error(`Error fetching data: ${response.statusText}`);
                }
            
                const data = await response.json();  // Parse the JSON*/
                metadata = result.metadata 
            } catch (error) {
                console.error("Failed to download and parse JSON", error);
                throw error;  // Rethrow the error for further handling
            }
        }

        if (metadata.decimals === undefined) {
            metadata.decimals = "9"
        }
        loaded = true
        for (let key of Object.keys(metadata)) {
            if (typeof (metadata[key]) == "string" ) {
                metadata[key] = escapeHtml(metadata[key])
            } else {
                console.log(`We have a non-string metadata: ${metadata[key]}. Type ${typeof metadata[key]}`)
            }
        }
        jettonCache[name] = metadata
    }
   
    return jettonCache[name]
}