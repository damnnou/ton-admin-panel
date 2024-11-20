import { Address, Cell } from "@ton/core";


export type MetaMessage = {
    opcode : number,
    name? : string,
    description : string, 
    rights? : string, 
    acceptor : (visitor: StructureVisitor) => void
}

export type MetaMessageField = {
    name: string,
    type: "Uint" | "Int" | "Address" | "Coins" | "Cell", 
    size: number, 
    meta: string, 
    comment: string
}

export interface StructureVisitor {
    /* Base TON types */
    visitField  (field: MetaMessageField ): void;
    enterCell(opts:{name: string, type?: "Maybe" | "", comment? : string}) : void;
    leaveCell(opts:{name? : string}) : void;
}

