import pkg from 'pokersolver';
const { Hand } = pkg;

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Card = string; // e.g. "As", "Th"

export interface PlayerState {
  id: string; // user id
  name: string;
  avatar: string;
  chips: number; // current stack
  cards: Card[]; // hole cards
  bet: number; // current bet in this street
  folded: boolean;
  isAllIn: boolean;
  isActive: boolean; // sitting at table vs sitting out
}

export interface GameState {
  id: string; // room id
  mode: 'cash' | 'tournament';
  players: PlayerState[];
  board: Card[];
  pot: number;
  currentBet: number;
  dealerPos: number;
  turnPos: number;
  smallBlind: number;
  bigBlind: number;
  stage: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  deck: Card[];
  logs: string[]; // Hand replay text
}

export class PokerEngine {
  public state: GameState;
  public onHandComplete?: (state: GameState) => void;
  
  constructor(roomId: string, mode: 'cash' | 'tournament', sb: number, bb: number, onHandComplete?: (state: GameState)=>void) {
    this.state = {
      id: roomId,
      mode,
      players: [],
      board: [],
      pot: 0,
      currentBet: 0,
      dealerPos: 0,
      turnPos: 0,
      smallBlind: sb,
      bigBlind: bb,
      stage: 'waiting',
      deck: [],
      logs: []
    };
    this.onHandComplete = onHandComplete;
  }

  join(id: string, name: string, avatar: string, chips: number) {
    if (this.state.players.find(p => p.id === id)) return;
    this.state.players.push({
      id, name, avatar, chips, cards: [], bet: 0, folded: false, isAllIn: false, isActive: true
    });
  }

  leave(id: string) {
    this.state.players = this.state.players.filter(p => p.id !== id);
    // If waiting, just remove. If playing, mark as folded.
  }

  log(msg: string) {
    this.state.logs.push(msg);
  }

  startHand() {
    // Only active players > 1
    const active = this.state.players.filter(p => p.chips > 0 && p.isActive);
    if (active.length < 2) return;
    
    // reset game state
    this.state.stage = 'preflop';
    this.state.board = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.logs = []; // clear replay history
    
    // reset players
    for (const p of this.state.players) {
      p.cards = [];
      p.bet = 0;
      p.folded = p.chips <= 0 || !p.isActive;
      p.isAllIn = false;
    }

    this.state.deck = this.createDeck();
    this.shuffle(this.state.deck);

    // deal cards
    for(let i=0; i<2; i++) {
        for(let j=0; j<this.state.players.length; j++) {
            if(!this.state.players[j].folded) {
                 this.state.players[j].cards.push(this.state.deck.pop()!);
            }
        }
    }

    this.moveDealerPos();
    
    let activePlayers = this.state.players.filter(p=>!p.folded);
    
    // post blinds
    const sbPos = this.getNextActivePos(this.state.dealerPos);
    const bbPos = this.getNextActivePos(sbPos);
    
    this.postBet(sbPos, this.state.smallBlind);
    this.postBet(bbPos, this.state.bigBlind);

    this.state.turnPos = this.getNextActivePos(bbPos);
    this.log(`Hand started. Blinds posted.`);
  }

  // internal helper
  postBet(pos: number, amount: number) {
    const p = this.state.players[pos];
    const toBet = Math.min(amount, p.chips);
    p.chips -= toBet;
    p.bet += toBet;
    if (p.chips === 0) p.isAllIn = true;
    this.state.currentBet = Math.max(this.state.currentBet, p.bet);
    this.log(`${p.name} posted ${toBet}`);
  }

  handleAction(id: string, action: 'fold' | 'check' | 'call' | 'raise' | 'allin', amount?: number) {
    const pos = this.state.players.findIndex(p => p.id === id);
    if (pos === -1 || pos !== this.state.turnPos) return false;
    const player = this.state.players[pos];
    
    if (action === 'fold') {
      player.folded = true;
      this.log(`${player.name} folded`);
    } else if (action === 'check') {
      if (player.bet < this.state.currentBet) return false; // can't check
      this.log(`${player.name} checked`);
    } else if (action === 'call') {
      const toCall = this.state.currentBet - player.bet;
      const actualCall = Math.min(toCall, player.chips);
      player.chips -= actualCall;
      player.bet += actualCall;
      if (player.chips === 0) player.isAllIn = true;
      this.log(`${player.name} called`);
    } else if (action === 'raise' && amount) {
      const totalBet = this.state.currentBet + amount;
      const toDraft = totalBet - player.bet;
      if (toDraft > player.chips) return false;
      player.chips -= toDraft;
      player.bet += toDraft;
      this.state.currentBet = player.bet;
      if (player.chips === 0) player.isAllIn = true;
      this.log(`${player.name} raised to ${player.bet}`);
    } else if (action === 'allin') {
      const allinAmount = player.chips;
      player.chips = 0;
      player.bet += allinAmount;
      if (player.bet > this.state.currentBet) {
        this.state.currentBet = player.bet;
      }
      player.isAllIn = true;
      this.log(`${player.name} acts all-in!`);
    }

    this.advanceTurn();
    return true;
  }

  advanceTurn() {
    let active = this.state.players.filter(p => !p.folded && !p.isAllIn);
    const unFolded = this.state.players.filter(p => !p.folded);
    
    // Check if hand should end early (everyone folded except one)
    if (unFolded.length === 1) {
        return this.endHandEarly(unFolded[0]);
    }
    
    // Check if betting round is over
    let betsComplete = true;
    for(const p of active) {
        if(p.bet < this.state.currentBet) {
            betsComplete = false; break;
        }
    }

    if(betsComplete || active.length <= 1) {
       this.nextStage();
    } else {
       this.state.turnPos = this.getNextActivePos(this.state.turnPos);
    }
  }

  nextStage() {
    // Collect bets to pot
    let roundPot = 0;
    for(const p of this.state.players) {
        roundPot += p.bet;
        p.bet = 0;
    }
    this.state.pot += roundPot;
    this.state.currentBet = 0;

    const unFolded = this.state.players.filter(p => !p.folded);
    const activeAndNotAllin = this.state.players.filter(p => !p.folded && !p.isAllIn);

    if (activeAndNotAllin.length <= 1 && unFolded.length > 1) {
       // fast forward to showdown
       while(this.state.board.length < 5) {
          if (this.state.stage === 'preflop') this.state.board.push(...this.draw(3));
          else this.state.board.push(...this.draw(1));
          if(this.state.board.length === 5) break;
       }
       this.state.stage = 'showdown';
       this.evaluateWinners();
       return;
    }

    if (this.state.stage === 'preflop') {
      this.state.stage = 'flop';
      this.state.board.push(...this.draw(3));
      this.log(`Flop dealt: ${this.state.board.join(', ')}`);
    } else if (this.state.stage === 'flop') {
      this.state.stage = 'turn';
      this.state.board.push(...this.draw(1));
      this.log(`Turn dealt: ${this.state.board.join(', ')}`);
    } else if (this.state.stage === 'turn') {
      this.state.stage = 'river';
      this.state.board.push(...this.draw(1));
      this.log(`River dealt: ${this.state.board.join(', ')}`);
    } else if (this.state.stage === 'river') {
      this.state.stage = 'showdown';
      this.evaluateWinners();
      return;
    }
    this.state.turnPos = this.getNextActivePos(this.state.dealerPos);
  }

  evaluateWinners() {
     const candidates = this.state.players.filter(p => !p.folded);
     if (candidates.length === 0) return;
     if (candidates.length === 1) {
         return this.endHandEarly(candidates[0]);
     }
     this.log(`Showdown! Board: ${this.state.board.join(', ')}`);
     const hands = candidates.map(p => {
         const solverHand = Hand.solve([...p.cards, ...this.state.board]);
         return { p, hand: solverHand };
     });
     
     const winners = Hand.winners(hands.map(h => h.hand));
     const winningPlayers = hands.filter(h => winners.includes(h.hand)).map(h => h.p);

     // split pot simply (does not handle complex side pots perfectly in this MVP but sufficient)
     const winAmount = Math.floor(this.state.pot / winningPlayers.length);
     for(const w of winningPlayers) {
         w.chips += winAmount;
         const winHand = hands.find(h=>h.p === w)!.hand;
         this.log(`${w.name} wins ${winAmount} with ${winHand.descr}`);
     }
     this.state.pot = 0;
     setTimeout(() => this.finishHand(), 5000);
  }

  endHandEarly(winner: PlayerState) {
    this.log(`${winner.name} wins the pot of ${this.state.pot} (Others folded)`);
    // collect any remaining bets
    let roundPot = 0;
    for(const p of this.state.players) {
        roundPot += p.bet;
        p.bet = 0;
    }
    this.state.pot += roundPot;
    
    winner.chips += this.state.pot;
    this.state.pot = 0;
    this.state.stage = 'showdown';
    setTimeout(() => this.finishHand(), 3000);
  }

  finishHand() {
    this.state.stage = 'waiting';
    if (this.onHandComplete) this.onHandComplete(this.state);
    
    // Auto start next hand if enough players
    const active = this.state.players.filter(p => p.chips > 0 && p.isActive);
    if (active.length >= 2) {
      this.startHand();
    }
  }

  getNextActivePos(current: number): number {
    let next = (current + 1) % this.state.players.length;
    while(this.state.players[next].folded || this.state.players[next].isAllIn || !this.state.players[next].isActive) {
       next = (next + 1) % this.state.players.length;
       if (next === current) break;
    }
    return next;
  }
  
  moveDealerPos() {
     this.state.dealerPos = (this.state.dealerPos + 1) % this.state.players.length;
     // skip inactive
     while(!this.state.players[this.state.dealerPos].isActive) {
        this.state.dealerPos = (this.state.dealerPos + 1) % this.state.players.length;
     }
  }

  createDeck() {
     const suits = ['s','h','d','c'];
     const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
     let d: Card[] = [];
     for (const s of suits) {
         for (const r of ranks) {
             d.push(`${r}${s}`);
         }
     }
     return d;
  }

  shuffle(array: Card[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  draw(n: number) {
    return this.state.deck.splice(0, n);
  }

  public getClientState(playerId: string) {
      // mask other players cards
      const masked = {
         ...this.state,
         players: this.state.players.map(p => ({
             ...p,
             cards: (p.id === playerId || this.state.stage === 'showdown') ? p.cards : (p.cards.length > 0 ? ['??','??'] : [])
         })),
         deck: [] // hide deck
      };
      return masked;
  }
}
