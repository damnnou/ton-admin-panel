import { Address } from "@ton/core"


export function getPTonMinterAddress (isTestnet : boolean) {
    if (isTestnet) {
        return Address.parse("EQBlde83gVhXQKGogwCxKbiyB37N5K0mX4YcC9XTR1iFX1iO")
    } else {
        return Address.parse("EQBlde83gVhXQKGogwCxKbiyB37N5K0mX4YcC9XTR1iFX1iO")
    }
}


export function getJettonList (isTestnet : boolean) {
    if (isTestnet) {
        return jettonListTestnet
    } else {
        return jettonListMainnet
    }

}

export const jettonListTestnet = [
    /* That is a hack */
    {
        "name": "Router:Current",
        "minter": "kQBO-T0NCODKT87McOAK2Vb-Whx_jLFHU5NCDBJYkBcsiuTm"
    },
    {
        "name": "pTon",
        "minter": getPTonMinterAddress(true).toString()
    },

    {
      "name": "ALG_USD",
      "minter": "EQD8Hzc0JD808OAnCsnCea2_Fq4cNAiAhGo5KaXM-zt8HV5Q"
    },
    {
      "name": "ALG_ETH",
      "minter": "EQACEhh_dJzp3PPyEwwTfTy7Ub_f6Dt5FAKZq_t1Fqe2vaL2"
    },
    {
      "minter": "EQD9FPFbmlCMMyjKGDPQWvllCLUdjjxIFvu9UvL3H_WECs7o",
      "name": "A Coin",
      "wallet": "EQBcBGH6h8m0lZTmJnOJ_I82qYav74v2BpQSstMdgU8WQ_oL"
    },
    {
      "minter": "EQCDldcdLpTdm2BTcQS1DtU0Mf-GMywWkcuI2M6M3NBhwj8U",
      "name": "BTC",
      "wallet": "EQCnulYOsZT1Fqi-DF8iOWDY9avgm101AVZAzZVtIktQ8j91"
    },
    {
      "minter": "EQAVtn9uSMPZ4TXdhVNtlKpIJwNY56iD6ngn5bpMoUJDDcWO",
      "name": "USDC",
      "wallet": "EQBVXn8BYKm93XluQ0U9mrTUY_V5BKo5G0LDI1Q-TPLJxtZ-"
    },
    {
      "minter": "EQDeH8DU3t3-EmNvJQl2YnOvLMLTfODvhbTNsawu4UuZmG0n",
      "name": "USD",
      "wallet": "EQDerKwiEx1LGT28kdgVULNB87qpF9U2FAEvaHK_9ImFGeRo"
    },
    {
      "minter": "EQD-M4OwggbSkuzKGwVH0nYkVIibPGOOuIJUDvb9Po51u_bZ",
      "name": "ETH",
      "wallet": "EQDYWx6eFP4ODtN4jeUua07EbW_sEljqJGix5wngvzIw12Mj"
    },
    {
      "minter": "EQDDr_Jzy1Kj5tR3MdXkaeB6xKvldfSci8pswvzjEHoEMsYY",
      "name": "F3",
      "wallet": "EQA2si6bwFsZ8h6ObS1MglXcVUOQd1IVsvi6vsNjuS866xoZ"
    },
    {
      "minter": "EQBVdCFNMz19_KKpXS8elAMzf5xcxuEtuF-RWh2ALmfqsyDh",
      "name": "F18",
      "wallet": "EQBdJa4UZ2YEcAQNgySLnbJB8HSt-EHVdBWKKeU-MpVE2z9P"
    },
    {
      "minter": "EQD00XKMrx_6OaGfgOeMUl0pe0rvTQyuxi85pPbTAueQ70mB",
      "name": "F6",
      "wallet": "EQCGMuLk9pCi4llVL9xpwXE478crHowsnVOOiDjJgdCJU3DY"
    }
  ]



  export const jettonListMainnet = [ 
    {
        "name": "pTon",
        "minter": getPTonMinterAddress(false).toString()
    }, 
    {
        "minter": "EQAaauE_1aCVWmvrlf2_3pHlwzwi4NNrJcaa0vHuBTd15O8H",
        "name": "BTC-MT",
        "wallet": "EQCikJYq6WiMSqrDjLbxAmyo00FGOBLJgo4wnx2vvI6toKkD"
    },
    {
        "minter": "EQDLBCeeJbUaulSRK0EjGGUIq9S3afcGEdx-QCazzCMLWNc5",
        "name": "USD-MT",
        "wallet": "EQCo0VCGSiPS8zwCUGDlGZjwjgQMFgT0WkxUJu7T2ZEvPJn0"
    },
    {
        "minter": "EQBcQLUgInlMvwW8FUVX_Qdb_v4HAuwPMFHHSIJWRM4IVw6f",
        "name": "ETH-MT",
        "wallet": "EQDCfXXFge7wvM_EVq9vSfw4q00atRy19upmHNWXqzBemN-t"
    },
    {
        "minter": "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
        "name": "Notcoin",
    },
    {
        "minter": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        "name": "USD₮",
    },
    {
        "minter": "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS",
        "name": "DOGS",
    }



  ]