
const { expect } = require("chai");

describe("Commune contract", function () {

	let CommuneContract;
	let Commune;
	let addr1;
  	let addr2;
  	let ERC20Token;

  	let communeNumber = 2;
  	let treasuryAddress = "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1";

	beforeEach(async function () {
		[owner, addr1, addr2, ...addrs] = await ethers.getSigners();

		await deployERC20From(addr1)		

	    CommuneContract = await ethers.getContractFactory("Commune");
	    

	    Commune = await CommuneContract.deploy(addr1.address);
	    await Commune.deployed();

	    // create dev fund commune 
	    await Commune.connect(addr1).createCommune("", ERC20Token.address, false, true, true)
	    await Commune.connect(addr1).addCommuneMember(addr1.address, 1)
	    await Commune.connect(addr1).setTreasuryAddress(treasuryAddress)
  	});	


	describe("createCommune", function () {
		it("does not allow if asset not allowed", async function(){
			await Commune.createCommune("", addr2.address, false, true, true)
		})

		it("correctly sets asset", async function(){
			Commune.createCommune("", ERC20Token.address, false, true, true)
			
			const asset = await communeAsset(communeNumber)
			expect(asset).to.equal(ERC20Token.address)
		})

		it("increases the number of communes", async function () {
		  const before = await Commune.numberOfCommunes();
		  await Commune.createCommune("", ERC20Token.address, false, true, true)
	      const count = await Commune.numberOfCommunes();
	      expect(count).to.equal(parseInt(before) + 1);
		});

		it("creates with no commune members", async function () {		  
		  await Commune.createCommune("", ERC20Token.address, false, true, true)

	      const members = await communeMemberCount(communeNumber)
	      expect(members).to.equal(0);
		});

		it("correctly sets allowsJoining", async function () {
			await Commune.createCommune("", ERC20Token.address, false, true, true)

			const allowsJoining = await communeAllowsJoining(communeNumber)
			expect(allowsJoining).to.equal(false)
		});

		it("emits URI and stores it", async function(){
			await expect(
				Commune.createCommune("my/uri", ERC20Token.address, false, true, true)
				).to.emit(Commune, "URI").withArgs("my/uri", communeNumber)
			const uri = await Commune.uri(communeNumber)
			expect(uri).to.equal("my/uri")
			
		})

		it("correctly sets allowsOutsideContribution", async function () {
			await Commune.createCommune("", ERC20Token.address, false, true, false)
			
			const allowsOutsideContribution = await communeAllowsOutsideContribution(communeNumber)
			expect(allowsOutsideContribution).to.equal(false)
		});

		it("correctly sets allowsRemoving", async function () {
			await Commune.createCommune("", ERC20Token.address, false, true, true)
			
			const allowsRemoving = await communeAllowsRemoving(communeNumber)
			expect(allowsRemoving).to.equal(true)
		});
	});

	describe("contribute", function () {
		it("does not allow contribution from non member if otutside contributions not allowed", async function () {
			await Commune.createCommune("", ERC20Token.address, false, true, false)

			const amount = BigInt(Math.pow(10,18));

			await expect(
				Commune.connect(addr1).contribute(amount, communeNumber)
				).to.be.revertedWith("Must be a member to contribute");
		});

		it("does allow contribution from non member if otutside contributions allowed", async function () {
			const amount = BigInt(Math.pow(10,18));
			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await expect(
				Commune.connect(addr1).contribute(amount, 1)
				).not.to.be.reverted
		});


		it("adds to contract address' ERC20 balance", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18))
			const afterFee = await amountAfterFee(amount)

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balance = await ERC20Token.balanceOf(Commune.address)
			expect(balance).to.equal(afterFee)
		});

		it("increases commune's prorated total", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const proratedTotal = await communeProratedTotal(communeNumber)
			expect(proratedTotal).to.equal(amountToMembers)
		});

		it("increases dev fund's ERC20 balance", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18));

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balance = await ERC20Token.balanceOf(treasuryAddress)
			const communeBalance = await ERC20Token.balanceOf(Commune.address)

			const afterFee = await amountAfterFee(amount)
			const expectedBalance = amount - BigInt(afterFee)

			expect(balance).to.equal(expectedBalance)
		});

		it("emits contribute", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18));

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await expect(
			 Commune.connect(addr1).contribute(amount, communeNumber)
			).to.emit(Commune, "Contribute").withArgs(addr1.address, communeNumber, amount)
		});
	});

	describe("balanceOf", function () {
		it("returns the correct balance after no contribution", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			const balance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(balance).to.equal(0)
		});

		it("returns the correct balance after one contribution", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18))
			const amountToMembers = await amountAfterFee(amount)

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(balance).to.equal(amountToMembers)
		});

		it("returns the correct balance after two contributions", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			const amount = Math.pow(10,18);

			ERC20Token.connect(addr1).approve(Commune.address, amount * 2 + "")
			await Commune.connect(addr1).contribute(amount + "", communeNumber)

			await Commune.connect(addr2).joinCommune(communeNumber)

			await Commune.connect(addr1).contribute(amount + "", communeNumber)

			const addr1CommuneBalance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(addr1CommuneBalance).to.equal(amount * 1.5 * 0.99 + "")

			const addr2CommuneBalance = await Commune.balanceOf(addr2.address, communeNumber)
			expect(addr2CommuneBalance).to.equal(amount * 0.5 * 0.99  + "")
		});

		it("returns the correct balance after a withdraw", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)
			const withdrawAmount = BigInt(Math.pow(5,18));


			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)
			await Commune.connect(addr1).withdraw(addr1.address, addr2.address, communeNumber, withdrawAmount)

			const balance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(balance).to.equal(amountToMembers - withdrawAmount)
		});

		it("returns 0 if commune doesn't exist", async function () {
			const balance = await Commune.balanceOf(addr1.address, communeNumber )
			expect(balance).to.equal(0)
		});

		it("returns 0 if address is not in commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18));

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balance = await Commune.balanceOf(addr1.address, communeNumber )
			expect(balance).to.equal(0)
		});
	});

	// TODO: balancOfBatch
	describe("balanceOfBatch", function () {
		it("returns the correct balance when given one address/commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,18))
			const amountToMembers = await amountAfterFee(amount)

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balancesResp = await Commune.balanceOfBatch([addr1.address], [communeNumber])
			expect(balancesResp[0]).to.equal(amountToMembers)
			expect(balancesResp.length).to.equal(1)
		});

		it("returns the correct balance when given two address/commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)
			await Commune.connect(addr2).joinCommune(communeNumber)

			const amount = BigInt(Math.pow(10,9))
			const amountToMembers = await amountAfterFee(amount)

			ERC20Token.connect(addr1).approve(Commune.address, amount * BigInt(2))

			await Commune.connect(addr1).contribute(amount * BigInt(2), communeNumber)

			const balancesResp = await Commune.balanceOfBatch([addr1.address, addr2.address], [communeNumber, communeNumber])
			expect(balancesResp[0]).to.equal(amountToMembers)
			expect(balancesResp[1]).to.equal(amountToMembers)
			expect(balancesResp.length).to.equal(2)
		});

		it("returns 0 if commune doesn't exist", async function () {
			const amount = BigInt(0)

			const balancesResp = await Commune.balanceOfBatch([addr1.address], [communeNumber])
			expect(balancesResp[0]).to.equal(amount)
			expect(balancesResp.length).to.equal(1)
		});

		it("returns 0 if not a member of commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)
			
			const amount = BigInt(Math.pow(10,18))

			ERC20Token.connect(addr1).approve(Commune.address, amount)

			await Commune.connect(addr1).contribute(amount, communeNumber)

			const balancesResp = await Commune.balanceOfBatch([addr1.address], [communeNumber])
			expect(balancesResp[0]).to.equal(BigInt(0))
			expect(balancesResp.length).to.equal(1)
		});
	});
	
	describe("withdraw", function () {
		it("reverts if commune doesn't exist", async function () {
			const amount = BigInt(Math.pow(10,18));
			await expect(
				Commune.connect(addr1).withdraw(addr1.address, addr2.address, communeNumber, amount)
				).to.be.revertedWith("Commune: withdraw amount exceeds balance")
		});

		it("reverts if amount greater than balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const tooBigAmount = BigInt(Math.pow(10,19));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await expect(
				Commune.connect(addr1).withdraw(addr1.address, addr1.address, communeNumber, tooBigAmount)
				).to.be.revertedWith("Commune: withdraw amount exceeds balance")
		});

		it("increases to address' asset balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToSend = BigInt(Math.pow(10,5));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await Commune.connect(addr1).withdraw(addr1.address, addr2.address, communeNumber, amountToSend)

			const balance = await ERC20Token.balanceOf(addr2.address)
			expect(balance).to.equal(amountToSend)
		});

		it("decreases from address' commune balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)
			const amountToSend = BigInt(Math.pow(10,5));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await Commune.connect(addr1).withdraw(addr1.address, addr2.address, communeNumber, amountToSend)

			const balance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(balance).to.equal(amountToMembers - amountToSend)
		});

		it("emits withdraw", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)
			const amountToSend = BigInt(Math.pow(10,5));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await expect(
				Commune.connect(addr1).withdraw(addr1.address, addr2.address, communeNumber, amountToSend)
			).to.emit(Commune, "Withdraw").withArgs(addr1.address, addr1.address, addr2.address, communeNumber, amountToSend)
		});
	});
	
	describe("withdrawBatch", function () {
		it("reverts if commune doesn't exist", async function () {
			const amount = BigInt(Math.pow(10,18));
			await expect(
				Commune.connect(addr1).withdrawBatch(addr1.address, addr2.address, [communeNumber], [amount])
				).to.be.revertedWith("Commune: withdraw amount exceeds balance")
		});

		it("reverts if amount greater than balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const tooBigAmount = BigInt(Math.pow(10,19));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await expect(
				Commune.connect(addr1).withdrawBatch(addr1.address, addr1.address, [communeNumber, communeNumber], [amount, tooBigAmount])
				).to.be.revertedWith("Commune: withdraw amount exceeds balance")
		});

		it("increases to address' asset balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToSend = BigInt(Math.pow(10,4));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await Commune.connect(addr1).withdrawBatch(addr1.address, addr2.address, [communeNumber, communeNumber], [amountToSend, amountToSend])

			const balance = await ERC20Token.balanceOf(addr2.address)
			expect(balance).to.equal(BigInt(Math.pow(10,4) * 2))
		});

		it("decreases from address' commune balance", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)
			const amountToSend = BigInt(Math.pow(10,5));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await Commune.connect(addr1).withdrawBatch(addr1.address, addr2.address, [communeNumber], [amountToSend])

			const balance = await Commune.balanceOf(addr1.address, communeNumber)
			expect(balance).to.equal(amountToMembers - amountToSend)
		});

		it("emits withdrawBatch", async function () {
			const amount = BigInt(Math.pow(10,18));
			const amountToMembers = await amountAfterFee(amount)
			const amountToSend = BigInt(Math.pow(10,5));

			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).joinCommune(communeNumber)

			ERC20Token.connect(addr1).approve(Commune.address, amount)
			await Commune.connect(addr1).contribute(amount, communeNumber)

			await expect(
				Commune.connect(addr1).withdrawBatch(addr1.address, addr2.address, [communeNumber], [amountToSend])
			).to.emit(Commune, "WithdrawBatch").withArgs(addr1.address, addr1.address, addr2.address, [communeNumber], [amountToSend])
		});
	});

	describe("joinCommune", function () {
		it("does not allow joining if not allowed", async function () {
			await Commune.createCommune("", ERC20Token.address, false, true, true)

			await expect(
				Commune.connect(addr2).joinCommune(communeNumber)
				).to.be.revertedWith("Commune: commune does not allow joining");
		});

		it("does allow outsider to join if join allowed", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)

			await expect(
				Commune.connect(addr2).joinCommune(communeNumber)
				).not.to.be.reverted
		});

		it("emits AddCommuneMember event", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)

			await expect(
				Commune.connect(addr2).joinCommune(communeNumber)
				).to.emit(Commune, "AddCommuneMember").withArgs(addr2.address, communeNumber)
		});

		it("adds member to commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)
			
			// check that member is added to commune
			const isMember = await Commune.isCommuneMember(communeNumber, addr2.address)
			expect(isMember).to.equal(true)

			const members = await communeMemberCount(communeNumber);
	      	expect(members).to.equal(1);
		});

		it("reverts if account already in commune", async function () {
			await Commune.createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)

			await expect(
				 Commune.connect(addr2).joinCommune(communeNumber)
				).to.be.revertedWith("Commune: account is already in commune");
		});

	});

	describe("addCommuneMember", function () {
		it("adds member to commune", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).addCommuneMember(addr2.address, communeNumber)
			
			// check that member is added to commune
			const isMember = await Commune.isCommuneMember(communeNumber, addr2.address)
			expect(isMember).to.equal(true)

			const members = await communeMemberCount(communeNumber);
	      	expect(members).to.equal(1);
		});
	});

	describe("leaveCommune", function () {
		it("reverts if not in commune", async function() {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, false, true, true)
			await expect(
				Commune.connect(addr2).leaveCommune(communeNumber)
				).to.be.revertedWith("Commune: account is not in commune")
		});

		it("removes commune member", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)
			await Commune.connect(addr2).leaveCommune(communeNumber)

			const isCommuneMember = await Commune.isCommuneMember(communeNumber, addr1.address)
			expect(isCommuneMember).to.equal(false)

			const memberCount = await communeMemberCount(communeNumber);
			expect(memberCount).to.equal(0)
		});

		it("emits", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr2).joinCommune(communeNumber)
			await expect(
				 Commune.connect(addr2).leaveCommune(communeNumber)
				).to.emit(Commune, "RemoveCommuneMember").withArgs(addr2.address, communeNumber)
		});

	});

	describe("removeFromCommune", function () {
		it("only can be called by controller", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, false, true, true)
			await expect(
				 Commune.connect(addr2).removeCommuneMember(addr1.address, communeNumber)
				).to.be.revertedWith("Commune: only the commune controller can do this")
		});

		it("reverts if removing not allowed for commune", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, true, false, true)
			await Commune.connect(addr1).addCommuneMember(addr2.address, communeNumber)
			await expect(
				 Commune.connect(addr1).removeCommuneMember(addr2.address, communeNumber)
				).to.be.revertedWith("Commune: commune does not allow removing")
		});

		it("removes commune member", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, false, true, true)
			await Commune.connect(addr1).addCommuneMember(addr2.address, communeNumber)

			Commune.connect(addr1).removeCommuneMember(addr2.address, communeNumber)

			const isCommuneMember = await Commune.isCommuneMember(communeNumber, addr1.address)
			expect(isCommuneMember).to.equal(false)

			const memberCount = await communeMemberCount(communeNumber);
			expect(memberCount).to.equal(0)
				
		});

		it("emits", async function () {
			await Commune.connect(addr1).createCommune("", ERC20Token.address, false, true, true)
			await Commune.connect(addr1).addCommuneMember(addr2.address, communeNumber)
			await expect(
				Commune.connect(addr1).removeCommuneMember(addr2.address, communeNumber)
				).to.emit(Commune, "RemoveCommuneMember").withArgs(addr2.address, communeNumber)
		});

	});

	async function deployERC20From(address) {
		TokenContract = await ethers.getContractFactory("ERC20Token");
	    ERC20Token = await TokenContract.connect(address).deploy();
	    await ERC20Token.deployed();
	}	

	async function amountAfterFee(amount) {
		feeRate = await Commune.feeRate()
		fee = (amount * BigInt(feeRate)) / BigInt(10000)
		return amount - fee
	}

	async function communeAllowsJoining(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[0]
	}

	async function communeAllowsRemoving(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[1]
	}	

	async function communeAllowsOutsideContribution(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[2]
	}		

	async function communeAsset(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[3]
	}	

	async function communeProratedTotal(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[4]
	}

	async function communeMemberCount(communeID) {
		const data = await Commune.getCommune(communeID)
		return data[5]
	}

});