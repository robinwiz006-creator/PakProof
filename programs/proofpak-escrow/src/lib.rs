//! Development-only classic SPL-token escrow. No admin withdrawal or mutable terms.
#![allow(unexpected_cfgs)]
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};
use spl_token::state::{Account as TokenAccount, AccountState, Mint};
#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);
pub const MAX_MILESTONES: usize = 20;
pub const STATE_SIZE: usize = 2048;
pub const MAGIC: [u8; 8] = *b"PPESCR01";
pub const TEST_MINT: Pubkey =
    solana_program::pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Stage {
    Unfunded,
    Funded,
    Active,
    Submitted,
    Revision,
    Approved,
    Disputed,
    Paid,
    Refunded,
    Resolved,
}
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Milestone {
    pub amount: u64,
    pub stage: Stage,
    pub evidence: [u8; 32],
    pub released: u64,
    pub refunded: u64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Escrow {
    pub magic: [u8; 8],
    pub payer: Pubkey,
    pub worker: Pubkey,
    pub resolver: Option<Pubkey>,
    pub agreement: [u8; 32],
    pub terms: [u8; 32],
    pub full_funding: bool,
    pub accepted: bool,
    pub closed: bool,
    pub milestones: Vec<Milestone>,
}
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub enum Instruction {
    Create {
        agreement: [u8; 32],
        terms: [u8; 32],
        worker: Pubkey,
        resolver: Option<Pubkey>,
        amounts: Vec<u64>,
        full_funding: bool,
    },
    Accept,
    Fund {
        index: u8,
    },
    Start {
        index: u8,
    },
    Submit {
        index: u8,
        evidence: [u8; 32],
    },
    Review {
        index: u8,
        approve: bool,
    },
    Release {
        index: u8,
    },
    Dispute {
        index: u8,
    },
    /// Refund an entire unsettled milestone only with both original parties signing.
    Refund {
        index: u8,
    },
    /// Only a disputed milestone, to original parties only, bounded by its amount.
    Resolve {
        index: u8,
        worker_amount: u64,
    },
    Close,
}
fn require(ok: bool) -> ProgramResult {
    if ok {
        Ok(())
    } else {
        Err(ProgramError::InvalidArgument)
    }
}
fn signer(a: &AccountInfo, key: &Pubkey) -> ProgramResult {
    require(a.is_signer && a.key == key)
}
pub fn state_address(program: &Pubkey, payer: &Pubkey, id: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"escrow", payer.as_ref(), id], program)
}
pub fn vault_address(program: &Pubkey, state: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"vault", state.as_ref()], program)
}
fn read(program: &Pubkey, a: &AccountInfo) -> Result<Escrow, ProgramError> {
    require(a.owner == program && a.is_writable && !a.executable)?;
    let data = a.try_borrow_data()?;
    let mut bytes = &data[..];
    let state = Escrow::deserialize(&mut bytes).map_err(|_| ProgramError::InvalidAccountData)?;
    require(
        state.magic == MAGIC
            && state.milestones.len() > 0
            && state.milestones.len() <= MAX_MILESTONES
            && state_address(program, &state.payer, &state.agreement).0 == *a.key,
    )?;
    Ok(state)
}
fn write(a: &AccountInfo, s: &Escrow) -> ProgramResult {
    let bytes = borsh::to_vec(s).map_err(|_| ProgramError::InvalidAccountData)?;
    let mut data = a.try_borrow_mut_data()?;
    require(bytes.len() <= data.len())?;
    data.fill(0);
    data[..bytes.len()].copy_from_slice(&bytes);
    Ok(())
}
fn token(a: &AccountInfo, mint: &Pubkey, owner: &Pubkey) -> Result<TokenAccount, ProgramError> {
    require(a.owner == &spl_token::id() && !a.executable)?;
    let t = TokenAccount::unpack(&a.try_borrow_data()?)?;
    require(
        t.mint == *mint
            && t.owner == *owner
            && t.state == AccountState::Initialized
            && t.delegate.is_none()
            && t.close_authority.is_none(),
    )?;
    Ok(t)
}
fn vault(program: &Pubkey, state: &AccountInfo, a: &AccountInfo) -> ProgramResult {
    require(vault_address(program, state.key).0 == *a.key && a.is_writable)?;
    token(a, &TEST_MINT, state.key)?;
    Ok(())
}
fn allocate<'a>(
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    owner: &Pubkey,
    size: usize,
    seeds: &[&[u8]],
) -> ProgramResult {
    require(
        system.key == &system_program::id()
            && target.owner == &system_program::id()
            && target.data_is_empty()
            && target.is_writable
            && payer.is_writable,
    )?;
    let rent = Rent::get()?.minimum_balance(size);
    if target.lamports() == 0 {
        invoke_signed(
            &system_instruction::create_account(payer.key, target.key, rent, size as u64, owner),
            &[payer.clone(), target.clone(), system.clone()],
            &[seeds],
        )?;
    } else {
        if target.lamports() < rent {
            invoke(
                &system_instruction::transfer(payer.key, target.key, rent - target.lamports()),
                &[payer.clone(), target.clone(), system.clone()],
            )?;
        }
        invoke_signed(
            &system_instruction::allocate(target.key, size as u64),
            &[target.clone(), system.clone()],
            &[seeds],
        )?;
        invoke_signed(
            &system_instruction::assign(target.key, owner),
            &[target.clone(), system.clone()],
            &[seeds],
        )?;
    }
    Ok(())
}
fn move_tokens<'a>(
    source: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    destination: &AccountInfo<'a>,
    authority: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    amount: u64,
    seeds: Option<&[&[u8]]>,
) -> ProgramResult {
    require(
        token_program.key == &spl_token::id()
            && token_program.executable
            && source.is_writable
            && destination.is_writable
            && source.key != destination.key,
    )?;
    let instruction = spl_token::instruction::transfer_checked(
        token_program.key,
        source.key,
        mint.key,
        destination.key,
        authority.key,
        &[],
        amount,
        6,
    )?;
    let accounts = [
        source.clone(),
        mint.clone(),
        destination.clone(),
        authority.clone(),
        token_program.clone(),
    ];
    if let Some(seed) = seeds {
        invoke_signed(&instruction, &accounts, &[seed])
    } else {
        invoke(&instruction, &accounts)
    }
}
fn remaining(s: &Escrow) -> Result<u64, ProgramError> {
    s.milestones
        .iter()
        .filter(|m| {
            !matches!(
                m.stage,
                Stage::Unfunded | Stage::Paid | Stage::Refunded | Stage::Resolved
            )
        })
        .try_fold(0u64, |sum, m| {
            sum.checked_add(m.amount)
                .ok_or(ProgramError::ArithmeticOverflow)
        })
}
pub fn process_instruction(
    program: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let ix = Instruction::try_from_slice(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    let mut it = accounts.iter();
    let authority = next_account_info(&mut it)?;
    let state_account = next_account_info(&mut it)?;
    if let Instruction::Create {
        agreement,
        terms,
        worker,
        resolver,
        amounts,
        full_funding,
    } = ix
    {
        let vault_account = next_account_info(&mut it)?;
        let mint = next_account_info(&mut it)?;
        let system = next_account_info(&mut it)?;
        let tp = next_account_info(&mut it)?;
        require(
            authority.is_signer
                && worker != *authority.key
                && worker != Pubkey::default()
                && terms != [0; 32]
                && agreement != [0; 32]
                && resolver != Some(Pubkey::default())
                && resolver != Some(worker)
                && resolver != Some(*authority.key),
        )?;
        require(
            amounts.len() > 0 && amounts.len() <= MAX_MILESTONES && amounts.iter().all(|a| *a > 0),
        )?;
        amounts.iter().try_fold(0u64, |s, a| {
            s.checked_add(*a).ok_or(ProgramError::ArithmeticOverflow)
        })?;
        require(
            mint.key == &TEST_MINT
                && mint.owner == &spl_token::id()
                && tp.key == &spl_token::id()
                && tp.executable,
        )?;
        let m = Mint::unpack(&mint.try_borrow_data()?)?;
        require(m.is_initialized && m.decimals == 6)?;
        let (state, bump) = state_address(program, authority.key, &agreement);
        require(state == *state_account.key)?;
        let (v, vbump) = vault_address(program, &state);
        require(v == *vault_account.key)?;
        allocate(
            authority,
            state_account,
            system,
            program,
            STATE_SIZE,
            &[b"escrow", authority.key.as_ref(), &agreement, &[bump]],
        )?;
        allocate(
            authority,
            vault_account,
            system,
            &spl_token::id(),
            TokenAccount::LEN,
            &[b"vault", state.as_ref(), &[vbump]],
        )?;
        invoke(
            &spl_token::instruction::initialize_account3(
                tp.key,
                vault_account.key,
                mint.key,
                state_account.key,
            )?,
            &[vault_account.clone(), mint.clone(), tp.clone()],
        )?;
        return write(
            state_account,
            &Escrow {
                magic: MAGIC,
                payer: *authority.key,
                worker,
                resolver,
                agreement,
                terms,
                full_funding,
                accepted: false,
                closed: false,
                milestones: amounts
                    .into_iter()
                    .map(|amount| Milestone {
                        amount,
                        stage: Stage::Unfunded,
                        evidence: [0; 32],
                        released: 0,
                        refunded: 0,
                    })
                    .collect(),
            },
        );
    }
    let mut s = read(program, state_account)?;
    require(!s.closed)?;
    match ix {
        Instruction::Accept => {
            signer(authority, &s.worker)?;
            require(!s.accepted && s.milestones.iter().all(|m| m.stage == Stage::Unfunded))?;
            s.accepted = true;
        }
        Instruction::Close => {
            require(
                authority.is_signer && (authority.key == &s.payer || authority.key == &s.worker),
            )?;
            require(remaining(&s)? == 0)?;
            if s.milestones.iter().any(|m| m.stage != Stage::Unfunded) {
                let other = next_account_info(&mut it)?;
                signer(
                    other,
                    if authority.key == &s.payer {
                        &s.worker
                    } else {
                        &s.payer
                    },
                )?;
            }
            s.closed = true;
        }
        Instruction::Fund { index } => {
            signer(authority, &s.payer)?;
            require(s.accepted)?;
            let i = index as usize;
            require(i < s.milestones.len() && s.milestones[i].stage == Stage::Unfunded)?;
            let amount =
                if s.full_funding {
                    require(index == 0 && s.milestones.iter().all(|m| m.stage == Stage::Unfunded))?;
                    s.milestones.iter().try_fold(0u64, |sum, m| {
                        sum.checked_add(m.amount)
                            .ok_or(ProgramError::ArithmeticOverflow)
                    })?
                } else {
                    require(s.milestones[..i].iter().all(|m| {
                        matches!(m.stage, Stage::Paid | Stage::Refunded | Stage::Resolved)
                    }))?;
                    s.milestones[i].amount
                };
            let va = next_account_info(&mut it)?;
            let source = next_account_info(&mut it)?;
            let mint = next_account_info(&mut it)?;
            let tp = next_account_info(&mut it)?;
            vault(program, state_account, va)?;
            require(mint.key == &TEST_MINT)?;
            token(source, &TEST_MINT, &s.payer)?;
            move_tokens(source, mint, va, authority, tp, amount, None)?;
            if s.full_funding {
                for m in &mut s.milestones {
                    m.stage = Stage::Funded;
                }
            } else {
                s.milestones[i].stage = Stage::Funded;
            }
        }
        Instruction::Start { index } => {
            signer(authority, &s.worker)?;
            require(s.accepted)?;
            let m = s
                .milestones
                .get_mut(index as usize)
                .ok_or(ProgramError::InvalidArgument)?;
            require(m.stage == Stage::Funded)?;
            m.stage = Stage::Active;
        }
        Instruction::Submit { index, evidence } => {
            signer(authority, &s.worker)?;
            require(evidence != [0; 32])?;
            let m = s
                .milestones
                .get_mut(index as usize)
                .ok_or(ProgramError::InvalidArgument)?;
            require(matches!(m.stage, Stage::Active | Stage::Revision))?;
            m.evidence = evidence;
            m.stage = Stage::Submitted;
        }
        Instruction::Review { index, approve } => {
            signer(authority, &s.payer)?;
            let m = s
                .milestones
                .get_mut(index as usize)
                .ok_or(ProgramError::InvalidArgument)?;
            require(m.stage == Stage::Submitted)?;
            m.stage = if approve {
                Stage::Approved
            } else {
                Stage::Revision
            };
        }
        Instruction::Dispute { index } => {
            require(
                authority.is_signer && (authority.key == &s.payer || authority.key == &s.worker),
            )?;
            let m = s
                .milestones
                .get_mut(index as usize)
                .ok_or(ProgramError::InvalidArgument)?;
            require(matches!(
                m.stage,
                Stage::Funded
                    | Stage::Active
                    | Stage::Submitted
                    | Stage::Revision
                    | Stage::Approved
            ))?;
            m.stage = Stage::Disputed;
        }
        Instruction::Release { index }
        | Instruction::Refund { index }
        | Instruction::Resolve { index, .. } => {
            let i = index as usize;
            let m = s.milestones.get(i).ok_or(ProgramError::InvalidArgument)?;
            let amount = m.amount;
            let worker_amount = match ix {
                Instruction::Release { .. } => {
                    signer(authority, &s.payer)?;
                    require(m.stage == Stage::Approved)?;
                    amount
                }
                Instruction::Refund { .. } => {
                    signer(authority, &s.payer)?;
                    signer(next_account_info(&mut it)?, &s.worker)?;
                    require(matches!(
                        m.stage,
                        Stage::Funded
                            | Stage::Active
                            | Stage::Submitted
                            | Stage::Revision
                            | Stage::Approved
                    ))?;
                    0
                }
                Instruction::Resolve { worker_amount, .. } => {
                    require(m.stage == Stage::Disputed && worker_amount <= amount)?;
                    if s.resolver != Some(*authority.key) {
                        signer(authority, &s.payer)?;
                        signer(next_account_info(&mut it)?, &s.worker)?;
                    } else {
                        require(authority.is_signer)?;
                    }
                    worker_amount
                }
                _ => unreachable!(),
            };
            let va = next_account_info(&mut it)?;
            let worker_account = next_account_info(&mut it)?;
            let payer_account = next_account_info(&mut it)?;
            let mint = next_account_info(&mut it)?;
            let tp = next_account_info(&mut it)?;
            vault(program, state_account, va)?;
            require(mint.key == &TEST_MINT)?;
            token(worker_account, &TEST_MINT, &s.worker)?;
            token(payer_account, &TEST_MINT, &s.payer)?;
            require(TokenAccount::unpack(&va.try_borrow_data()?)?.amount >= remaining(&s)?)?;
            let (_, bump) = state_address(program, &s.payer, &s.agreement);
            let seeds: &[&[u8]] = &[b"escrow", s.payer.as_ref(), &s.agreement, &[bump]];
            if worker_amount > 0 {
                move_tokens(
                    va,
                    mint,
                    worker_account,
                    state_account,
                    tp,
                    worker_amount,
                    Some(seeds),
                )?;
            }
            let refund = amount
                .checked_sub(worker_amount)
                .ok_or(ProgramError::ArithmeticOverflow)?;
            if refund > 0 {
                move_tokens(
                    va,
                    mint,
                    payer_account,
                    state_account,
                    tp,
                    refund,
                    Some(seeds),
                )?;
            }
            let m = &mut s.milestones[i];
            m.released = worker_amount;
            m.refunded = refund;
            m.stage = match ix {
                Instruction::Release { .. } => Stage::Paid,
                Instruction::Refund { .. } => Stage::Refunded,
                _ => Stage::Resolved,
            };
        }
        Instruction::Create { .. } => unreachable!(),
    }
    write(state_account, &s)
}
