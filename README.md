# Metronome off-chain validator

Metronome off chain validators to validate export receipt and attest the same in destination chain.

### Prerequisites
1. Full Synced Parity or Geth node. 
2. Docker 
3. Validator's address must be added as whitelist validators in smart contract. 
4. Must have ether to pay for gas cost of attestation

### Setup & Installing 
<b>Testnet and Mainet:</b>
1. Create metronome validators. using command docker build -t metronome-validator .
2. set appropriate network name in ./config/default.json
3. Set env variables

      eth_http_url=\<ETH node http url:port>

      eth_ws_url=\<ETH node ws url:port>
      
      etc_http_url=\<ETC node http url:port>
      
      etc_ws_url=\<ETC node ws url:port>

      eth_validator_address=\<address>
      
      etc_validator_address=\<address>
      
      One of below to sign transaction.

      a) walletMnemonic=\<mnemonic phrase>
     
      One mnomic phrase can be used for both eth, etc. For more information refer link https://iancoleman.io/bip39 . generate phrase and use correct address in etc_validator_address, eth_validator_address
    
      or
      
      b) etc_validator_password=\<password>
   
      eth_validator_password=\<password>
   
4. docker-compose up

<b>Private network:</b>
1. Git clone https://github.com/autonomoussoftware/metronome-contracts-js .
2. Deploy new contracts in private network.
3. Define network name, update abi, address in metronome-contracts-js.
4. set network name in ./config/default.json. Must be same as defined in #3.
3. Update package.json of metronome validators to use local metronome-contract-js package
4. docker-compose -f docker-compose.dev.yml up 

### License 
MIT
