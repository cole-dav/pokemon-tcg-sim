// Import the simulator classes
import { Card, Player, GameState } from './pokemon-tcg-sim.js';
import { createCardInstance } from './pokemon-tcg-cards.js';
import { PokemonTCGLearning, runGameAnalysis } from './pokemon-ml.js';

// Create example decks (20 cards each)
function createExampleDeck() {
    return [
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        createCardInstance('pikachu'),
        createCardInstance('pikachu'),  // Maximum 2 copies allowed
        // createCardInstance('raichu'),
        // createCardInstance('mewtwo'),
        // createCardInstance('mew'),
        // createCardInstance('charizard'),
        // createCardInstance('blastoise'),
        // createCardInstance('venusaur'),
        // createCardInstance('potion'),   // Trainer card
        // createCardInstance('potion'),
        // ... add more cards to reach 20
    ];
}

// Start a game
function startGame() {
    // Create decks for both players
    const deck1 = createExampleDeck();
    const deck2 = createExampleDeck();

    // Initialize game state
    const game = new GameState(deck1, deck2);
    const learner = new PokemonTCGLearning();

    
    game.setupGame();

    return game;
}

// Example of playing a turn
function playTurn(game) {
    const currentPlayer = game.currentPlayer;
    
    // 1. Draw card for turn (except first turn for player 1)
    if (!(game.firstTurn && currentPlayer === game.player1)) {
        currentPlayer.drawCard();
    }

    // 2. Play a Pokemon if possible
    const basicPokemon = currentPlayer.hand.find(card => 
        card.category === "Pokémon" && !card.evolution);
    if (basicPokemon && !currentPlayer.activePokemon) {
        game.playCard(basicPokemon, currentPlayer);
    }

    // 3. Attach Energy (except first turn for player 1)
    if (!(game.firstTurn && currentPlayer === game.player1)) {
        if (currentPlayer.activePokemon) {
            game.attachEnergy("L", currentPlayer.activePokemon, currentPlayer);
        }
    }

    // 4. Attack if possible
    if (currentPlayer.activePokemon) {
        game.performAttack(0);  // Use first attack
    }

    // 5. End turn
    game.endTurn();
}

// Example game loop
async function playGame() {
    const game = startGame();
    
    while (!game.checkWinCondition()) {
        console.log(`Turn ${game.turn + 1}: ${game.currentPlayer.name}'s turn`);
        playTurn(game);
        
        // Print game state
        console.log('Active Pokemon:');
        console.log(`P1: ${game.player1.activePokemon?.name || 'None'} (${game.player1.activePokemon?.hp - game.player1.activePokemon?.damage || 0} HP)`);
        console.log(`P2: ${game.player2.activePokemon?.name || 'None'} (${game.player2.activePokemon?.hp - game.player2.activePokemon?.damage || 0} HP)`);
        console.log('Prize cards remaining:', game.player1.prizeCards.length, game.player2.prizeCards.length);
        console.log('---');
    }

    const winner = game.checkWinCondition();
    if (winner) {
        await runGameAnalysis(gameState);
    }
    console.log(`Game Over! ${winner.name} wins!`);
}

// Run the game
playGame();

// Example of making specific moves
function makeSpecificMove(game) {
    const player = game.currentPlayer;
    
    // Play a basic Pokemon
    const pokemon = player.hand.find(card => 
        card.category === "Pokémon" && !card.evolution);
    if (pokemon) {
        game.playCard(pokemon, player);
    }
    
    // Attach energy
    if (player.activePokemon) {
        game.attachEnergy("L", player.activePokemon, player);
    }
    
    // Use a trainer card
    const trainer = player.hand.find(card => 
        card.category === "Trainer");
    if (trainer) {
        game.playCard(trainer, player);
    }
    
    // Retreat if possible
    if (player.canRetreat() && player.bench.length > 0) {
        player.retreat(0);
    }
    
    // Attack if possible
    if (player.activePokemon?.canUseAttack(0)) {
        game.performAttack(0);
    }
}

// Export the example functions
export { startGame, playTurn, playGame, makeSpecificMove };