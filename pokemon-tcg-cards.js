import { Card } from './pokemon-tcg-sim.js';

// Helper function to parse energy cost string
function parseEnergyCost(costString) {
    const costs = {
        G: 0, R: 0, W: 0, L: 0, P: 0, F: 0, D: 0, M: 0, C: 0
    };
    
    for (const char of costString) {
        if (costs.hasOwnProperty(char)) {
            costs[char]++;
        }
    }
    return costs;
}

// Function to create a card from the library data
function createCard(cardData) {
    const card = new Card(
        cardData.name,
        cardData.type,
        cardData.hp,
        cardData.category,
        cardData.evolution
    );

    // Add attacks
    if (cardData.attacks) {
        cardData.attacks.forEach(attack => {
            card.addAttack(
                attack.name,
                parseEnergyCost(attack.cost),
                attack.baseDamage,
                attack.effect,
                attack.text
            );
        });
    }

    // Add abilities
    if (cardData.abilities) {
        cardData.abilities.forEach(ability => {
            card.addAbility(ability.name, ability.effect);
        });
    }

    card.weakness = cardData.weakness;
    card.retreatCost = cardData.retreatCost;

    return card;
}

// Create some example cards from the library
//COLE: replace with API, need evolutions all over SIM and card
const exampleCards = {
    pikachu: {
        name: "Pikachu",
        type: "Lightning",
        hp: 60,
        category: "Pokémon - Basic",
        attacks: [
            {
                name: "Circle Circuit",
                cost: "L",
                baseDamage: 10,
                effect: "multiply",
                text: "This attack does 10 damage for each of your Benched [L] Pokémon."
            }
        ],
        weakness: "Fighting",
        retreatCost: 1
    },
    // Add more cards here...
};

// Function to create a card instance
function createCardInstance(cardName) {
    const cardData = exampleCards[cardName];
    if (!cardData) {
        throw new Error(`Card ${cardName} not found in database`);
    }
    return createCard(cardData);
}

export { createCardInstance, exampleCards };