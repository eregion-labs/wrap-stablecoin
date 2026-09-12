/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/wrap_stablecoin.json`.
 */
export type WrapStablecoin = {
  "address": "DUKXaKc4q6DXKf6mB13iyAB5vgBRvMH8WC2qy3RGUqSJ",
  "metadata": {
    "name": "wrapStablecoin",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
      ],
      "accounts": [
        {
          "name": "newAdmin",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "acceptMintAuthority",
      "discriminator": [
        139,
        154,
        57,
        100,
        119,
        196,
        182,
        45
      ],
      "accounts": [
        {
          "name": "newMintAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "wrappedMint",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "addAsset",
      "discriminator": [
        81,
        53,
        134,
        142,
        243,
        73,
        42,
        179
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "underlyingMint"
        },
        {
          "name": "assetConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "underlyingMint"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "treasuryVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "addAssetArgs"
            }
          }
        }
      ]
    },
    {
      "name": "addToAllowlist",
      "discriminator": [
        149,
        143,
        78,
        134,
        241,
        244,
        7,
        56
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "pubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "cancelProposeMintAuthority",
      "discriminator": [
        217,
        102,
        179,
        96,
        71,
        248,
        195,
        103
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "cancelTransferAuthority",
      "discriminator": [
        86,
        211,
        3,
        156,
        239,
        64,
        127,
        252
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "depositAllToKlend",
      "discriminator": [
        179,
        8,
        251,
        86,
        149,
        45,
        81,
        31
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "klend_config.lending_market",
                "account": "kLendConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "depositToKlend",
      "discriminator": [
        102,
        70,
        3,
        250,
        163,
        32,
        203,
        219
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "klend_config.lending_market",
                "account": "kLendConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "depositToKlendArgs"
            }
          }
        }
      ]
    },
    {
      "name": "enableKlend",
      "discriminator": [
        176,
        62,
        13,
        175,
        31,
        178,
        176,
        125
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "lendingMarket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve"
        },
        {
          "name": "reserveLiquiditySupply"
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "collateralVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "harvestYield",
      "discriminator": [
        28,
        200,
        150,
        200,
        69,
        56,
        38,
        133
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "klend_config.lending_market",
                "account": "kLendConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "harvestYieldArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initAllowlist",
      "discriminator": [
        186,
        165,
        190,
        208,
        55,
        86,
        208,
        6
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "decimalsMint",
          "docs": [
            "Mint whose `decimals` field sets wrapped token precision (any value in 1..=18)."
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "wrappedMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  114,
                  97,
                  112,
                  112,
                  101,
                  100,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Classic SPL Token. Florin mint is never Token-2022."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeMintMetadata",
      "discriminator": [
        210,
        88,
        76,
        142,
        253,
        135,
        134,
        177
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "wrappedMint"
        },
        {
          "name": "metadata",
          "writable": true
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    },
    {
      "name": "proposeMintAuthority",
      "discriminator": [
        75,
        29,
        83,
        92,
        1,
        166,
        237,
        15
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "newMintAuthority"
        }
      ],
      "args": []
    },
    {
      "name": "removeFromAllowlist",
      "discriminator": [
        45,
        46,
        214,
        56,
        189,
        77,
        242,
        227
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "allowlist",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  108,
                  108,
                  111,
                  119,
                  108,
                  105,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "pubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setUnwrapPublic",
      "discriminator": [
        140,
        99,
        55,
        145,
        254,
        219,
        31,
        155
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "unwrapPublic",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setWrapPublic",
      "discriminator": [
        129,
        108,
        205,
        4,
        194,
        163,
        81,
        7
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "wrapPublic",
          "type": "bool"
        }
      ]
    },
    {
      "name": "sweepHomeSurplus",
      "discriminator": [
        83,
        216,
        153,
        216,
        142,
        138,
        7,
        192
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "sweepHomeSurplusArgs"
            }
          }
        }
      ]
    },
    {
      "name": "transferAuthority",
      "discriminator": [
        48,
        169,
        76,
        72,
        229,
        180,
        55,
        161
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "newAdmin"
        }
      ],
      "args": []
    },
    {
      "name": "unwrap",
      "discriminator": [
        126,
        175,
        198,
        14,
        212,
        69,
        50,
        44
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "userWrapped",
          "writable": true
        },
        {
          "name": "userAssetToken",
          "writable": true
        },
        {
          "name": "wrappedMint",
          "docs": [
            "wrapped token mint; precision fixed at vault init (`vault_config.wrapped_decimals`)."
          ],
          "writable": true
        },
        {
          "name": "assetConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "Underlying collateral mint (any supported precision)."
          ]
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "allowlist",
          "docs": [
            "Required when unwrap_public is false. PDA seeds: [crate::pda_seeds::ALLOWLIST_SEED, vault_config.key()]"
          ],
          "optional": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "florinTokenProgram",
          "docs": [
            "Classic SPL Token. Florin mint/burn never uses Token-2022."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "unwrapArgs"
            }
          }
        }
      ]
    },
    {
      "name": "updateAssetPolicy",
      "discriminator": [
        156,
        28,
        90,
        219,
        24,
        173,
        240,
        51
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "updateAssetPolicyArgs"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawAllFromKlend",
      "discriminator": [
        246,
        64,
        238,
        201,
        187,
        10,
        16,
        191
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "klend_config.lending_market",
                "account": "kLendConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawFromKlend",
      "discriminator": [
        197,
        240,
        124,
        125,
        157,
        181,
        120,
        66
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "klendConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  108,
                  101,
                  110,
                  100,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "klendProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  109,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "klend_config.lending_market",
                "account": "kLendConfig"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                4,
                178,
                172,
                177,
                18,
                88,
                204,
                227,
                104,
                44,
                65,
                139,
                168,
                114,
                255,
                61,
                249,
                17,
                2,
                113,
                47,
                21,
                175,
                18,
                182,
                190,
                105,
                179,
                67,
                91,
                0,
                8
              ]
            }
          }
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "instructionSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "withdrawFromKlendArgs"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawTreasury",
      "discriminator": [
        40,
        63,
        122,
        158,
        144,
        216,
        83,
        96
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultConfig"
          ]
        },
        {
          "name": "vaultConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "treasuryVault",
          "writable": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "withdrawTreasuryArgs"
            }
          }
        }
      ]
    },
    {
      "name": "wrap",
      "discriminator": [
        178,
        40,
        10,
        189,
        228,
        129,
        186,
        140
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vault_config.authority",
                "account": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              }
            ]
          }
        },
        {
          "name": "assetConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "vaultConfig"
              },
              {
                "kind": "account",
                "path": "asset_config.token_mint",
                "account": "assetConfig"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "Underlying collateral mint (any supported precision)."
          ]
        },
        {
          "name": "userToken",
          "writable": true
        },
        {
          "name": "userWrapped",
          "writable": true
        },
        {
          "name": "wrappedMint",
          "docs": [
            "wrapped token mint; precision fixed at vault init (`vault_config.wrapped_decimals`)."
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "allowlist",
          "docs": [
            "Required when wrap_public is false. PDA seeds: [crate::pda_seeds::ALLOWLIST_SEED, vault_config.key()]"
          ],
          "optional": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "florinTokenProgram",
          "docs": [
            "Classic SPL Token. Florin mint/burn never uses Token-2022."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "wrapArgs"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "allowlist",
      "discriminator": [
        188,
        77,
        210,
        114,
        13,
        206,
        20,
        47
      ]
    },
    {
      "name": "assetConfig",
      "discriminator": [
        57,
        112,
        247,
        166,
        247,
        64,
        140,
        23
      ]
    },
    {
      "name": "kLendConfig",
      "discriminator": [
        162,
        152,
        66,
        110,
        118,
        83,
        184,
        173
      ]
    },
    {
      "name": "vaultConfig",
      "discriminator": [
        118,
        97,
        117,
        108,
        116,
        99,
        102,
        50
      ]
    }
  ],
  "events": [
    {
      "name": "adminTransferProposed",
      "discriminator": [
        203,
        168,
        175,
        51,
        239,
        104,
        20,
        85
      ]
    },
    {
      "name": "adminTransferred",
      "discriminator": [
        255,
        147,
        182,
        5,
        199,
        217,
        38,
        179
      ]
    },
    {
      "name": "assetAdded",
      "discriminator": [
        174,
        91,
        37,
        97,
        47,
        14,
        45,
        93
      ]
    },
    {
      "name": "assetPolicyUpdated",
      "discriminator": [
        78,
        50,
        35,
        91,
        223,
        124,
        251,
        134
      ]
    },
    {
      "name": "harvested",
      "discriminator": [
        249,
        229,
        78,
        151,
        106,
        185,
        149,
        11
      ]
    },
    {
      "name": "homeSurplusSwept",
      "discriminator": [
        128,
        64,
        247,
        237,
        44,
        144,
        208,
        89
      ]
    },
    {
      "name": "klendEnabled",
      "discriminator": [
        92,
        15,
        166,
        142,
        216,
        74,
        186,
        128
      ]
    },
    {
      "name": "mintAuthorityTransferProposed",
      "discriminator": [
        75,
        243,
        57,
        212,
        27,
        124,
        208,
        211
      ]
    },
    {
      "name": "mintAuthorityTransferred",
      "discriminator": [
        23,
        136,
        155,
        223,
        27,
        166,
        51,
        85
      ]
    },
    {
      "name": "pauseChanged",
      "discriminator": [
        238,
        188,
        213,
        78,
        134,
        209,
        178,
        218
      ]
    },
    {
      "name": "treasuryWithdrawn",
      "discriminator": [
        143,
        181,
        157,
        169,
        87,
        155,
        170,
        46
      ]
    },
    {
      "name": "unwrapped",
      "discriminator": [
        25,
        86,
        93,
        80,
        145,
        113,
        86,
        93
      ]
    },
    {
      "name": "wrapped",
      "discriminator": [
        11,
        127,
        145,
        31,
        206,
        134,
        73,
        130
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "vaultPaused",
      "msg": "Vault is currently paused"
    },
    {
      "code": 6001,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for operation"
    },
    {
      "code": 6002,
      "name": "noYieldAvailable",
      "msg": "No yield available to harvest"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6004,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6005,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6006,
      "name": "insufficientLiquidity",
      "msg": "Insufficient liquidity for redemption"
    },
    {
      "code": 6007,
      "name": "insufficientLiability",
      "msg": "Redemption exceeds pool liability obligation"
    },
    {
      "code": 6008,
      "name": "flashMintDisabled",
      "msg": "Flash mint feature is disabled"
    },
    {
      "code": 6009,
      "name": "missingFlashMintEnd",
      "msg": "Missing flash_mint_end instruction in transaction"
    },
    {
      "code": 6010,
      "name": "invalidFlashLoan",
      "msg": "Invalid flash loan state"
    },
    {
      "code": 6011,
      "name": "insufficientRepayment",
      "msg": "Insufficient balance to repay flash loan"
    },
    {
      "code": 6012,
      "name": "invalidFlashMintFee",
      "msg": "Flash mint fee exceeds maximum"
    },
    {
      "code": 6013,
      "name": "tokenDisabled",
      "msg": "Token is disabled"
    },
    {
      "code": 6014,
      "name": "tokenNotFound",
      "msg": "Token not found"
    },
    {
      "code": 6015,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 6016,
      "name": "notAllowedToWrap",
      "msg": "Not allowed to wrap"
    },
    {
      "code": 6017,
      "name": "notAllowedToUnwrap",
      "msg": "Not allowed to unwrap"
    },
    {
      "code": 6018,
      "name": "allowlistFull",
      "msg": "Allowlist full"
    },
    {
      "code": 6019,
      "name": "notInAllowlist",
      "msg": "Pubkey not in allowlist"
    },
    {
      "code": 6020,
      "name": "allowlistDuplicate",
      "msg": "Pubkey already in allowlist"
    },
    {
      "code": 6021,
      "name": "exceedsHarvestableYield",
      "msg": "Harvest amount exceeds available yield"
    },
    {
      "code": 6022,
      "name": "exceedsHomeSurplus",
      "msg": "Sweep amount exceeds home vault surplus"
    },
    {
      "code": 6023,
      "name": "flashMintAmountExceeded",
      "msg": "Flash mint amount exceeds configured maximum"
    },
    {
      "code": 6024,
      "name": "noPendingTransfer",
      "msg": "No pending authority transfer"
    },
    {
      "code": 6025,
      "name": "invalidTreasury",
      "msg": "Invalid treasury address"
    },
    {
      "code": 6026,
      "name": "invalidReserveOwner",
      "msg": "Reserve account not owned by KLend program"
    },
    {
      "code": 6027,
      "name": "invalidTokenAccountData",
      "msg": "Token account data invalid or unexpected owner"
    },
    {
      "code": 6028,
      "name": "flashMintScanLimit",
      "msg": "Flash mint introspection scan exceeded bound"
    },
    {
      "code": 6029,
      "name": "harvestLeavesUnderbacked",
      "msg": "Harvest would leave insufficient backing for tracked liability"
    },
    {
      "code": 6030,
      "name": "harvestRedeemedNothing",
      "msg": "Harvest redeem produced no collateral movement"
    },
    {
      "code": 6031,
      "name": "flashMintFeeReceiverUnset",
      "msg": "Flash mint fee receiver is not configured"
    },
    {
      "code": 6032,
      "name": "mintDisabled",
      "msg": "Minting is disabled for this asset"
    },
    {
      "code": 6033,
      "name": "redeemDisabled",
      "msg": "Redemption is disabled for this asset"
    },
    {
      "code": 6034,
      "name": "mintCapExceeded",
      "msg": "Mint cap exceeded for this asset"
    },
    {
      "code": 6035,
      "name": "exposureCapExceeded",
      "msg": "Exposure cap exceeded for this asset"
    },
    {
      "code": 6036,
      "name": "reflexiveCollateralForbidden",
      "msg": "Wrapped token cannot back itself as collateral"
    },
    {
      "code": 6037,
      "name": "invalidMetadata",
      "msg": "Invalid mint metadata"
    },
    {
      "code": 6038,
      "name": "invalidMetadataAccount",
      "msg": "Mint metadata account address mismatch"
    },
    {
      "code": 6039,
      "name": "metadataAlreadyInitialized",
      "msg": "Mint metadata already initialized"
    },
    {
      "code": 6040,
      "name": "klendNotEnabled",
      "msg": "KLend is not enabled for this asset"
    },
    {
      "code": 6041,
      "name": "invalidHaircut",
      "msg": "Invalid haircut bps"
    },
    {
      "code": 6042,
      "name": "invalidDecimals",
      "msg": "Token decimals must be between 1 and 18"
    },
    {
      "code": 6043,
      "name": "mintAuthorityTransferred",
      "msg": "Mint authority has been transferred; wrapping is permanently disabled"
    },
    {
      "code": 6044,
      "name": "noPendingMintAuthorityTransfer",
      "msg": "No pending mint authority transfer"
    },
    {
      "code": 6045,
      "name": "mintAuthorityAlreadyTransferred",
      "msg": "Mint authority transfer already completed"
    },
    {
      "code": 6046,
      "name": "invalidKlendReserve",
      "msg": "KLend Reserve account layout, discriminator, or version is invalid"
    },
    {
      "code": 6047,
      "name": "klendReserveMarketMismatch",
      "msg": "KLend Reserve lending_market does not match the supplied market"
    },
    {
      "code": 6048,
      "name": "klendReserveMintMismatch",
      "msg": "KLend Reserve liquidity mint does not match the registered asset"
    },
    {
      "code": 6049,
      "name": "klendReserveLiquiditySupplyMismatch",
      "msg": "KLend Reserve liquidity supply does not match the supplied account"
    },
    {
      "code": 6050,
      "name": "klendReserveCollateralMintMismatch",
      "msg": "KLend Reserve collateral mint does not match the supplied account"
    },
    {
      "code": 6051,
      "name": "zeroLiquidityDeposited",
      "msg": "Kamino deposit moved no liquidity from the vault"
    },
    {
      "code": 6052,
      "name": "inconsistentKlendCollateralBalance",
      "msg": "KLend collateral vault balance is inconsistent across the redeem"
    },
    {
      "code": 6053,
      "name": "unsupportedTokenExtension",
      "msg": "Collateral mint must be classic SPL Token or Token-2022 with no extensions"
    }
  ],
  "types": [
    {
      "name": "addAssetArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintEnabled",
            "type": "bool"
          },
          {
            "name": "redeemEnabled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "adminTransferProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "adminTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "allowlist",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "allowed",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "assetAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "assetConfig",
      "docs": [
        "Per-collateral reserve configuration. PDA seeds: `[\"token_config\", vault_config, underlying_mint]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultConfig",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "docs": [
              "Underlying SPL mint (USDC, USDT, wBTC, …); precision stored at registration."
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenDecimals",
            "docs": [
              "`underlying_mint.decimals` snapshot (1..=18)."
            ],
            "type": "u8"
          },
          {
            "name": "treasuryVault",
            "docs": [
              "Protocol yield vault (PDA). Not part of wrapped token backing."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasuryVaultBump",
            "type": "u8"
          },
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "tokenVaultBump",
            "type": "u8"
          },
          {
            "name": "totalDeposits",
            "docs": [
              "Cumulative underlying deposited via `wrap` (underlying token atoms)."
            ],
            "type": "u64"
          },
          {
            "name": "totalWrappedMinted",
            "docs": [
              "Cumulative wrapped token minted from this pool (wrapped token atoms)."
            ],
            "type": "u64"
          },
          {
            "name": "totalRedemptions",
            "docs": [
              "Cumulative wrapped token burned via `unwrap` against this pool (wrapped token atoms)."
            ],
            "type": "u64"
          },
          {
            "name": "mintEnabled",
            "type": "bool"
          },
          {
            "name": "redeemEnabled",
            "type": "bool"
          },
          {
            "name": "mintHaircutBps",
            "docs": [
              "Bps discount on wrapped token minted per unit underlying (200 = mint 0.98 wStable per 1 USDT)."
            ],
            "type": "u16"
          },
          {
            "name": "redemptionHaircutBps",
            "docs": [
              "Bps discount on underlying paid per unit wrapped token burned."
            ],
            "type": "u16"
          },
          {
            "name": "mintCap",
            "docs": [
              "Max outstanding wrapped token liability (`total_wrapped_minted - total_redemptions`). 0 = unlimited."
            ],
            "type": "u64"
          },
          {
            "name": "exposureCap",
            "docs": [
              "Alias exposure cap in wrapped token atoms for governance dashboards. 0 = unlimited."
            ],
            "type": "u64"
          },
          {
            "name": "minLiquidityTarget",
            "docs": [
              "Policy hint: target free-vault liquidity for redemption UX."
            ],
            "type": "u64"
          },
          {
            "name": "assetStatus",
            "type": {
              "defined": {
                "name": "assetStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "assetPolicyUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "assetStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          },
          {
            "name": "mintOnly"
          },
          {
            "name": "redeemOnly"
          },
          {
            "name": "deprecated"
          }
        ]
      }
    },
    {
      "name": "depositToKlendArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "harvestYieldArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "harvested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "ktokensRedeemed",
            "type": "u64"
          },
          {
            "name": "liquidityReceived",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "homeSurplusSwept",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "kLendConfig",
      "docs": [
        "Kamino KLend integration for a registered asset. PDA seeds: `[\"klend_config\", asset_config]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "assetConfig",
            "type": "pubkey"
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "reserve",
            "type": "pubkey"
          },
          {
            "name": "reserveLiquiditySupply",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralVault",
            "type": "pubkey"
          },
          {
            "name": "collateralVaultBump",
            "type": "u8"
          },
          {
            "name": "totalLiquidityInKlend",
            "docs": [
              "USDC-denominated principal deployed to KLend for this asset."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "klendEnabled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mintAuthorityTransferProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "pendingMintAuthority",
            "type": "pubkey"
          },
          {
            "name": "wrappedMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "mintAuthorityTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wrappedMint",
            "type": "pubkey"
          },
          {
            "name": "newMintAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "pauseChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "sweepHomeSurplusArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "treasuryWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unwrapArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unwrapped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amountBurned",
            "type": "u64"
          },
          {
            "name": "amountOut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "updateAssetPolicyArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintEnabled",
            "type": "bool"
          },
          {
            "name": "redeemEnabled",
            "type": "bool"
          },
          {
            "name": "mintHaircutBps",
            "type": "u16"
          },
          {
            "name": "redemptionHaircutBps",
            "type": "u16"
          },
          {
            "name": "mintCap",
            "type": "u64"
          },
          {
            "name": "exposureCap",
            "type": "u64"
          },
          {
            "name": "minLiquidityTarget",
            "type": "u64"
          },
          {
            "name": "assetStatus",
            "type": {
              "defined": {
                "name": "assetStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "vaultConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "docs": [
              "Immutable creator key used in PDA seeds. Never changes after init."
            ],
            "type": "pubkey"
          },
          {
            "name": "admin",
            "docs": [
              "Mutable operational admin. Can be transferred via two-step process."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingAdmin",
            "docs": [
              "Pending admin for two-step authority transfer. Default means no pending transfer."
            ],
            "type": "pubkey"
          },
          {
            "name": "wrappedMint",
            "type": "pubkey"
          },
          {
            "name": "wrappedMintBump",
            "type": "u8"
          },
          {
            "name": "wrappedDecimals",
            "docs": [
              "Decimal precision of `wrapped_mint` (fixed at initialize)."
            ],
            "type": "u8"
          },
          {
            "name": "vaultAuthorityBump",
            "type": "u8"
          },
          {
            "name": "totalStableDeposited",
            "docs": [
              "Global wrapped token liability counter (wraps − unwraps)."
            ],
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "wrapPublic",
            "type": "bool"
          },
          {
            "name": "unwrapPublic",
            "type": "bool"
          },
          {
            "name": "flashMintEnabled",
            "docs": [
              "Reserved for optional `flash-mint` feature; unused in shipped build."
            ],
            "type": "bool"
          },
          {
            "name": "flashMintFeeBps",
            "docs": [
              "Reserved for optional `flash-mint` feature; unused in shipped build."
            ],
            "type": "u16"
          },
          {
            "name": "flashMintMaxAmount",
            "docs": [
              "Reserved for optional `flash-mint` feature; unused in shipped build."
            ],
            "type": "u64"
          },
          {
            "name": "flashMintFeeReceiver",
            "docs": [
              "Reserved for optional `flash-mint` feature; unused in shipped build."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingMintAuthority",
            "docs": [
              "Pending destination for two-step mint authority transfer. Default means no pending transfer."
            ],
            "type": "pubkey"
          },
          {
            "name": "mintAuthorityTransferred",
            "docs": [
              "When true, SPL mint authority has left this vault and `wrap` is permanently disabled."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "withdrawFromKlendArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawTreasuryArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "wrapArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "wrapped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amountIn",
            "type": "u64"
          },
          {
            "name": "amountMinted",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
