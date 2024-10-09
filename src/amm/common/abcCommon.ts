import { Address, Cell, Contract, ContractProvider, SendMode, Sender, ShardAccount, beginCell, contractAddress } from "@ton/core";

export function emptyCell(): Cell {
    return beginCell().endCell();
}


export abstract class CommonContractBase implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell; }) { }

    static createFromAddress<K extends CommonContractBase>(this: new (address: Address, init?: { code: Cell; data: Cell; }) => K, address: Address) {
        return new this(address) as K;
    }

    protected static createFromConfigBase<K extends CommonContractBase, X>(
        this: new (address: Address, init?: { code: Cell; data: Cell; }) => K, 
        config: X, 
        configToCell: (config: X) => Cell, 
        code: Cell, 
        workchain = 0
    ){
        const data = configToCell(config);
        const init = { code, data };
        return new this(contractAddress(workchain, init), init) as K;
    }

   
    async sendEmpty(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: emptyCell(),
        });
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: emptyCell(),
            bounce: false
        });
    }
}