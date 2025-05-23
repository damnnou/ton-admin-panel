import { Address } from "@ton/core"
import { BLACK_HOLE_ADDRESS, BLACK_HOLE_ADDRESS1 }  from "./amm/tonUtils"

export function getPTonMinterAddress (isTestnet : boolean) {
    if (isTestnet) {
        return Address.parse("EQCUnExmdgwAKADi-j2KPKThyQqTc7U650cgM0g78UzZXn9J")
    } else {
        return Address.parse("EQCUnExmdgwAKADi-j2KPKThyQqTc7U650cgM0g78UzZXn9J")
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
      "name": "Router: 🌧⛹🎉🐮 (Testnet Deploy 29.04.2025)",
      "minter": "EQDnfaddnk62TvUw4_-QCG_N1lcJdQZZmAxNnFhJ-Hitoft_"
    },

    {
      "name": "Router: 🫳🅿👡✳ (Testnet Emergency Deploy 18.11.2024)",
      "minter": "0QDnfag9lHlc0rS6YeI7WwRq-3ltcKSsYxLiXmveB7gNU9UB"
    },   
    {
        "name": "pTon",
        "minter": getPTonMinterAddress(true).toString()
    },
    {
      "name": "🌀BLACK_HOLE_ADDRESS",
      "minter": BLACK_HOLE_ADDRESS.toString()
    },
    {
      "name": "🌀BLACK_HOLE_ADDRESS1",
      "minter": BLACK_HOLE_ADDRESS1.toString()
    },
    {
      "name": "☠️⚒️NULL⚒️☠️",
      "minter": "addr_none()"
    },    
    {
       "name" : "Main Testnet KKK multisig",
       "minter": "kQBKKK_fh1A_me7QaR87wYR4yqDuYE_JgIR5Sw4O9Al2G1jl"
    },
    {
       "name" : "Main Testnet TTT multisig",            
       "minter": "kQDTTT_QuiE5oJNS4zafeELGeLqAK6lPI5WHCRFq4Q85_2rP"
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
      "name": "USDD",
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
    },

    {
      "minter": "EQAG2hEsO_ZJwkRYlx4rexL6-5BOyyXbNld-1rTmgCjmSePN",
      "name": "CATI Testnet Release",
      "wallet": "EQDJKGiuBRYl4QpsDUO4bXxf7frbQVkCLdz-j09JPddwl5OY"
    },
    {
      "minter": "EQBjbwenS9b65t5qG5A06WZEbY9IQcgfM2m0wupEcjkpEnmy",
      "name": "DOGS Testnet Release",
      "wallet": "EQDJH5LEdmXGvlV2z2wI_f-FfyLoZfwjX1NTdURfZwG9ZWTX"
    },
    {
      "minter": "EQA-Kqv6uPDvdBCGbW30LNAUcMWUuu_PakFnX91HZ_ZwW1Js",
      "name": "DUREV Testnet Release",
      "wallet": "EQDKqIgBReTRLF6LYbPnRAGk9_x4sxymM2xbKkFlkstkWkJn"
    },
    {
      "minter": "EQBZwXTkaMhw4BmslCWHowr9er80nu5YnLppLYEg7zWvfqfw",
      "name": "HMSTR Testnet Release",
      "wallet": "EQCzl1Q9V4Wwbp9Ha7DzvSATWILXXksVk-6dKSq6iWmYT_5M"
    },
    {
      "minter": "EQBYnZx4uFhz-DWjC5LT4n1Aoqvy3e-qhN9541MKDPpf19CK",
      "name": "JETTON Testnet Release",
      "wallet": "EQDwAGqhxPUvXrNFkzYF2GpeiD3VMHuq1ni2zSgzJYYVvVLh"
    },
    {
      "minter": "EQARmuFxND7Cg-FJVZPq0EBhb_YLzzmcQqevpu8857VhgUOu",
      "name": "NOT Testnet Release",
      "wallet": "EQDwKN7pCj-yhYCNslHkKNPPxC1yjCCnGQPNIGLN8t-VeW46"
    },
    {
      "minter": "EQDOrck2VWwKejS3BhOqkcepMTmIKrWBU8Mz5-kTKkmnqTxA",
      "name": "STTON Testnet Release",
      "wallet": "EQAeI3olefRSjSQXbuEaG4hzJf279YyIGattHXzgiydZxA9O"
    },
    {
      "minter": "EQC6eLeUdGpjFIKi6NZAL3BXgkThcGBc8aTjkcFouvCCu1aj",
      "name": "TON Testnet Release",
      "wallet": "EQC4D4BKlWQz43wJXW3SnvhtHMdueru_uCSdAXNXz2MwUvNB"
    },
    {
      "minter": "EQCmeq1871o1Jboc4IE482Om5avn3wD3nmEwSv1j-kOsci3G",
      "name": "TSTON Testnet Release",
      "wallet": "EQClMXWXKsIKKubwjZKvgYyHs8_-PdMLHOqiCWh1O6AkYrQL"
    },
    {
      "minter": "EQC4TQ2VgbnM9ZNdtPTg4HtILfTWhx45le1yWZPfPQqA6LQ7",
      "name": "USDT Testnet Release",
      "wallet": "EQA57Po90n4U9O-a4u60warz7dnzQKMu1rOXWfHVQDmF5K7q"
    },
    {
      "minter": "EQAC_rc0McaDoNGKZbRPLTgW3Sxj_lIIt3d9grJfceeMl4HN",
      "name": "UTON Testnet Release",
      "wallet": "EQBn2YtPotvCVcc8S-JuLaDIO943mm3-YacfpEsENFnyCMDh"
    },
    {
      "minter": "EQDI8JRAbyreoQOkOFnpwSgKetVVXd70T5vgfK9_GzYsBu8w",
      "name": "WALL Testnet Release",
      "wallet": "EQDqKbjzEGZQHSwr5QUfjyDE-ROL2SHw3_FxUsVwwVhLhkdq"
    },
    {
      "minter": "EQAOxIemSJrEQvCwNCDAiYPyVaY9SVmC4zffF1BGWd6Ugp7g",
      "name": "X Testnet Release",
      "wallet": "EQDojKtbq9ztkIIWo5RnWp5tFFO64NCcLafGEnuI0OL8NitA"
    }
  ]



  export const jettonListMainnet = [ 
     {
      "name": "Router: 🚋🦚👓🧤 (Mainnet Deploy 21.05.2025)",
      "minter": "EQC_-u2KQb-VqwIHckEc0r3dHbIpT8zgxXu-avRuJOFVz-4r"
    },
    {
      "name": "Router: 💻🖱👿🥣 (Mainnet Deploy 19.11.2024)",
      "minter": "EQC_-t0nCnOFMdp7E7qPxAOCbCWGFz-e3pwxb6tTvFmshjt5"
    },
/*
    {
      "name": "Router: 🪡↘🤫📀 (Mainnet Deploy 12.11.2024)",
      "minter": "UQBu-T0NcoSfIveS6nXpsshKxBRTZKB83XW-gIunhQwDnKa0"
    }, 
*/    
    {
      "name": "REX Multisig",
      "minter": "EQCREXe_J-1_zQHRQxYKzRu8MUUlBve4k_TFdJVEnhIULVwV"
    },        
    {
      "name": "🌀BLACK_HOLE_ADDRESS",
      "minter": BLACK_HOLE_ADDRESS.toString()
    },
    {
      "name": "🌀BLACK_HOLE_ADDRESS1",
      "minter": BLACK_HOLE_ADDRESS1.toString()
    },
    {
      "name": "☠️⚒️NULL⚒️☠️",
      "minter": "addr_none()"
    }, 
    {
        "name": "pTon",
        "minter": getPTonMinterAddress(false).toString()
    }, 
    {
      "minter": "EQDYsv6VQ7M37d7IyyQJrRJCfijjUns6zNVNEy6zzJzFIDs2",
      "name": "BANGKOK",
    },    
    /*{
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
    },*/
    {
      "minter": "EQC98_qAmNEptUtPc7W6xdHh_ZHrBUFpw5Ft_IzNU20QAJav",
      "name": "tsTON",
    },
    {
      "minter": "EQDNhy-nxYFgUqzfUzImBEP67JqsyMIcyk2S5_RwNNEYku0k",
      "name": "stTON",
    },
    {
        "minter": "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
        "name": "NOT",
    },
    {
        "minter": "EQAmQGimKRrSHDLllvdUdeDsX1CszGy_SPgNNN8wE2ihIwnP",
        "name": "TPET",
    },
    {
        "minter": "EQAQXlWJvGbbFfE8F3oS8s87lIgdovS455IsWFaRdmJetTon",
        "name": "JETTON",
    },
    {
        "minter": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        "name": "USD₮",
    },
    {
        "minter": "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS",
        "name": "DOGS",
    },
    {
        "minter": "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo",
        "name": "HMSTR",
    },
    {
        "minter": "EQBZ_cafPyDr5KUTs0aNxh0ZTDhkpEZONmLJA2SNGlLm4Cko",
        "name": "REDO",
    }
  ]