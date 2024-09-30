import { beginCell, Cell } from "@ton/core";
import { packJettonOnchainMetadata } from "./common/jettonContent";

export let nftContentToPack : { [s: string]: string | undefined } = {  
    name   : "AMM Pool Minter", 
    description : "AMM Pool LP Minter", 
    cover_image : "https://pimenovalexander.github.io/resources/icons/header1.svg", 
    image: "https://pimenovalexander.github.io/resources/icons/NFT.png" 
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

export const nftContentPackedDefault: Cell =  embedJettonData(packJettonOnchainMetadata(nftContentToPack), "jetton0", 10, "jetton1", 11)
//const nftContentPacked: Cell =  packJettonOnchainMetadata(nftContentToPack)


export let nftItemContentToPack : { [s: string]: string | undefined } = {  
    name   : "AMM Pool Position", 
    description : "LP Position", 
    image: "https://pimenovalexander.github.io/resources/icons/NFTItem.png",
    //content_url : "https://pimenovalexander.github.io/resources/icons/NFTItem.png", 
    //content_type : "image/png"
}

let nftItemContent1ToPack = "https://pimenovalexander.github.io/resources/icons/metadata.json"

export const nftItemContentPackedDefault: Cell =  packJettonOnchainMetadata(nftItemContentToPack)
//const nftItemContentPacked: Cell =  packOffchainMetadata (nftItemContent1ToPack)

