// Status effect handling
const STATUS_EFFECTS = {
    ASLEEP: 'asleep',
    PARALYZED: 'paralyzed',
    POISONED: 'poisoned'
};

class Card {
    constructor(name, type, hp, category, evolution = null) {
        this.name = name;
        this.type = type;
        this.hp = hp;
        this.category = category;
        this.evolution = evolution;
        this.damage = 0;
        this.status = null;
        this.attachedEnergy = [];
        this.attacks = [];
        this.abilities = [];
        this.weakness = null;
        this.retreatCost = 0;
    }

    addAttack(name, cost, baseDamage, effect = null, text = '') {
        this.attacks.push({ name, cost, baseDamage, effect, text });
    }

    addAbility(name, effect) {
        this.abilities.push({ name, effect });
    }

    isKnockedOut() {
        return this.damage >= this.hp;
    }

    heal(amount) {
        this.damage = Math.max(0, this.damage - amount);
    }

    canUseAttack(attackIndex) {
        if (this.status === STATUS_EFFECTS.PARALYZED) return false;
        
        const attack = this.attacks[attackIndex];
        if (!attack) return false;

        // Check if we have enough energy
        const energyCount = {};
        this.attachedEnergy.forEach(e => {
            energyCount[e] = (energyCount[e] || 0) + 1;
        });

        for (const [type, count] of Object.entries(attack.cost)) {
            if ((energyCount[type] || 0) < count) return false;
        }

        return true;
    }
}

class Player {
    constructor(deck, name = "Player") {
        if (deck.length !== 20) {
            throw new Error("Deck must contain exactly 20 cards");
        }
        this.name = name;
        this.deck = [...deck];
        this.hand = [];
        this.activePokemon = null;
        this.bench = [];
        this.prizeCards = [];
        this.discardPile = [];
        this.energyZone = ["G", "R", "W", "L", "P", "F", "D", "M", "C"];
    }

    canRetreat() {
        if (!this.activePokemon) return false;
        if (this.activePokemon.status === STATUS_EFFECTS.PARALYZED) return false;
        return this.activePokemon.attachedEnergy.length >= this.activePokemon.retreatCost;
    }

    retreat(benchIndex) {
        if (!this.canRetreat() || benchIndex >= this.bench.length) {
            throw new Error("Invalid retreat");
        }

        // Discard energy equal to retreat cost
        for (let i = 0; i < this.activePokemon.retreatCost; i++) {
            this.activePokemon.attachedEnergy.pop();
        }

        // Swap active with benched Pokemon
        const temp = this.activePokemon;
        this.activePokemon = this.bench[benchIndex];
        this.bench[benchIndex] = temp;
    }
    shuffle() {
        // Fisher-Yates shuffle algorithm
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    drawCard() {
        if (this.deck.length === 0) {
            return null; // Deck out condition
        }
        const card = this.deck.pop();
        this.hand.push(card);
        return card;
    }
}

class GameState {
    constructor(player1Deck, player2Deck) {
        this.player1 = new Player(player1Deck, "Player 1");
        this.player2 = new Player(player2Deck, "Player 2");
        this.currentPlayer = this.player1;
        this.opponentPlayer = this.player2;
        this.turn = 0;
        this.firstTurn = true;
        this.log = [];
    }

    calculateDamage(attacker, defender, attackIndex) {
        const attack = attacker.attacks[attackIndex];
        if (!attack) return 0;

        let damage = attack.baseDamage;

        // Handle multiplication effects
        if (attack.effect === 'multiply') {
            // Implementation depends on specific attack rules
            // Example: "10x for each benched Pokemon"
            const player = this.currentPlayer;
            damage *= player.bench.length;
        }

        // Handle addition effects
        if (attack.effect === 'plus') {
            // Implementation depends on specific attack rules
            // Example: "+30 if opponent is poisoned"
            if (defender.status === STATUS_EFFECTS.POISONED) {
                damage += 30;
            }
        }

        // Apply weakness (2x damage in TCG Pocket)
        if (defender.weakness === attacker.type) {
            damage *= 2;
        }

        return damage;
    }

    performAttack(attackIndex) {
        const attacker = this.currentPlayer.activePokemon;
        const defender = this.opponentPlayer.activePokemon;

        if (!attacker || !defender) return false;
        if (!attacker.canUseAttack(attackIndex)) return false;

        const attack = attacker.attacks[attackIndex];
        const damage = this.calculateDamage(attacker, defender, attackIndex);
        
        // Apply damage
        defender.damage += damage;
        this.log.push(`${attacker.name} used ${attack.name} for ${damage} damage!`);

        // Check for knockout
        if (defender.isKnockedOut()) {
            this.handleKnockOut(this.opponentPlayer);
        }

        // Apply status effects based on attack
        if (attack.text.includes("now Asleep")) {
            defender.status = STATUS_EFFECTS.ASLEEP;
        } else if (attack.text.includes("now Paralyzed")) {
            defender.status = STATUS_EFFECTS.PARALYZED;
        } else if (attack.text.includes("now Poisoned")) {
            defender.status = STATUS_EFFECTS.POISONED;
        }

        return true;
    }

    handleKnockOut(player) {
        // Take prize card
        if (player.activePokemon.category.includes('ex')) {
            // Take 2 prize cards for ex Pokemon
            if (player.prizeCards.length >= 2) {
                this.currentPlayer.hand.push(...player.prizeCards.splice(0, 2));
            }
        } else {
            // Take 1 prize card for regular Pokemon
            if (player.prizeCards.length >= 1) {
                this.currentPlayer.hand.push(player.prizeCards.splice(0, 1)[0]);
            }
        }

        // Move knocked out Pokemon to discard pile
        player.discardPile.push(player.activePokemon);
        player.activePokemon = null;
    }

    handleStatusEffects() {
        const active = this.currentPlayer.activePokemon;
        if (!active) return;

        if (active.status === STATUS_EFFECTS.ASLEEP) {
            // 50% chance to wake up
            if (Math.random() < 0.5) {
                active.status = null;
                this.log.push(`${active.name} woke up!`);
            }
        } else if (active.status === STATUS_EFFECTS.PARALYZED) {
            // Paralysis wears off at end of turn
            active.status = null;
            this.log.push(`${active.name} is no longer paralyzed!`);
        } else if (active.status === STATUS_EFFECTS.POISONED) {
            // Poison does 10 damage between turns
            active.damage += 10;
            this.log.push(`${active.name} took 10 damage from poison!`);
            if (active.isKnockedOut()) {
                this.handleKnockOut(this.currentPlayer);
            }
        }
    }

    endTurn() {
        this.handleStatusEffects();
        this.firstTurn = false;
        this.turn++;

        learner.recordGameState(this);
        
        // Swap current and opponent players
        [this.currentPlayer, this.opponentPlayer] = [this.opponentPlayer, this.currentPlayer];
        
        this.currentPlayer.drawCard();
    }
    setupGame() {
        // 1. Shuffle both players' decks
        this.player1.shuffle();
        this.player2.shuffle();
        
        // 2. Set up prize cards (3 cards each in TCG Pocket)
        const p1Prizes = [];
        const p2Prizes = [];
        for (let i = 0; i < 3; i++) {
            if (this.player1.deck.length > 0) p1Prizes.push(this.player1.deck.pop());
            if (this.player2.deck.length > 0) p2Prizes.push(this.player2.deck.pop());
        }
        this.player1.prizeCards = p1Prizes;
        this.player2.prizeCards = p2Prizes;
        
        // 3. Draw opening hands (5 cards each in TCG Pocket)
        for (let i = 0; i < 5; i++) {
            this.player1.drawCard();
            this.player2.drawCard();
        }
    
        // 4. Check for basic Pokemon in opening hands
        const p1HasBasic = this.player1.hand.some(card => 
            card.category === "Pokémon" && !card.evolution);
        const p2HasBasic = this.player2.hand.some(card => 
            card.category === "Pokémon" && !card.evolution);
    
        // 5. Handle mulligans
        if (!p1HasBasic) this.log.push("Player 1 must mulligan!");
        if (!p2HasBasic) this.log.push("Player 2 must mulligan!");
    
        // Return mulligan information
        return {
            player1Mulligan: !p1HasBasic,
            player2Mulligan: !p2HasBasic
        };
    }
    
    checkWinCondition() {
        // 1. Check prize cards (TCG Pocket: win by taking all 3 prize cards)
        if (this.player1.prizeCards.length === 0) {
            this.log.push("Player 1 wins by taking all prize cards!");
            return this.player1;
        }
        if (this.player2.prizeCards.length === 0) {
            this.log.push("Player 2 wins by taking all prize cards!");
            return this.player2;
        }
    
        // 2. Check deck out (lose if you can't draw at start of turn)
        if (this.player1.deck.length === 0) {
            this.log.push("Player 2 wins by deck out!");
            return this.player2;
        }
        if (this.player2.deck.length === 0) {
            this.log.push("Player 1 wins by deck out!");
            return this.player1;
        }
    
        // 3. Check if a player has no Pokémon in play
        if (!this.player1.activePokemon && this.player1.bench.length === 0) {
            this.log.push("Player 2 wins - Player 1 has no Pokémon in play!");
            return this.player2;
        }
        if (!this.player2.activePokemon && this.player2.bench.length === 0) {
            this.log.push("Player 1 wins - Player 2 has no Pokémon in play!");
            return this.player1;
        }
    
        // No win condition met - game continues
        return null;
    }
}

// Export the classes and constants
export { Card, Player, GameState, STATUS_EFFECTS };