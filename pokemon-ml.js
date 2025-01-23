const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');

class PokemonTCGLearning {
  constructor() {
    this.gameData = [];
    this.model = null;
  }

  // Record game data during gameplay
  recordGameState(gameState) {
    const stateData = {
      turn: gameState.turn,
      player1: this.extractPlayerState(gameState.player1),
      player2: this.extractPlayerState(gameState.player2),
      actions: gameState.log,
      firstTurn: gameState.firstTurn
    };
    
    this.gameData.push(stateData);
  }

  // Extract relevant player state information
  extractPlayerState(player) {
    return {
      activePokemon: player.activePokemon ? this.encodeCard(player.activePokemon) : null,
      bench: player.bench.map(card => this.encodeCard(card)),
      deckSize: player.deck.length,
      handSize: player.hand.length,
      prizeCardsLeft: player.prizeCards.length,
      discardPileSize: player.discardPile.length
    };
  }

  // Encode card features
  encodeCard(card) {
    if (!card) return null;
    return {
      hp: this.normalizeHP(card.hp),
      damage: card.damage / 200, // Normalize damage
      isEx: card.category.includes('ex') ? 1 : 0,
      type: this.encodeType(card.type),
      attacks: this.encodeAttacks(card.attacks),
      status: this.encodeStatus(card.status)
    };
  }

  // Normalize HP values
  normalizeHP(hp) {
    return hp ? hp / 200 : 0; // Max HP in the game appears to be around 200
  }

  // Encode Pokemon type
  encodeType(type) {
    const types = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'];
    return types.map(t => type === t ? 1 : 0);
  }

  // Encode attacks
  encodeAttacks(attacks) {
    if (!attacks) return [0, 0, 0, 0]; // Basic attack features
    return attacks.map(attack => ({
      damage: attack.baseDamage / 200, // Normalize damage
      energyCost: this.countEnergyCost(attack.energyCost),
      hasEffect: attack.effect ? 1 : 0,
      hasStatusEffect: this.hasStatusEffect(attack.text)
    }));
  }

  // Count total energy cost
  countEnergyCost(energyCost) {
    if (!energyCost) return 0;
    return energyCost.reduce((total, cost) => total + cost, 0) / 4; // Normalize by max energy cost
  }

  // Check for status effects in attack text
  hasStatusEffect(text) {
    if (!text) return 0;
    return (text.includes('Asleep') || text.includes('Paralyzed') || text.includes('Poisoned')) ? 1 : 0;
  }

  // Encode status effects
  encodeStatus(status) {
    const statuses = ['ASLEEP', 'PARALYZED', 'POISONED'];
    return statuses.map(s => status === s ? 1 : 0);
  }

  // Create the neural network model
  async createModel() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.calculateInputShape()],
          units: 256,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    this.model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
  }

  // Calculate input shape based on feature encoding
  calculateInputShape() {
    // Base features: turn, firstTurn
    let shape = 2;
    
    // Per player: activePokemon, bench (max 3), deck size, hand size, prize cards, discard pile
    const playerFeatures = 1 + (3 * this.calculateCardFeatures()) + 4;
    shape += playerFeatures * 2;
    
    return shape;
  }

  // Calculate features per card
  calculateCardFeatures() {
    return (
      1 + // HP
      1 + // Damage
      1 + // isEx
      10 + // type (one-hot encoded)
      4 + // attacks
      3   // status effects
    );
  }

  // Prepare training data
  prepareTrainingData(winner) {
    const X = [];
    const y = [];

    for (const state of this.gameData) {
      const features = [
        state.turn / 100, // Normalize turn number
        state.firstTurn ? 1 : 0,
        ...this.flattenPlayerState(state.player1),
        ...this.flattenPlayerState(state.player2)
      ];

      X.push(features);
      y.push(winner === state.player1 ? 1 : 0);
    }

    return {
      X: tf.tensor2d(X),
      y: tf.tensor2d(y, [y.length, 1])
    };
  }

  // Flatten player state into feature array
  flattenPlayerState(playerState) {
    return [
      ...this.flattenCard(playerState.activePokemon),
      ...playerState.bench.flatMap(card => this.flattenCard(card)),
      playerState.deckSize / 60, // Normalize deck size
      playerState.handSize / 10, // Normalize hand size
      playerState.prizeCardsLeft / 3, // Normalize prize cards
      playerState.discardPileSize / 60 // Normalize discard pile
    ];
  }

  // Flatten card features into array
  flattenCard(card) {
    if (!card) {
      return new Array(this.calculateCardFeatures()).fill(0);
    }
    return [
      card.hp,
      card.damage,
      card.isEx,
      ...card.type,
      ...card.attacks.flat(),
      ...card.status
    ];
  }

  // Train the model
  async trainModel(epochs = 50) {
    if (!this.model) await this.createModel();
    
    const { X, y } = this.prepareTrainingData();
    
    await this.model.fit(X, y, {
      epochs,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
        }
      }
    });
  }

  // Save and load model
  async saveModel(path) {
    await this.model.save(`file://${path}`);
  }

  async loadModel(path) {
    this.model = await tf.loadLayersModel(`file://${path}`);
  }

  // Predict win probability for current game state
  async predictWinProbability(gameState) {
    if (!this.model) throw new Error('Model not loaded');

    const features = [
      gameState.turn / 100,
      gameState.firstTurn ? 1 : 0,
      ...this.flattenPlayerState(this.extractPlayerState(gameState.player1)),
      ...this.flattenPlayerState(this.extractPlayerState(gameState.player2))
    ];

    const prediction = await this.model.predict(tf.tensor2d([features]));
    return prediction.dataSync()[0];
  }
}

// Example usage
async function runGameAnalysis(gameState) {
  const learner = new PokemonTCGLearning();
  
  // Record game state
  learner.recordGameState(gameState);
  
  // After game ends
  const winner = gameState.checkWinCondition();
  if (winner) {
    await learner.createModel();
    await learner.trainModel();
    
    // Predict win probability for current state
    const probability = await learner.predictWinProbability(gameState);
    console.log(`Win probability for player 1: ${(probability * 100).toFixed(2)}%`);
  }
}

module.exports = {
  PokemonTCGLearning,
  runGameAnalysis
};