# Metronome off-chain validator

Metronome off chain validators to validate export receipt and attest the same in destination chain.

### Prerequisites
1. Full Synced ETH and ETC node.
2. Docker 
3. Validator's address must be added as whitelist validators in smart contract. 
4. Must have ether to pay for gas cost of attestation

### Setup & Installing 
<b>Testnet and Mainet:</b>
1. Create metronome validators image using command below command.
      
      docker build -t metronome-validator 
2. Set following env variables

      eth_http_url=\<ETH node http url:port>

      eth_ws_url=\<ETH node ws url:port>
      
      etc_http_url=\<ETC node http url:port>
      
      etc_ws_url=\<ETC node ws url:port>

      eth_validator_address=\<address>
      
      etc_validator_address=\<address>
      
      walletMnemonic=\<mnemonic phrase>
     
3. Generate mnemonic phrase using offline script available [here](https://github.com/autonomoussoftware/mnemonic-generator). Use the address in etc_validator_address, eth_validator_address. One mnemonic phrase can be used for both eth, etc. For more information about mnomeinic phrase refer link https://iancoleman.io/bip39. 
    
   
4. Execute below command to run validator container 

      docker-compose up

### License 
MIT
