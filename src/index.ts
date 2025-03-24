import algosdk from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";

// The app ID to interact with.
const appId = 736014374;

async function loadClient() {
  const client = algokit.AlgorandClient.fromConfig({
    algodConfig: {
      server: "https://testnet-api.algonode.cloud",
    },
    indexerConfig: {
      server: "https://testnet-idx.algonode.cloud",
    },
  });

  return client;
}

async function loadAccount() {
    const client = await loadClient();
  // XXRLAODV3WE3GUAAHFK3N3ZMZ3ZX2DSNY5UYPJS5F7EYHB3Z3NKCOJEI6U
    const account = client.account.fromMnemonic('magic faith mercy spike van toilet fork empower deny undo quality receive account power pencil indicate reject gallery face solution lock midnight swap absorb express');

    return account;
}

async function deploySmartContract() {
    const account = await loadAccount();
    const client = await loadClient();

    const appFactory = client.client.getAppFactory({
        appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
        defaultSender: account.addr,
        defaultSigner: account.signer,
    });

    const response = await appFactory.send.create({
        method: 'createApplication',
    });

    return {
        appId: response.result.appId,
        appAddress: response.result.appAddress,
    }
}

async function fundSmartContract(appAddress: string) {
    const account = await loadAccount();
    const client = await loadClient();

    const suggestedParams = await client.client.algod.getTransactionParams().do();

    const fundTxn = makePaymentTxnWithSuggestedParamsFromObject({
        amount: 200_000,
        from: account.addr,
        to: appAddress,
        suggestedParams,
    });

    const atc = new algosdk.AtomicTransactionComposer();

    atc.addTransaction({ txn: fundTxn, signer: account.signer });

    const response = await atc.execute(client.client.algod, 8);
    console.log(response);
}

async function createAsset(appId: number) {
    const client = await loadClient();
    const account = await loadAccount();

    const appClient = new AppClient({
        appId: BigInt(appId),
        appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
        algorand: client,
    });

    const suggestedParams = await client.client.algod.getTransactionParams().do();

    const atc = new algosdk.AtomicTransactionComposer();

    atc.addMethodCall({
        method: appClient.getABIMethod('createAsset'),
        suggestedParams: {
            ...suggestedParams,
            fee: 2_000,
        },
        sender: account.addr,
        signer: account.signer,
        appID: appId,
    });

    const response = await atc.execute(client.client.algod, 8);
    console.log(response);
}

async function claimAsset(appId: number) {
    const client = await loadClient();
    const account = await loadAccount();

    const appClient = new AppClient({
        appId: BigInt(appId),
        appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
        algorand: client,
    });

    const suggestedParams = await client.client.algod.getTransactionParams().do();

    const atc = new algosdk.AtomicTransactionComposer();

    const globalState = await appClient.getGlobalState();
    const assetId = globalState.asset.value;
    console.log(assetId);

    /**
     * Opt into asset
     */
    const assetOptinTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
        amount: 0,
        from: account.addr,
        to: account.addr,
        suggestedParams,
        assetIndex: Number(assetId),
    });

    atc.addTransaction({
        txn: assetOptinTxn,
        signer: account.signer,
    });

    /**
     * Call asset claim
     */
    atc.addMethodCall({
        method: appClient.getABIMethod('claimAsset'),
        suggestedParams: {
            ...suggestedParams,
            fee: 6_000,
        },
        sender: account.addr,
        signer: account.signer,
        appID: appId,
        appForeignAssets: [Number(assetId)],
    });

    const response = await atc.execute(client.client.algod, 8);
    console.log(response);

    const assetBalance = await client.client.algod.accountAssetInformation(account.addr, Number(assetId)).do();

    console.log('Asset balance', assetBalance);
}

async function main() {
    console.log('deploying...')
    const { appAddress, appId } = await deploySmartContract();
    console.log('deployment successful', appId, appAddress);

    console.log('Funding...');
    await fundSmartContract(appAddress);
    console.log('Funding successful');

    console.log('creating asset..');
    await createAsset(Number(appId));
    console.log('Asset created');

    console.log('Claiming asset...')
    await claimAsset(Number(appId));
    console.log('Asset claimed');
}

main();
