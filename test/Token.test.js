import {tokens, EVM_REVERT} from './helpers'

const Token = artifacts.require('./Token')

require('chai')
	.use(require('chai-as-promised'))
	.should()

contract('Token', ([deployer, receiver, exchange]) => {
	const name = 'DApp Token'
	const symbol = 'DAPP'
	const totalSupply = tokens(1000000).toString()
	const decimals = '18'
	let token

	beforeEach(async () => {
		token = await Token.new()
	})

	describe('deployment', () => {
		it('tracks the name', async ()=>{
			// the token name should be My Name
			const result = await token.name()
			result.should.equal(name)
		})

		it('tracks the symbol', async ()=>{
			const result = await token.symbol()
			result.should.equal(symbol)
		})

		it('tracks the decimals', async ()=>{
			const result = await token.decimals()
			result.toString().should.equal(decimals)
		})

		it('tracks the total supply', async ()=>{
			const result = await token.totalSupply()
			result.toString().should.equal(totalSupply.toString())
		})

		it('assigns to total supply to the deployer', async ()=>{
			const result = await token.balanceOf(deployer)
			result.toString().should.equal(totalSupply.toString())
		})
	})

	describe('sending tokens', () => {
		let amount
		let result

		describe('success', async () => {
			beforeEach(async () => {
				amount = tokens(100).toString()
				result = await token.transfer(receiver, amount, {from: deployer})
			})

			it('transfers token balances', async () => {
				let balanceOf
				balanceOf = await token.balanceOf(deployer)
				balanceOf.toString().should.equal(tokens(999900).toString())
				balanceOf = await token.balanceOf(receiver)
				balanceOf.toString().should.equal(tokens(100).toString())
				
			})

			it('emits transfer event', async () => {
				const log = result.logs[0]
				log.event.should.eq('Transfer')
				
				const event = log.args
				event.from.should.eq(deployer, 'deployer value is correct')
				event.to.should.eq(receiver, 'receiver address is correct')
				event.value.toString().should.eq(amount, 'amount is correct')
			})

		})

		describe('failure', async () => {

			it('rejects insufficient balances', async () => {
				let invalidAmount
				invalidAmount = tokens(100000000) // bigger than actual totalSupply
				// the message 'VM Exception...' is the one printed if require() returns false in Transfer(), i.e. if the below string matches the error message the test passes
				await token.transfer(receiver, invalidAmount, {from: deployer}).should.be.rejectedWith(EVM_REVERT)

				invalidAmount = tokens(10) // reveiver has no tokens
				await token.transfer(deployer, invalidAmount, {from: receiver}).should.be.rejectedWith(EVM_REVERT)
			})

			it('rejects invalid recepient', async () => {
				await token.approve(0x0, amount, {from: deployer}).should.be.rejected
			})
		})
	})

	describe('approving tokens', () => {
		let result
		let amount

		beforeEach(async () => {
			amount = tokens(100)
			result = await token.approve(exchange, amount, {from:deployer})
		})

		describe('success', () => {
			it('allocates an allowance for delegated token spending on exchange', async () => {
				const allowance = await token.allowance(deployer, exchange)
				allowance.toString().should.equal(amount.toString())
			})

			it('emits an Approval event', async () => {
				const log = result.logs[0]
				log.event.should.eq('Approval')
				const event = log.args
				event.owner.should.eq(deployer, 'owner value is correct')
				event.spender.should.eq(exchange, 'spender address is correct')
				event.value.toString().should.eq(amount.toString(), 'amount is correct')
			})
		})

		describe('failure', () => {
			
			it('rejects invalid spender', async () => {
				// the message for bad address is different from invalid amount's error message
				await token.transfer(0x0, amount, {from: deployer}).should.be.rejected
			})
		})
	})

	describe('delegated token transfers', () => {
		let amount
		let result

		beforeEach(async () => {
			amount = tokens(100)
			await token.approve(exchange, amount, {from: deployer})
		})

		describe('success', async () => {
			beforeEach(async () => {
				result = await token.transferFrom(deployer, receiver, amount, {from: exchange})
			})

			it('transfers token balances', async () => {
				let balanceOf
				balanceOf = await token.balanceOf(deployer)
				balanceOf.toString().should.equal(tokens(999900).toString())
				balanceOf = await token.balanceOf(receiver)
				balanceOf.toString().should.equal(tokens(100).toString())
				
			})

			it('resets the allowance', async () => {
				const allowance = await token.allowance(deployer, exchange);
				allowance.toString().should.equal('0');
			})

			it('emits transfer event', async () => {
				const log = result.logs[0]
				log.event.should.eq('Transfer')
				
				const event = log.args
				event.from.should.eq(deployer, 'deployer value is correct')
				event.to.should.eq(receiver, 'receiver address is correct')
				event.value.toString().should.eq(amount.toString(), 'amount is correct')
			})

		})

		describe('failure', async () => {

			it('rejects insufficient amounts', async () => {
				await token.transferFrom(deployer, receiver, tokens(101), {from: exchange}).should.be.rejectedWith(EVM_REVERT) // one token more than allowance
				await token.transferFrom(deployer, receiver, tokens(1000001), {from: exchange}).should.be.rejectedWith(EVM_REVERT) // one token more than total supply
				// TODO should I disallow transferFrom to be the same as msg.sender?
				// In that case I should also disallow giving onself an allowance
			})

			it('rejects invalid recepient', async () => {
				// the message for bad address is different from EVM_REVERT error message
				await token.transferFrom(deployer, 0x0, amount, {from: exchange}).should.be.rejected
			})
		})
	})
})