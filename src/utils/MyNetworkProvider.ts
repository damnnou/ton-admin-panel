import { AccountState, AccountStorage, Address, Cell, Contract, ContractGetMethodResult, ContractProvider, ContractState, loadShardAccount, OpenedContract, Sender, SendMode,Transaction, TupleItem } from "@ton/core";
import {TonClient, TonClient4} from "@ton/ton";
import {getHttpV4Endpoint } from "@orbs-network/ton-access";
                
//const API_KEY = 'f200a6fdba67f4cd27bf0c69c28165305516fd503930a0c82456f9f763eeb773'
const API_KEY = 'd843619b379084d133f061606beecbf72ae2bf60e0622e808f2a3f631673599b';

export const sendToIndex = async (method: string, params: any, isTestnet: boolean) => {
    const mainnetRpc = 'https://toncenter.com/api/v3/';
    const testnetRpc = 'https://testnet.toncenter.com/api/v3/';
    const rpc = isTestnet ? testnetRpc : mainnetRpc;

    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    };

    const response = await fetch(rpc + method + '?' + new URLSearchParams(params), {
        method: 'GET',
        headers: headers,
    });
    const json = await response.json();
    if (json.error) {
        throw new Error(json.error);
    }
    return json;
}

const TONCO_TON_CONSOLE_KEY=`AGHD4DYGGAWBDZAAAAAPYUMY4V22MOI74LDT4VIF47EBFARRYYABMNGJMDGF6QJI2JATNKA`
const DEFAULT_TON_CONSOLE_KEY=`AHIQH4F4Y4XR6UIAAAAOGYUHWOWLUS6ZIPEXSCLAPOMMD6FSNMPUKHCIJHIP52YTU4VKURA`


export const sendToTonApi = async (method: string, params: any, isTestnet: boolean) => {

    const mainnetRpc = 'https://tonapi.io/v2/';
    const testnetRpc = 'https://testnet.tonapi.io/v2/';
    const rpc = isTestnet ? testnetRpc : mainnetRpc;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEFAULT_TON_CONSOLE_KEY}`
        //'Authorization': `Bearer AGHD4DYGGAWBDZAAAAAPYUMY4V22MOI74LDT4VIF47EBFARRYYABMNGJMDGF6QJI2JATNKA`
    };

    const response = await fetch(rpc + method + '?' + new URLSearchParams(params), {
        method: 'GET',
        headers: headers,
    });
    const json = await response.json();
    if (json.error) {
        throw new Error(json.error);
    }
    return json;
}


export async function getAccountState(contractAddress: Address, isTestnet : boolean) : Promise<AccountStorage>
{
    let endpoint = await getHttpV4Endpoint({ network: isTestnet ? "testnet" : "mainnet"})
    let client =  new TonClient4({ endpoint })
    
    let bseqno = (await client.getLastBlock()).last.seqno;
    let state = await client.getAccount(bseqno, contractAddress );

    let result : AccountState 
    if (state.account.state.type == "uninit") {
        result = { type : "uninit" }
    }
    if (state.account.state.type == "frozen") {
        result = { 
            type : "frozen", 
            stateHash : BigInt(state.account.state.stateHash) 
        }
    }
    if (state.account.state.type == "active") {
        result = {
            type : "active",
            state : {
                code : Cell.fromBase64(state.account.state.code),
                data : Cell.fromBase64(state.account.state.data)                
            }
        }        
    }

    return {
        lastTransLt : BigInt(state.account.last.lt),
        balance : {coins : BigInt(state.account.balance.coins)},
        state : result
    }
}

export class MyNetworkProvider implements ContractProvider {
    private contractAddress: Address;
    private isTestnet: boolean;
    private tonClient: TonClient;

    constructor(contractAddress: Address, isTestnet: boolean) {
        this.contractAddress = contractAddress;
        this.isTestnet = isTestnet;
        this.tonClient = new TonClient({
            endpoint: isTestnet ? 'https://testnet.toncenter.com/api/v2/jsonRPC' : 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: API_KEY
        });
    }

    getState(): Promise<ContractState> {
        throw new Error("Method not implemented.");
    }

    get(name: string, args: TupleItem[]): Promise<ContractGetMethodResult> {
        return this.tonClient.runMethod(this.contractAddress, name, args);
    }

    external(message: Cell): Promise<void> {
        throw new Error("Method not implemented.");
    }

    internal(via: Sender, args: {
        value: string | bigint;
        bounce?: boolean;
        sendMode?: SendMode;
        body?: string | Cell;
    }): Promise<void> {
        throw new Error("Method not implemented.");
    }

    open<T extends Contract>(contract: T): OpenedContract<T> {
        throw new Error("Method not implemented.");
    }

    getTransactions(address: Address, lt: bigint, hash: Buffer, limit?: number): Promise<Transaction[]> {
        throw new Error("Method not implemented.");
    }

}