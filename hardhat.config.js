require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");


module.exports = {
  solidity: "0.7.3",
  gasReporter: {
    currency: 'USD',
    gasPrice: 38
  },
  networks: {
	  hardhat: {
	    chainId: 1337
	  }
	}
};
