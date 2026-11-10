//! Real in-process Solana Bank execution + SPL CPIs, not mocked balances.
//! No validator process, SBF binary, devnet or mainnet transaction is used.
use borsh::{BorshDeserialize, BorshSerialize};
use proofpak_escrow::{self as escrow, Escrow, Instruction as Action, Stage, TEST_MINT};
use solana_program::{program_option::COption, program_pack::Pack, pubkey::Pubkey};
use solana_program_test::{processor, ProgramTest, ProgramTestContext};
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use spl_token::state::{Account as TokenAccount, AccountState, Mint};
struct Harness {
    ctx: ProgramTestContext,
    id: Pubkey,
    payer: Keypair,
    worker: Keypair,
    resolver: Keypair,
    attacker: Keypair,
    state: Pubkey,
    vault: Pubkey,
    source: Pubkey,
    destination: Pubkey,
    attack_token: Pubkey,
}
fn token_account(mint: Pubkey, owner: Pubkey, amount: u64) -> Account {
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(
        TokenAccount {
            mint,
            owner,
            amount,
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    Account {
        lamports: 10_000_000,
        data,
        owner: spl_token::id(),
        executable: false,
        rent_epoch: 0,
    }
}
impl Harness {
    async fn new() -> Self {
        let id = Pubkey::new_unique();
        let payer = Keypair::new();
        let worker = Keypair::new();
        let resolver = Keypair::new();
        let attacker = Keypair::new();
        let source = Pubkey::new_unique();
        let destination = Pubkey::new_unique();
        let attack_token = Pubkey::new_unique();
        let (state, _) = escrow::state_address(&id, &payer.pubkey(), &[7; 32]);
        let (vault, _) = escrow::vault_address(&id, &state);
        let mut bank = ProgramTest::new(
            "proofpak_escrow",
            id,
            processor!(escrow::process_instruction),
        );
        bank.add_program(
            "spl_token",
            spl_token::id(),
            processor!(spl_token::processor::Processor::process),
        );
        for key in [
            payer.pubkey(),
            worker.pubkey(),
            resolver.pubkey(),
            attacker.pubkey(),
        ] {
            bank.add_account(
                key,
                Account::new(2_000_000_000, 0, &solana_sdk::system_program::id()),
            );
        }
        let mut mint = vec![0; Mint::LEN];
        Mint::pack(
            Mint {
                mint_authority: COption::None,
                supply: 1_000_000_000,
                decimals: 6,
                is_initialized: true,
                freeze_authority: COption::None,
            },
            &mut mint,
        )
        .unwrap();
        bank.add_account(
            TEST_MINT,
            Account {
                lamports: 10_000_000,
                data: mint,
                owner: spl_token::id(),
                executable: false,
                rent_epoch: 0,
            },
        );
        bank.add_account(
            source,
            token_account(TEST_MINT, payer.pubkey(), 1_000_000_000),
        );
        bank.add_account(destination, token_account(TEST_MINT, worker.pubkey(), 0));
        bank.add_account(attack_token, token_account(TEST_MINT, attacker.pubkey(), 0));
        Self {
            ctx: bank.start_with_context().await,
            id,
            payer,
            worker,
            resolver,
            attacker,
            state,
            vault,
            source,
            destination,
            attack_token,
        }
    }
    fn basic(&self, authority: Pubkey, sign: bool) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new(authority, sign),
            AccountMeta::new(self.state, false),
        ]
    }
    fn instruction(&self, action: Action, authority: Pubkey) -> Instruction {
        let mut keys = self.basic(authority, true);
        match &action {
            Action::Create { .. } => keys.extend([
                AccountMeta::new(self.vault, false),
                AccountMeta::new_readonly(TEST_MINT, false),
                AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
                AccountMeta::new_readonly(spl_token::id(), false),
            ]),
            Action::Fund { .. } => keys.extend([
                AccountMeta::new(self.vault, false),
                AccountMeta::new(self.source, false),
                AccountMeta::new_readonly(TEST_MINT, false),
                AccountMeta::new_readonly(spl_token::id(), false),
            ]),
            Action::Release { .. } | Action::Refund { .. } | Action::Resolve { .. } => {
                if matches!(action, Action::Refund { .. }) {
                    keys.push(AccountMeta::new_readonly(self.worker.pubkey(), true));
                }
                keys.extend([
                    AccountMeta::new(self.vault, false),
                    AccountMeta::new(self.destination, false),
                    AccountMeta::new(self.source, false),
                    AccountMeta::new_readonly(TEST_MINT, false),
                    AccountMeta::new_readonly(spl_token::id(), false),
                ]);
            }
            _ => {}
        }
        Instruction {
            program_id: self.id,
            accounts: keys,
            data: borsh::to_vec(&action).unwrap(),
        }
    }
    async fn run(&mut self, ix: Instruction, signers: Vec<&Keypair>) -> bool {
        let block = self.ctx.get_new_latest_blockhash().await.unwrap();
        let mut all = vec![&self.ctx.payer];
        all.extend(signers);
        let tx =
            Transaction::new_signed_with_payer(&[ix], Some(&self.ctx.payer.pubkey()), &all, block);
        self.ctx.banks_client.process_transaction(tx).await.is_ok()
    }
    async fn send(&mut self, action: Action, role: &str) -> bool {
        // Clone ephemeral test keys to keep borrowing local; never serialized to files.
        let key = match role {
            "payer" => Keypair::from_bytes(&self.payer.to_bytes()).unwrap(),
            "worker" => Keypair::from_bytes(&self.worker.to_bytes()).unwrap(),
            "resolver" => Keypair::from_bytes(&self.resolver.to_bytes()).unwrap(),
            _ => Keypair::from_bytes(&self.attacker.to_bytes()).unwrap(),
        };
        let ix = self.instruction(action, key.pubkey());
        self.run(ix, vec![&key]).await
    }
    async fn create(&mut self, full: bool, resolver: bool, amounts: Vec<u64>) -> bool {
        self.send(
            Action::Create {
                agreement: [7; 32],
                terms: [8; 32],
                worker: self.worker.pubkey(),
                resolver: resolver.then_some(self.resolver.pubkey()),
                amounts,
                full_funding: full,
            },
            "payer",
        )
        .await
    }
    async fn read(&mut self) -> Escrow {
        let a = self
            .ctx
            .banks_client
            .get_account(self.state)
            .await
            .unwrap()
            .unwrap();
        Escrow::deserialize(&mut a.data.as_slice()).unwrap()
    }
    async fn balance(&mut self, key: Pubkey) -> u64 {
        TokenAccount::unpack(
            &self
                .ctx
                .banks_client
                .get_account(key)
                .await
                .unwrap()
                .unwrap()
                .data,
        )
        .unwrap()
        .amount
    }
    async fn approve(&mut self, index: u8) {
        assert!(self.send(Action::Start { index }, "worker").await);
        assert!(
            self.send(
                Action::Submit {
                    index,
                    evidence: [9; 32]
                },
                "worker"
            )
            .await
        );
        assert!(
            self.send(
                Action::Review {
                    index,
                    approve: true
                },
                "payer"
            )
            .await
        );
    }
}
#[tokio::test]
async fn full_custody_and_exact_releases() {
    let mut h = Harness::new().await;
    assert!(h.create(true, true, vec![200, 300, 500]).await);
    assert!(!h.send(Action::Fund { index: 0 }, "payer").await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    assert_eq!(h.balance(h.vault).await, 1000);
    assert_eq!(h.balance(h.source).await, 1_000_000_000 - 1000);
    assert!(!h.send(Action::Fund { index: 0 }, "payer").await);
    h.approve(0).await;
    assert!(h.send(Action::Release { index: 0 }, "payer").await);
    assert_eq!(h.balance(h.destination).await, 200);
    assert_eq!(h.balance(h.vault).await, 800);
    assert!(!h.send(Action::Release { index: 0 }, "payer").await);
    assert_eq!(h.read().await.milestones[0].stage, Stage::Paid);
}
#[tokio::test]
async fn incremental_funding_blocks_work_and_future_funding() {
    let mut h = Harness::new().await;
    assert!(h.create(false, false, vec![200, 300]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(!h.send(Action::Start { index: 0 }, "worker").await);
    assert!(!h.send(Action::Fund { index: 1 }, "payer").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    assert!(!h.send(Action::Start { index: 1 }, "worker").await);
    h.approve(0).await;
    assert!(h.send(Action::Release { index: 0 }, "payer").await);
    assert!(h.send(Action::Fund { index: 1 }, "payer").await);
    assert_eq!(h.balance(h.vault).await, 300);
}
#[tokio::test]
async fn wrong_signers_and_account_substitution_fail() {
    let mut h = Harness::new().await;
    assert!(h.create(true, true, vec![200]).await);
    assert!(!h.send(Action::Accept, "attacker").await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(!h.send(Action::Fund { index: 0 }, "attacker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    h.approve(0).await;
    assert!(!h.send(Action::Release { index: 0 }, "attacker").await);
    let payer = Keypair::from_bytes(&h.payer.to_bytes()).unwrap();
    let mut ix = h.instruction(Action::Release { index: 0 }, payer.pubkey());
    ix.accounts[3].pubkey = h.attack_token;
    assert!(!h.run(ix, vec![&payer]).await);
    assert_eq!(h.balance(h.vault).await, 200);
    assert_eq!(h.balance(h.attack_token).await, 0);
    let mut wrong = h.instruction(Action::Release { index: 0 }, payer.pubkey());
    wrong.accounts[2].pubkey = h.source;
    assert!(!h.run(wrong, vec![&payer]).await);
    assert_eq!(h.balance(h.vault).await, 200);
}
#[tokio::test]
async fn disputes_lock_normal_release_and_resolver_is_bounded() {
    let mut h = Harness::new().await;
    assert!(h.create(true, true, vec![200]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    h.approve(0).await;
    assert!(h.send(Action::Dispute { index: 0 }, "worker").await);
    assert!(!h.send(Action::Release { index: 0 }, "payer").await);
    assert!(
        !h.send(
            Action::Resolve {
                index: 0,
                worker_amount: 201
            },
            "resolver"
        )
        .await
    );
    assert!(
        !h.send(
            Action::Resolve {
                index: 0,
                worker_amount: 100
            },
            "attacker"
        )
        .await
    );
    assert!(
        h.send(
            Action::Resolve {
                index: 0,
                worker_amount: 150
            },
            "resolver"
        )
        .await
    );
    assert_eq!(h.balance(h.destination).await, 150);
    assert_eq!(h.balance(h.vault).await, 0);
    assert_eq!(h.read().await.milestones[0].refunded, 50);
    assert!(
        !h.send(
            Action::Resolve {
                index: 0,
                worker_amount: 150
            },
            "resolver"
        )
        .await
    );
}
#[tokio::test]
async fn refund_requires_both_parties_and_cannot_repeat() {
    let mut h = Harness::new().await;
    assert!(h.create(true, false, vec![200]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    let payer = Keypair::from_bytes(&h.payer.to_bytes()).unwrap();
    let worker = Keypair::from_bytes(&h.worker.to_bytes()).unwrap();
    let mut ix = h.instruction(Action::Refund { index: 0 }, payer.pubkey());
    ix.accounts[2].is_signer = false;
    assert!(!h.run(ix, vec![&payer]).await);
    let ix = h.instruction(Action::Refund { index: 0 }, payer.pubkey());
    assert!(h.run(ix.clone(), vec![&payer, &worker]).await);
    assert_eq!(h.balance(h.source).await, 1_000_000_000);
    assert_eq!(h.balance(h.vault).await, 0);
    assert!(!h.run(ix, vec![&payer, &worker]).await);
}
#[tokio::test]
async fn malformed_terms_mint_overflow_and_wrong_pda_fail() {
    let mut h = Harness::new().await;
    assert!(!h.create(true, false, vec![u64::MAX, 1]).await);
    assert!(!h.create(true, false, vec![0]).await);
    let payer = Keypair::from_bytes(&h.payer.to_bytes()).unwrap();
    let mut ix = h.instruction(
        Action::Create {
            agreement: [7; 32],
            terms: [8; 32],
            worker: h.worker.pubkey(),
            resolver: None,
            amounts: vec![200],
            full_funding: true,
        },
        payer.pubkey(),
    );
    ix.accounts[3].pubkey = h.source;
    assert!(!h.run(ix, vec![&payer]).await);
    let mut ix = h.instruction(
        Action::Create {
            agreement: [7; 32],
            terms: [8; 32],
            worker: h.worker.pubkey(),
            resolver: None,
            amounts: vec![200],
            full_funding: true,
        },
        payer.pubkey(),
    );
    ix.accounts[1].pubkey = h.attack_token;
    assert!(!h.run(ix, vec![&payer]).await);
}
#[tokio::test]
async fn cooperative_resolution_without_a_resolver_and_no_unilateral_exit() {
    let mut h = Harness::new().await;
    assert!(h.create(true, false, vec![200]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    assert!(!h.send(Action::Close, "payer").await);
    assert!(h.send(Action::Dispute { index: 0 }, "payer").await);
    assert!(
        !h.send(
            Action::Resolve {
                index: 0,
                worker_amount: 80
            },
            "payer"
        )
        .await
    );
    assert_eq!(h.balance(h.vault).await, 200);
    let payer = Keypair::from_bytes(&h.payer.to_bytes()).unwrap();
    let worker = Keypair::from_bytes(&h.worker.to_bytes()).unwrap();
    let mut ix = h.instruction(
        Action::Resolve {
            index: 0,
            worker_amount: 80,
        },
        payer.pubkey(),
    );
    ix.accounts
        .insert(2, AccountMeta::new_readonly(worker.pubkey(), true));
    assert!(h.run(ix, vec![&payer, &worker]).await);
    assert_eq!(h.balance(h.destination).await, 80);
    assert_eq!(h.read().await.milestones[0].refunded, 120);
}
#[tokio::test]
async fn revision_flow_and_required_signatures() {
    let mut h = Harness::new().await;
    assert!(h.create(true, true, vec![200]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(h.send(Action::Fund { index: 0 }, "payer").await);
    assert!(!h.send(Action::Release { index: 0 }, "payer").await);
    assert!(h.send(Action::Start { index: 0 }, "worker").await);
    assert!(
        h.send(
            Action::Submit {
                index: 0,
                evidence: [9; 32]
            },
            "worker"
        )
        .await
    );
    assert!(
        !h.send(
            Action::Review {
                index: 0,
                approve: true
            },
            "worker"
        )
        .await
    );
    assert!(
        h.send(
            Action::Review {
                index: 0,
                approve: false
            },
            "payer"
        )
        .await
    );
    assert!(
        h.send(
            Action::Submit {
                index: 0,
                evidence: [10; 32]
            },
            "worker"
        )
        .await
    );
    assert!(
        h.send(
            Action::Review {
                index: 0,
                approve: true
            },
            "payer"
        )
        .await
    );
    let mut ix = h.instruction(Action::Release { index: 0 }, h.payer.pubkey());
    ix.accounts[0].is_signer = false;
    assert!(!h.run(ix, vec![]).await);
    assert_eq!(h.balance(h.vault).await, 200);
    assert!(h.send(Action::Release { index: 0 }, "payer").await);
}
#[tokio::test]
async fn insufficient_deposit_is_atomic_and_wrong_token_program_fails() {
    let mut h = Harness::new().await;
    assert!(h.create(true, true, vec![1_000_000_001]).await);
    assert!(h.send(Action::Accept, "worker").await);
    assert!(!h.send(Action::Fund { index: 0 }, "payer").await);
    assert_eq!(h.balance(h.vault).await, 0);
    assert_eq!(h.balance(h.source).await, 1_000_000_000);
    assert_eq!(h.read().await.milestones[0].stage, Stage::Unfunded);
    let payer = Keypair::from_bytes(&h.payer.to_bytes()).unwrap();
    let mut ix = h.instruction(Action::Fund { index: 0 }, payer.pubkey());
    ix.accounts[5].pubkey = solana_sdk::system_program::id();
    assert!(!h.run(ix, vec![&payer]).await);
    assert_eq!(h.balance(h.vault).await, 0);
}
#[tokio::test]
async fn unfunded_cancellation_preserves_identity_and_reinitialization_is_rejected() {
    let mut h = Harness::new().await;
    assert!(h.create(true, false, vec![200]).await);
    assert!(!h.create(true, false, vec![300]).await);
    assert!(!h.send(Action::Close, "attacker").await);
    assert!(h.send(Action::Close, "worker").await);
    assert!(h.read().await.closed);
    assert!(!h.send(Action::Accept, "worker").await);
    assert!(!h.create(true, false, vec![200]).await);
}
